import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

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

export function subscribeNotifications(profileOrUid, callback, onError) {
  const profile = typeof profileOrUid === "string" ? { id: profileOrUid } : profileOrUid;
  if (!profile?.id) return () => {};

  if (profile.role === "investor" && profile.investorId) {
    return onSnapshot(
      query(
        collection(db, "notifications"),
        where("investorId", "==", profile.investorId),
        orderBy("createdAt", "desc"),
        limit(50)
      ),
      (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      onError
    );
  }

  return onSnapshot(
    query(collection(db, "notifications"), where("recipientUid", "==", profile.id), orderBy("createdAt", "desc"), limit(50)),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, "notifications", notificationId), {
    status: "read",
    readAt: serverTimestamp()
  });
}

export async function markAllNotificationsRead(items = []) {
  const unread = items.filter((item) => item.status !== "read");
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((item) => {
    batch.update(doc(db, "notifications", item.id), {
      status: "read",
      readAt: serverTimestamp()
    });
  });
  await batch.commit();
}


export const DEFAULT_NOTIFICATION_PREFERENCES = {
  inAppEnabled: true,
  pushEnabled: false,
  pushCategories: {
    reports: true,
    meetings: true,
    documents: true,
    general: true
  }
};

export async function getNotificationPreferences(uid) {
  if (!uid) return DEFAULT_NOTIFICATION_PREFERENCES;
  const snapshot = await getDoc(doc(db, "notificationPreferences", uid));
  if (!snapshot.exists()) return DEFAULT_NOTIFICATION_PREFERENCES;
  const data = snapshot.data();
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...data,
    pushCategories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.pushCategories,
      ...(data.pushCategories || {})
    }
  };
}

export async function saveNotificationPreferences(uid, updates = {}) {
  if (!uid) throw new Error("A user profile is required to save notification preferences.");
  await setDoc(doc(db, "notificationPreferences", uid), {
    recipientUid: uid,
    ...updates,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
