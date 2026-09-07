import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { insuranceDaysUntil, insuranceDueDates, insuranceReminderOffsets } from "@/lib/constants/insurance";
import { businessDateKey } from "@/lib/utils/date";

export const runtime = "nodejs";

const PAGE_SIZE = 400;
const OVERDUE_REMINDER_STAGES = [1, 7, 15, 30, 60, 90];

function authorised(request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return false;
  const supplied = String(request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "").trim();
  return secureSecretMatch(supplied, configured);
}

function amountText(value) {
  const amount = Number(value || 0);
  return amount > 0 ? ` · ₹${amount.toLocaleString("en-IN")}` : "";
}

function reminderStage(daysUntil, configuredOffsets) {
  if (daysUntil === null) return null;
  if (daysUntil >= 0) {
    const candidates = [...configuredOffsets].filter((offset) => offset >= daysUntil).sort((a, b) => a - b);
    if (!candidates.length) return null;
    const scheduledOffset = candidates[0];
    return {
      key: `before_${scheduledOffset}`,
      scheduledOffset,
      overdueDays: 0,
      timing: daysUntil === 0 ? "due today" : `due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      catchUp: scheduledOffset !== daysUntil
    };
  }

  const overdueDays = Math.abs(daysUntil);
  const stage = OVERDUE_REMINDER_STAGES.filter((value) => value <= overdueDays).pop() || 1;
  return {
    key: `overdue_${stage}`,
    scheduledOffset: null,
    overdueDays,
    timing: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
    catchUp: stage !== overdueDays
  };
}

async function processPolicy(policyDoc, today) {
  const policy = { id: policyDoc.id, ...policyDoc.data() };
  if (policy.autoReminder === false) return { id: policy.id, status: "disabled" };
  if (policy.remindersPausedByInvestorLifecycle === true || policy.investorLifecyclePaused === true) return { id: policy.id, status: "lifecycle_paused" };
  if (["Cancelled", "Claimed / Closed", "Renewed", "Lapsed", "Expired"].includes(policy.policyStatus)) return { id: policy.id, status: "closed" };

  const configured = new Set(insuranceReminderOffsets(policy.reminderDays));
  const dueItems = insuranceDueDates(policy);
  let sent = 0;

  for (const due of dueItems) {
    const days = insuranceDaysUntil(due.date, today);
    const stage = reminderStage(days, configured);
    if (!stage) continue;

    const safeDate = String(due.date).replace(/[^0-9]/g, "");
    const key = `${policy.id}_${due.kind}_${safeDate}_${stage.key}`;
    const eventRef = adminDb.collection("insuranceReminderEvents").doc(key);
    const eventSnapshot = await eventRef.get();
    if (eventSnapshot.exists) continue;

    const batch = adminDb.batch();
    batch.set(eventRef, {
      policyId: policy.id,
      investorId: policy.investorId,
      investorName: policy.investorName || "Investor",
      advisorUid: policy.advisorUid || "",
      dueKind: due.kind,
      dueLabel: due.label,
      dueDate: due.date,
      daysBefore: days,
      reminderStage: stage.key,
      scheduledOffset: stage.scheduledOffset,
      overdueDays: stage.overdueDays,
      catchUp: stage.catchUp,
      businessDate: today,
      sentAt: FieldValue.serverTimestamp(),
      createdByUid: "system"
    });

    if (policy.investorPortalUid) {
      batch.set(adminDb.collection("notifications").doc(`insurance_${key}_investor`), {
        recipientUid: policy.investorPortalUid,
        recipientType: "investor",
        title: `${due.label} ${stage.timing}`,
        message: `${policy.productName || "Insurance policy"} · ${policy.insurer || ""}${amountText(due.kind === "premium" ? policy.premiumAmount : policy.coverAmount)} · ${due.date}.`,
        eventType: days < 0 ? "insurance_due_overdue" : "insurance_due_reminder",
        link: "/investor/insurance",
        investorId: policy.investorId,
        insurancePolicyId: policy.id,
        status: "unread",
        createdByUid: "system",
        createdAt: FieldValue.serverTimestamp(),
        readAt: null
      }, { merge: true });
    }

    if (policy.advisorUid) {
      batch.set(adminDb.collection("notifications").doc(`insurance_${key}_advisor`), {
        recipientUid: policy.advisorUid,
        recipientType: "advisor",
        title: `Insurance ${due.label.toLowerCase()} ${stage.timing}`,
        message: `${policy.investorName || "Investor"} · ${policy.productName || "Insurance policy"} · ${due.date}.`,
        eventType: days < 0 ? "insurance_due_overdue" : "insurance_due_reminder",
        link: `/insurance?investorId=${encodeURIComponent(policy.investorId || "")}`,
        investorId: policy.investorId,
        insurancePolicyId: policy.id,
        status: "unread",
        createdByUid: "system",
        createdAt: FieldValue.serverTimestamp(),
        readAt: null
      }, { merge: true });
    }

    await batch.commit();
    sent += 1;
  }
  return { id: policy.id, status: sent ? "sent" : "not_due", sent };
}

async function loadPolicyPage(cursor = null) {
  let query = adminDb.collection("insurancePolicies").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  if (cursor) query = query.startAfter(cursor);
  return query.get();
}

async function run(request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const today = businessDateKey();
  const results = [];
  let cursor = null;
  let checked = 0;
  let pages = 0;

  while (true) {
    const snapshot = await loadPolicyPage(cursor);
    if (snapshot.empty) break;
    pages += 1;
    checked += snapshot.size;
    for (const doc of snapshot.docs) {
      try { results.push(await processPolicy(doc, today)); }
      catch (error) { results.push({ id: doc.id, status: "failed", error: error.message }); }
    }
    if (snapshot.size < PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return NextResponse.json({
    success: true,
    businessDate: today,
    checked,
    pages,
    remindersSent: results.reduce((sum, item) => sum + Number(item.sent || 0), 0),
    failures: results.filter((item) => item.status === "failed").length,
    results
  });
}

export async function GET(request) {
  try { return await run(request); }
  catch (error) {
    console.error("Insurance reminder cron failed", error);
    return NextResponse.json({ error: error.message || "Insurance reminder processing failed." }, { status: 500 });
  }
}

export async function POST(request) { return GET(request); }
