import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
      query(collection(db, "notifications"), where("investorId", "==", profile.investorId)),
      (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
        const left = typeof a.createdAt?.toDate === "function" ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const right = typeof b.createdAt?.toDate === "function" ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return right - left;
      }).slice(0, 50)),
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
