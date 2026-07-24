import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAppRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function clean(value, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    if (actor.role !== "investor" || actor.portalEnabled === false) {
      return Response.json({ error: "Push notifications are available only for active Investor Portal accounts." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const token = clean(body.token);
    const deviceId = clean(body.deviceId, 160);

    const snapshot = await adminDb.collection("pushSubscriptions")
      .where("recipientUid", "==", actor.uid)
      .get();

    const batch = adminDb.batch();
    let removed = 0;
    snapshot.docs.forEach((item) => {
      const data = item.data();
      if ((token && data.token === token) || (deviceId && data.deviceId === deviceId) || (!token && !deviceId)) {
        batch.delete(item.ref);
        removed += 1;
      }
    });
    if (removed) await batch.commit();

    const remainingSnapshot = await adminDb.collection("pushSubscriptions")
      .where("recipientUid", "==", actor.uid)
      .get();
    const hasActiveDevice = remainingSnapshot.docs.some((item) => item.data().active !== false);

    await adminDb.collection("notificationPreferences").doc(actor.uid).set({
      pushEnabled: hasActiveDevice,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return Response.json({ ok: true, removed, pushEnabled: hasActiveDevice });
  } catch (error) {
    console.error("Push unregistration failed", error);
    return Response.json({ error: error.message || "Push subscription could not be removed." }, { status: 401 });
  }
}
