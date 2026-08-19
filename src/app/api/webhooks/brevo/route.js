import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { normaliseDeliveryStatus } from "@/lib/constants/emailDelivery";

export const runtime = "nodejs";

const STATUS_RANK = {
  pending: 0,
  scheduled: 1,
  queued: 2,
  sending: 3,
  sent: 4,
  delivered: 5,
  opened: 6,
  clicked: 7,
  skipped: 4,
  failed: 8,
  bounced: 8,
  blocked: 8
};

function authorised(request) {
  const configured = String(process.env.BREVO_WEBHOOK_TOKEN || "").trim();
  if (!configured) return false;
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return secureSecretMatch(supplied, configured);
}

function cleanWebhookText(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function safeProviderPayload(payload = {}) {
  return {
    id: cleanWebhookText(payload.id, 240),
    event: cleanWebhookText(payload.event, 80),
    email: cleanWebhookText(payload.email, 320).toLowerCase(),
    messageId: cleanWebhookText(payload["message-id"] || payload.messageId || payload.message_id, 500),
    reason: cleanWebhookText(payload.reason || payload.message, 1000),
    link: cleanWebhookText(payload.link || payload.URL, 2000),
    ts: Number(payload.ts_event || payload.ts || 0) || null,
    date: cleanWebhookText(payload.date_event || payload.date || payload.date_sent, 120),
    custom: cleanWebhookText(payload["X-Mailin-custom"] || payload["x-mailin-custom"] || payload.custom, 1000)
  };
}

function customValue(payload) {
  return String(payload?.["X-Mailin-custom"] || payload?.["x-mailin-custom"] || payload?.custom || "");
}

function extractDeliveryId(payload) {
  const direct = String(payload?.deliveryId || payload?.delivery_id || "").trim();
  if (direct) return direct;
  const match = customValue(payload).match(/deliveryId:([^|\s]+)/i);
  return match?.[1] || "";
}

function messageId(payload) {
  return String(payload?.["message-id"] || payload?.messageId || payload?.message_id || "").trim();
}

function eventDate(payload) {
  const seconds = Number(payload?.ts_event || payload?.ts || 0);
  if (seconds) return new Date(seconds * 1000);
  const candidate = payload?.date_event || payload?.date || payload?.date_sent;
  const date = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function eventDocumentId(payload) {
  const raw = JSON.stringify({
    id: payload?.id || "",
    event: payload?.event || "",
    messageId: messageId(payload),
    email: payload?.email || "",
    ts: payload?.ts_event || payload?.ts || payload?.date_event || ""
  });
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

async function findDelivery(payload) {
  const deliveryId = extractDeliveryId(payload);
  if (deliveryId) {
    const reference = adminDb.collection("emailDeliveries").doc(deliveryId);
    const snapshot = await reference.get();
    if (snapshot.exists) return { reference, snapshot };
  }
  const providerMessageId = messageId(payload);
  if (providerMessageId) {
    const candidates = [...new Set([providerMessageId, providerMessageId.replace(/^<|>$/g, ""), `<${providerMessageId.replace(/^<|>$/g, "")}>`])];
    for (const value of candidates) {
      const snapshot = await adminDb.collection("emailDeliveries").where("providerMessageId", "==", value).limit(1).get();
      if (!snapshot.empty) return { reference: snapshot.docs[0].ref, snapshot: snapshot.docs[0] };
    }
  }
  return null;
}

function statusFields(status, occurredAt, payload) {
  const fields = { status, lastEvent: status, lastEventAt: occurredAt, updatedAt: new Date() };
  if (status === "sent") fields.sentAt = occurredAt;
  if (status === "delivered") fields.deliveredAt = occurredAt;
  if (status === "opened") fields.openedAt = occurredAt;
  if (status === "clicked") fields.clickedAt = occurredAt;
  if (["failed", "bounced", "blocked"].includes(status)) {
    fields.failedAt = occurredAt;
    fields.failureReason = cleanWebhookText(payload?.reason || payload?.message || status, 1000);
  }
  if (payload?.link || payload?.URL) fields.lastClickedUrl = cleanWebhookText(payload.link || payload.URL, 2000);
  return fields;
}

export async function POST(request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1024 * 1024) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  try {
    const body = await request.json();
    const events = Array.isArray(body) ? body : [body];
    const results = [];
    for (const payload of events) {
      const event = String(payload?.event || "").trim();
      const status = normaliseDeliveryStatus(event);
      const occurredAt = eventDate(payload);
      const match = await findDelivery(payload);
      const eventId = eventDocumentId(payload);
      const eventRef = adminDb.collection("emailDeliveryEvents").doc(eventId);
      const existingEvent = await eventRef.get();
      if (existingEvent.exists) {
        results.push({ event, status, duplicate: true });
        continue;
      }
      const baseEvent = {
        event,
        status,
        recipientEmail: String(payload?.email || "").trim().toLowerCase(),
        providerMessageId: messageId(payload) || null,
        reason: cleanWebhookText(payload?.reason || payload?.message, 1000) || null,
        link: cleanWebhookText(payload?.link || payload?.URL, 2000) || null,
        occurredAt,
        providerPayload: safeProviderPayload(payload),
        createdAt: new Date()
      };
      if (!match) {
        await eventRef.set({ ...baseEvent, matched: false });
        results.push({ event, status, matched: false });
        continue;
      }
      const delivery = { id: match.snapshot.id, ...match.snapshot.data() };
      const currentStatus = normaliseDeliveryStatus(delivery.status);
      const nextStatus = (STATUS_RANK[status] ?? 0) >= (STATUS_RANK[currentStatus] ?? 0) ? status : currentStatus;
      const fields = statusFields(nextStatus, occurredAt, payload);
      await adminDb.runTransaction(async (transaction) => {
        transaction.set(eventRef, {
          ...baseEvent,
          matched: true,
          deliveryId: delivery.id,
          reportId: delivery.reportId || null,
          investorId: delivery.investorId || null,
          advisorUid: delivery.advisorUid || null
        });
        transaction.set(match.reference, fields, { merge: true });
      });
      if (delivery.reportId && !delivery.testMode) {
        const reportFields = {
          lastEmailStatus: nextStatus,
          lastEmailEventAt: occurredAt,
          lastEmailDeliveryId: delivery.id,
          updatedAt: new Date()
        };
        if (["failed", "bounced", "blocked"].includes(nextStatus)) reportFields.lastEmailError = fields.failureReason;
        if (["delivered", "opened", "clicked"].includes(nextStatus)) reportFields.lastEmailError = null;
        await adminDb.collection("monthlyReports").doc(delivery.reportId).set(reportFields, { merge: true });
      }
      results.push({ event, status: nextStatus, matched: true, deliveryId: delivery.id });
    }
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error("Brevo webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
