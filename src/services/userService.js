import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { INVITATION_STATUSES, STAFF_USER_ROLES, normalizeEmail } from "@/lib/constants/user";

function userActivity({ currentUser, recordId, action, title, description, metadata = {} }) {
  return {
    recordType: "user",
    recordId,
    advisorUid: currentUser.id,
    action,
    title,
    description,
    metadata,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  };
}

export function subscribeStaffUsers(callback, onError) {
  return onSnapshot(
    query(collection(db, "users"), where("role", "in", STAFF_USER_ROLES), orderBy("fullName")),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), recordState: "linked" }))),
    onError
  );
}

export function subscribeStaffInvitations(callback, onError) {
  return onSnapshot(
    query(collection(db, "staffInvitations"), orderBy("createdAt", "desc")),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), recordState: "invitation" }))),
    onError
  );
}

export async function getStaffUser(userId) {
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createStaffInvitation(payload, currentUser) {
  const email = normalizeEmail(payload.email);
  const existingUsers = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if (!existingUsers.empty) {
    throw new Error("A user profile already exists for this Microsoft email.");
  }

  const invitationRef = doc(db, "staffInvitations", email);
  const activityRef = doc(collection(db, "activityLogs"));

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(invitationRef);
    if (existing.exists() && existing.data().status === INVITATION_STATUSES.LINKED) {
      throw new Error("This Microsoft account is already linked to a user.");
    }

    transaction.set(invitationRef, {
      fullName: payload.fullName.trim(),
      email,
      role: payload.role,
      designation: payload.designation.trim(),
      advisorCode: payload.role === "advisor" ? payload.advisorCode.trim() : "",
      mobile: payload.mobile?.trim() || "",
      signatureEnabled: payload.signatureEnabled !== false,
      emailSignatureHtml: payload.emailSignatureHtml || "",
      status: INVITATION_STATUSES.PENDING,
      authMethod: "microsoft",
      linkedUid: null,
      invitedByUid: currentUser.id,
      invitedByName: currentUser.fullName,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.set(
      activityRef,
      userActivity({
        currentUser,
        recordId: email,
        action: "staff_invitation_created",
        title: "Staff access authorised",
        description: `${payload.fullName} was authorised as ${payload.role}.`,
        metadata: { email, role: payload.role }
      })
    );
  });

  return invitationRef;
}

export async function updateStaffUser(userId, payload, currentUser) {
  const userRef = doc(db, "users", userId);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);

  batch.update(userRef, {
    fullName: payload.fullName.trim(),
    role: payload.role,
    designation: payload.designation.trim(),
    advisorCode: payload.role === "advisor" ? payload.advisorCode.trim() : "",
    mobile: payload.mobile?.trim() || "",
    signatureEnabled: payload.signatureEnabled !== false,
    emailSignatureHtml: payload.emailSignatureHtml || "",
    status: payload.status,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName
  });

  batch.set(
    activityRef,
    userActivity({
      currentUser,
      recordId: userId,
      action: "staff_user_updated",
      title: "Staff access updated",
      description: `${payload.fullName} was updated as ${payload.role} (${payload.status}).`,
      metadata: { role: payload.role, status: payload.status }
    })
  );

  await batch.commit();
}

export async function setStaffUserStatus(user, status, currentUser) {
  if (user.id === currentUser.id && status !== "active") {
    throw new Error("You cannot deactivate your own account.");
  }
  await updateDoc(doc(db, "users", user.id), {
    status,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName
  });
}

export async function cancelStaffInvitation(invitation, currentUser) {
  const invitationRef = doc(db, "staffInvitations", invitation.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);

  batch.update(invitationRef, {
    status: INVITATION_STATUSES.CANCELLED,
    cancelledAt: serverTimestamp(),
    cancelledByUid: currentUser.id,
    updatedAt: serverTimestamp()
  });
  batch.set(
    activityRef,
    userActivity({
      currentUser,
      recordId: invitation.id,
      action: "staff_invitation_cancelled",
      title: "Staff invitation cancelled",
      description: `Access for ${invitation.email} was cancelled.`
    })
  );
  await batch.commit();
}
