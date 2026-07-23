import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { INVITATION_STATUSES, STAFF_USER_ROLES, normalizeEmail } from "@/lib/constants/user";
import { USER_ROLES } from "@/lib/constants/roles";

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

export function subscribeStaffAccessActivity(callback, onError) {
  return onSnapshot(
    query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(200)),
    (snapshot) => callback(
      snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.recordType === "user")
        .slice(0, 100)
    ),
    onError
  );
}

export async function getStaffUser(userId) {
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function ensureSuperAdminContinuity(targetUser, nextRole, nextStatus) {
  const removesSuperAdminAccess = targetUser?.role === USER_ROLES.SUPER_ADMIN
    && (nextRole !== USER_ROLES.SUPER_ADMIN || nextStatus !== "active");

  if (!removesSuperAdminAccess) return;

  const activeSuperAdmins = await getDocs(
    query(
      collection(db, "users"),
      where("role", "==", USER_ROLES.SUPER_ADMIN),
      where("status", "==", "active")
    )
  );

  if (activeSuperAdmins.size <= 1) {
    throw new Error("At least one active Super Admin must remain in the system.");
  }
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
  const currentSnapshot = await getDoc(doc(db, "users", userId));
  if (!currentSnapshot.exists()) throw new Error("Staff user not found.");

  const existingUser = { id: currentSnapshot.id, ...currentSnapshot.data() };
  if (userId === currentUser.id && payload.status !== "active") {
    throw new Error("You cannot deactivate your own account.");
  }
  if (userId === currentUser.id && payload.role !== existingUser.role) {
    throw new Error("You cannot change your own application role.");
  }

  await ensureSuperAdminContinuity(existingUser, payload.role, payload.status);

  const userRef = doc(db, "users", userId);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const roleChanged = existingUser.role !== payload.role;
  const statusChanged = existingUser.status !== payload.status;

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
      action: roleChanged ? "staff_role_changed" : statusChanged ? "staff_status_changed" : "staff_user_updated",
      title: roleChanged ? "Staff role changed" : statusChanged ? "Staff access status changed" : "Staff access updated",
      description: roleChanged
        ? `${payload.fullName} changed from ${existingUser.role} to ${payload.role}.`
        : statusChanged
          ? `${payload.fullName} access changed from ${existingUser.status} to ${payload.status}.`
          : `${payload.fullName} staff access details were updated.`,
      metadata: {
        previousRole: existingUser.role,
        role: payload.role,
        previousStatus: existingUser.status,
        status: payload.status
      }
    })
  );

  await batch.commit();
}

export async function setStaffUserStatus(user, status, currentUser) {
  if (user.id === currentUser.id && status !== "active") {
    throw new Error("You cannot deactivate your own account.");
  }

  await ensureSuperAdminContinuity(user, user.role, status);

  const userRef = doc(db, "users", user.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);

  batch.update(userRef, {
    status,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName
  });

  batch.set(
    activityRef,
    userActivity({
      currentUser,
      recordId: user.id,
      action: status === "active" ? "staff_access_activated" : "staff_access_deactivated",
      title: status === "active" ? "Staff access activated" : "Staff access deactivated",
      description: `${user.fullName} access was changed to ${status}.`,
      metadata: { previousStatus: user.status, status, role: user.role }
    })
  );

  await batch.commit();
}

export async function cancelStaffInvitation(invitation, currentUser) {
  const invitationRef = doc(db, "staffInvitations", invitation.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);

  batch.update(invitationRef, {
    status: INVITATION_STATUSES.CANCELLED,
    cancelledAt: serverTimestamp(),
    cancelledByUid: currentUser.id,
    cancelledByName: currentUser.fullName,
    updatedAt: serverTimestamp()
  });
  batch.set(
    activityRef,
    userActivity({
      currentUser,
      recordId: invitation.id,
      action: "staff_invitation_cancelled",
      title: "Staff authorisation cancelled",
      description: `Access for ${invitation.email} was cancelled.`,
      metadata: { email: invitation.email, role: invitation.role }
    })
  );
  await batch.commit();
}
