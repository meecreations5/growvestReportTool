import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminMessaging, verifyAppRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    if (actor.role !== "investor" || actor.portalEnabled === false) {
      return Response.json({ error: "Push notifications are available only for active Investor Portal accounts." }, { status: 403 });
    }
    const preferenceRef = adminDb.collection("notificationPreferences").doc(actor.uid);
    const [preferenceSnapshot, snapshot] = await Promise.all([
      preferenceRef.get(),
      adminDb.collection("pushSubscriptions").where("recipientUid", "==", actor.uid).get()
    ]);
    const lastTest = preferenceSnapshot.data()?.lastPushTestAt?.toMillis?.() || 0;
    if (lastTest && Date.now() - lastTest < 30_000) {
      return Response.json({ error: "Please wait 30 seconds before sending another test notification." }, { status: 429 });
    }
    const subscriptions = snapshot.docs.filter((item) => item.data().active !== false && item.data().token);
    const tokens = [...new Set(subscriptions.map((item) => item.data().token))].slice(0, 500);

    if (!tokens.length) {
      return Response.json({ error: "No active push-enabled device is registered for this account." }, { status: 400 });
    }

    const link = "/investor/notifications";
    const result = await adminMessaging.sendEachForMulticast({
      tokens,
      data: {
        eventType: "push_test",
        link,
        title: "GrowVest notifications are active",
        body: "You will receive important report, meeting and document updates on this device.",
        icon: "/icons/growvest-pwa-192.png",
        badge: "/icons/growvest-pwa-192.png",
        tag: `growvest-push-test-${actor.uid}`,
        requireInteraction: "false"
      },
      webpush: { headers: { Urgency: "high", TTL: "3600" } }
    });

    await preferenceRef.set({ lastPushTestAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true, successCount: result.successCount, failureCount: result.failureCount });
  } catch (error) {
    console.error("Push test failed", error);
    return Response.json({ error: error.message || "Test push could not be sent." }, { status: appRequestErrorStatus(error, 500) });
  }
}
