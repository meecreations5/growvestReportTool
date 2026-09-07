import { collection, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

export function buildNotification({
  recipientUid,
  recipientType,
  title,
  message,
  eventType,
  link,
  investorId = null,
  leadId = null,
  meetingId = null,
  momId = null,
  createdByUid,
  metadata = {}
}) {
  if (!recipientUid) return null;
  return {
    recipientUid,
    recipientType,
    title,
    message,
    eventType,
    link,
    investorId,
    leadId,
    meetingId,
    momId,
    metadata,
    status: "unread",
    createdByUid,
    createdAt: serverTimestamp(),
    readAt: null
  };
}

export function addNotificationToBatch(batch, payload) {
  const notification = buildNotification(payload);
  if (!notification) return null;
  const notificationRef = doc(collection(db, "notifications"));
  batch.set(notificationRef, notification);
  return notificationRef;
}

async function notificationApiFetch(options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders(options.headers || {}, user);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch("/api/notifications", { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Notifications could not be loaded.");
  return payload;
}

export function subscribeNotifications(profileOrUid, callback, onError) {
  const profile = typeof profileOrUid === "string" ? { id: profileOrUid } : profileOrUid;
  if (!profile?.id) return () => {};
  let closed = false;
  let timer = null;

  async function load() {
    try {
      const payload = await notificationApiFetch({ method: "GET" });
      if (!closed) callback(payload.items || []);
    } catch (error) {
      if (!closed) onError?.(error);
    }
  }

  load();
  timer = window.setInterval(load, 30000);
  const refreshOnFocus = () => { if (!document.hidden) load(); };
  document.addEventListener("visibilitychange", refreshOnFocus);

  return () => {
    closed = true;
    if (timer) window.clearInterval(timer);
    document.removeEventListener("visibilitychange", refreshOnFocus);
  };
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return;
  await notificationApiFetch({
    method: "POST",
    body: JSON.stringify({ action: "mark_read", notificationId })
  });
}

export async function markAllNotificationsRead() {
  await notificationApiFetch({
    method: "POST",
    body: JSON.stringify({ action: "mark_all_read" })
  });
}


export const DEFAULT_NOTIFICATION_PREFERENCES = {
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

export async function getNotificationPreferences() {
  const payload = await notificationApiFetch({ method: "GET" });
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(payload.preferences || {}),
    pushCategories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.pushCategories,
      ...(payload.preferences?.pushCategories || {})
    }
  };
}

export async function saveNotificationPreferences(uid, updates = {}) {
  if (!uid) throw new Error("A user profile is required to save notification preferences.");
  await notificationApiFetch({
    method: "POST",
    body: JSON.stringify({ action: "save_preferences", updates })
  });
}

