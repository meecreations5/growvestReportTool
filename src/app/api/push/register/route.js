import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAppRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function subscriptionId(uid, token) {
  return createHash("sha256").update(`${uid}:${token}`).digest("hex");
}

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    if (actor.role !== "investor" || actor.portalEnabled === false) {
      return Response.json({ error: "Push notifications are available only for active Investor Portal accounts." }, { status: 403 });
    }
    const body = await request.json();
    const token = clean(body.token, 5000);
    const deviceId = clean(body.deviceId, 160);

    if (!token || token.length < 40) {
      return Response.json({ error: "A valid Firebase Cloud Messaging token is required." }, { status: 400 });
    }
    if (!deviceId) {
      return Response.json({ error: "A device identifier is required." }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const ref = adminDb.collection("pushSubscriptions").doc(subscriptionId(actor.uid, token));
    const existing = await ref.get();
    await ref.set({
      recipientUid: actor.uid,
      investorId: actor.investorId || null,
      role: actor.role,
      token,
      deviceId,
      platform: clean(body.platform, 120),
      userAgent: clean(body.userAgent, 700),
      language: clean(body.language, 40) || "en-IN",
      timezone: clean(body.timezone, 100) || "Asia/Kolkata",
      standalone: body.standalone === true,
      active: true,
      createdAt: existing.exists ? existing.data().createdAt || now : now,
      updatedAt: now,
      lastSeenAt: now
    }, { merge: true });

    await adminDb.collection("notificationPreferences").doc(actor.uid).set({
      recipientUid: actor.uid,
      pushEnabled: true,
      updatedAt: now
    }, { merge: true });

    return Response.json({ ok: true, deviceId });
  } catch (error) {
    console.error("Push registration failed", error);
    return Response.json({ error: error.message || "Push registration failed." }, { status: 401 });
  }
}
