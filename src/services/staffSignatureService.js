import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import {
  DEFAULT_EMAIL_SIGNATURE,
  EMAIL_SIGNATURE_STATUSES
} from "@/lib/constants/emailSignature";
import { normaliseEmailSignature, renderEmailSignatureHtml } from "@/lib/utils/emailSignature";

function actor(profile = {}) {
  return {
    uid: profile.id || profile.uid || auth.currentUser?.uid || "",
    name: profile.fullName || profile.displayName || profile.email || "GrowVest User"
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

export function buildSignatureDraft(user = {}, branding = {}) {
  const published = user.emailSignature || {};
  const draft = user.emailSignatureDraft || published;
  return normaliseEmailSignature({
    ...DEFAULT_EMAIL_SIGNATURE,
    ...draft
  }, user, branding);
}

export function subscribeStaffSignatureUser(userId, callback, onError) {
  return onSnapshot(doc(db, "users", userId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function subscribeSignatureVersions(userId, callback, onError, count = 12) {
  const versionsQuery = query(
    collection(db, "users", userId, "signatureVersions"),
    orderBy("version", "desc"),
    limit(count)
  );
  return onSnapshot(versionsQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function getStaffSignatureUser(userId) {
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function uploadStaffSignatureAsset({ userId, file, assetType, onProgress }) {
  if (!userId) throw new Error("Staff user is required before uploading signature artwork.");
  if (!file) throw new Error("Choose an image to upload.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use a PNG, JPG or WebP image.");
  }
  const maxBytes = assetType === "handwritten-name" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(assetType === "handwritten-name" ? "Handwritten-name artwork must be 2 MB or smaller." : "Signature artwork must be 5 MB or smaller.");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `staff-signatures/${userId}/${assetType}/${Date.now()}-${safeName}`;
  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type,
    customMetadata: { userId, assetType }
  });

  return new Promise((resolve, reject) => {
    task.on("state_changed", (snapshot) => {
      const progress = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      onProgress?.(progress);
    }, reject, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      resolve({ url, storagePath: path, fileName: file.name, size: file.size, contentType: file.type });
    });
  });
}

export async function saveSignatureDraft(userId, signature, currentUser, branding = {}, options = {}) {
  const userRef = doc(db, "users", userId);
  const current = actor(currentUser);
  const normalised = normaliseEmailSignature(signature, options.user || {}, branding);
  const status = options.status || EMAIL_SIGNATURE_STATUSES.DRAFT;
  const existingMeta = options.meta || {};
  const batch = writeBatch(db);
  batch.update(userRef, {
    emailSignatureDraft: normalised,
    emailSignatureMeta: {
      ...existingMeta,
      status,
      version: Number(existingMeta.version || options.version || options.currentVersion || 0),
      reviewNote: String(options.reviewNote ?? existingMeta.reviewNote ?? ""),
      lastDraftSavedAt: serverTimestamp(),
      lastDraftSavedByUid: current.uid,
      lastDraftSavedByName: current.name,
      lastPublishedAt: existingMeta.lastPublishedAt || null,
      lastPublishedByUid: existingMeta.lastPublishedByUid || "",
      lastPublishedByName: existingMeta.lastPublishedByName || ""
    },
    updatedAt: serverTimestamp(),
    updatedByUid: current.uid,
    updatedByName: current.name
  });
  if (options.logActivity !== false) {
    batch.set(doc(collection(db, "activityLogs")), activityPayload({
      currentUser,
      recordId: userId,
      action: status === EMAIL_SIGNATURE_STATUSES.PENDING ? "email_signature_submitted" : "email_signature_draft_saved",
      title: status === EMAIL_SIGNATURE_STATUSES.PENDING ? "Email signature submitted" : "Email signature draft saved",
      description: status === EMAIL_SIGNATURE_STATUSES.PENDING
        ? `${normalised.fullName} submitted an email signature for approval.`
        : `${normalised.fullName} email signature draft was updated.`,
      metadata: { status, mode: normalised.mode }
    }));
  }
  await batch.commit();
  return normalised;
}

export async function submitSignatureForApproval(userId, signature, currentUser, branding = {}, user = {}) {
  return saveSignatureDraft(userId, signature, currentUser, branding, {
    user,
    status: EMAIL_SIGNATURE_STATUSES.PENDING
  });
}

export async function publishSignature(userId, signature, currentUser, branding = {}, user = {}) {
  const userRef = doc(db, "users", userId);
  const current = actor(currentUser);
  const normalised = normaliseEmailSignature(signature, user, branding);
  const html = renderEmailSignatureHtml({ signature: normalised, user, branding });

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) throw new Error("Staff user was not found.");
    const record = snapshot.data();
    const currentVersion = Number(record.emailSignatureMeta?.version || record.emailSignature?.version || 0);
    const nextVersion = currentVersion + 1;
    const timestamp = serverTimestamp();
    const published = { ...normalised, version: nextVersion };
    const versionRef = doc(db, "users", userId, "signatureVersions", `v${nextVersion}`);
    const activityRef = doc(collection(db, "activityLogs"));

    transaction.update(userRef, {
      emailSignature: published,
      emailSignatureDraft: published,
      emailSignatureMeta: {
        status: EMAIL_SIGNATURE_STATUSES.PUBLISHED,
        version: nextVersion,
        reviewNote: "",
        lastDraftSavedAt: timestamp,
        lastDraftSavedByUid: current.uid,
        lastDraftSavedByName: current.name,
        lastPublishedAt: timestamp,
        lastPublishedByUid: current.uid,
        lastPublishedByName: current.name
      },
      signatureEnabled: published.enabled !== false,
      emailSignatureHtml: html,
      updatedAt: timestamp,
      updatedByUid: current.uid,
      updatedByName: current.name
    });
    transaction.set(versionRef, {
      version: nextVersion,
      signature: published,
      publishedByUid: current.uid,
      publishedByName: current.name,
      publishedAt: timestamp
    });
    transaction.set(activityRef, activityPayload({
      currentUser,
      recordId: userId,
      action: "email_signature_published",
      title: "Email signature published",
      description: `${published.fullName} email signature version ${nextVersion} was published.`,
      metadata: { version: nextVersion, mode: published.mode }
    }));
    return nextVersion;
  });
}

export async function requestSignatureChanges(userId, reviewNote, currentUser) {
  const userRef = doc(db, "users", userId);
  const current = actor(currentUser);
  const batch = writeBatch(db);
  batch.update(userRef, {
    "emailSignatureMeta.status": EMAIL_SIGNATURE_STATUSES.CHANGES_REQUIRED,
    "emailSignatureMeta.reviewNote": String(reviewNote || "Please review the signature details."),
    updatedAt: serverTimestamp(),
    updatedByUid: current.uid,
    updatedByName: current.name
  });
  batch.set(doc(collection(db, "activityLogs")), activityPayload({
    currentUser,
    recordId: userId,
    action: "email_signature_changes_requested",
    title: "Email signature changes requested",
    description: String(reviewNote || "Changes were requested for the email signature."),
    metadata: { status: EMAIL_SIGNATURE_STATUSES.CHANGES_REQUIRED }
  }));
  await batch.commit();
}

export async function restoreSignatureVersion(userId, version, currentUser) {
  if (!version?.signature) throw new Error("The selected signature version is unavailable.");
  const current = actor(currentUser);
  await updateDoc(doc(db, "users", userId), {
    emailSignatureDraft: version.signature,
    emailSignatureMeta: {
      status: EMAIL_SIGNATURE_STATUSES.DRAFT,
      version: Number(version.version || 0),
      reviewNote: "",
      lastDraftSavedAt: serverTimestamp(),
      lastDraftSavedByUid: current.uid,
      lastDraftSavedByName: current.name
    },
    updatedAt: serverTimestamp(),
    updatedByUid: current.uid,
    updatedByName: current.name
  });
}

export async function sendSignatureTestEmail(userId, useDraft = true) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to send a signature test email.");
  const headers = await authenticatedApiHeaders({ "Content-Type": "application/json" }, user);
  const response = await fetch("/api/communications/signature-test", {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, useDraft })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Signature test email could not be sent.");
  return result;
}
