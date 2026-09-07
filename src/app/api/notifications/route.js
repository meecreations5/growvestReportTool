import { FieldValue } from "firebase-admin/firestore";
import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  verifyAppRequest
} from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const DEFAULT_PREFERENCES = {
  inAppEnabled: true,
  pushEnabled: false,
  pushCategories: {
    portfolio: true,
    sip: true,
    bucketList: true,
    reports: true,
    meetings: true,
    documents: true,
    insurance: true,
    general: true
  }
};

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  return value;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

async function ownNotification(actor, notificationId) {
  const snapshot = await adminDb.collection("notifications").doc(notificationId).get();
  if (!snapshot.exists) throw new AppRequestError("Notification was not found.", 404, "notification_missing");
  const notification = { id: snapshot.id, ...snapshot.data() };
  if (String(notification.recipientUid || "") !== String(actor.uid)) {
    throw new AppRequestError("You are not authorised to update this notification.", 403, "notification_access_denied");
  }
  return notification;
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const [notificationSnapshot, preferenceSnapshot] = await Promise.all([
      adminDb.collection("notifications").where("recipientUid", "==", actor.uid).get(),
      adminDb.collection("notificationPreferences").doc(actor.uid).get()
    ]);
    const items = notificationSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
      .slice(0, 50);
    const preferences = preferenceSnapshot.exists
      ? {
          ...DEFAULT_PREFERENCES,
          ...preferenceSnapshot.data(),
          pushCategories: {
            ...DEFAULT_PREFERENCES.pushCategories,
            ...(preferenceSnapshot.data()?.pushCategories || {})
          }
        }
      : DEFAULT_PREFERENCES;
    return Response.json(serialise({ items, preferences }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Notification read failed", error);
    return Response.json(
      { error: error?.message || "Unable to load notifications." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "mark_read") {
      const notificationId = String(body.notificationId || "").trim();
      if (!notificationId) throw new AppRequestError("Notification is required.", 400, "notification_required");
      await ownNotification(actor, notificationId);
      await adminDb.collection("notifications").doc(notificationId).set({
        status: "read",
        readAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return Response.json({ ok: true });
    }

    if (action === "mark_all_read") {
      const snapshot = await adminDb.collection("notifications").where("recipientUid", "==", actor.uid).get();
      const writer = adminDb.bulkWriter();
      snapshot.docs.forEach((item) => {
        if (String(item.data()?.status || "") === "read") return;
        writer.set(item.ref, { status: "read", readAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      await writer.close();
      return Response.json({ ok: true });
    }

    if (action === "save_preferences") {
      const updates = body.updates && typeof body.updates === "object" ? body.updates : {};
      const allowed = {};
      if (typeof updates.inAppEnabled === "boolean") allowed.inAppEnabled = updates.inAppEnabled;
      if (typeof updates.pushEnabled === "boolean") allowed.pushEnabled = updates.pushEnabled;
      if (updates.pushCategories && typeof updates.pushCategories === "object") {
        allowed.pushCategories = Object.fromEntries(Object.entries(updates.pushCategories).filter(([, value]) => typeof value === "boolean"));
      }
      await adminDb.collection("notificationPreferences").doc(actor.uid).set({
        recipientUid: actor.uid,
        ...allowed,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return Response.json({ ok: true });
    }

    throw new AppRequestError("Unsupported notification action.", 400, "notification_action_invalid");
  } catch (error) {
    console.error("Notification update failed", error);
    return Response.json(
      { error: error?.message || "Unable to update notifications." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
