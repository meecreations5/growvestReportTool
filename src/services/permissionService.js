import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  normalisePermissionOverrides,
  normaliseRolePermissions
} from "@/lib/constants/permissions";

function actor(profile = {}) {
  return {
    uid: profile.id || profile.uid || "",
    name: profile.fullName || profile.displayName || profile.email || "GrowVest Admin"
  };
}

function activityPayload({ currentUser, recordId, action, title, description, metadata = {} }) {
  const user = actor(currentUser);
  return {
    recordType: "user",
    recordId,
    advisorUid: user.uid,
    action,
    title,
    description,
    metadata,
    createdByUid: user.uid,
    createdByName: user.name,
    createdAt: serverTimestamp()
  };
}

export function subscribePermissionSettings(callback, onError) {
  return onSnapshot(doc(db, "reportSettings", "global"), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    callback({
      rolePermissions: normaliseRolePermissions(data.accessControl?.rolePermissions || DEFAULT_ROLE_PERMISSIONS),
      meta: data.accessControl?.meta || {}
    });
  }, onError);
}

export async function saveRolePermissions(rolePermissions, currentUser) {
  const normalised = normaliseRolePermissions(rolePermissions);
  const user = actor(currentUser);
  const batch = writeBatch(db);

  batch.set(doc(db, "reportSettings", "global"), {
    accessControl: {
      rolePermissions: normalised,
      meta: {
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
        updatedByName: user.name
      }
    },
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
    updatedByName: user.name
  }, { merge: true });

  batch.set(doc(collection(db, "activityLogs")), activityPayload({
    currentUser,
    recordId: "role-permissions",
    action: "role_permissions_updated",
    title: "Role permissions updated",
    description: `${user.name} updated the role-based permission matrix.`,
    metadata: { scope: "role" }
  }));

  await batch.commit();
  return normalised;
}

export async function saveUserPermissionOverrides(userId, overrides, currentUser, targetUser = {}) {
  const normalised = normalisePermissionOverrides(overrides);
  const user = actor(currentUser);
  const batch = writeBatch(db);

  batch.update(doc(db, "users", userId), {
    permissionOverrides: normalised,
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
    updatedByName: user.name
  });

  batch.set(doc(collection(db, "activityLogs")), activityPayload({
    currentUser,
    recordId: userId,
    action: "user_permissions_updated",
    title: "User permissions updated",
    description: `${targetUser.fullName || targetUser.email || "Staff user"} permission overrides were updated.`,
    metadata: { scope: "user", overrideCount: Object.keys(normalised).length }
  }));

  await batch.commit();
  return normalised;
}
