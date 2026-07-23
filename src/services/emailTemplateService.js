import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  DEFAULT_EMAIL_TEMPLATE_ID,
  EMAIL_TEMPLATE_STATUS,
  SYSTEM_EMAIL_TEMPLATES,
  createEmailTemplateSnapshot,
  getSystemEmailTemplate
} from "@/lib/constants/emailTemplates";

function timestampValue(value) {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  return 0;
}

function mergeTemplate(base, remote = {}) {
  const snapshot = createEmailTemplateSnapshot({ ...(base || {}), ...(remote || {}) });
  return {
    ...(base || {}),
    ...(remote || {}),
    id: remote.id || base?.id || snapshot.id,
    content: snapshot.content,
    design: snapshot.design,
    signature: snapshot.signature,
    delivery: snapshot.delivery
  };
}

function mergeTemplates(remoteTemplates = []) {
  const merged = new Map(
    SYSTEM_EMAIL_TEMPLATES.map((item) => [item.id, { ...item, persisted: false }])
  );

  remoteTemplates.forEach((item) => {
    const base = getSystemEmailTemplate(item.id);
    merged.set(item.id, { ...mergeTemplate(base, item), persisted: true });
  });

  const statusRank = {
    [EMAIL_TEMPLATE_STATUS.ACTIVE]: 0,
    [EMAIL_TEMPLATE_STATUS.DRAFT]: 1,
    [EMAIL_TEMPLATE_STATUS.INACTIVE]: 2,
    [EMAIL_TEMPLATE_STATUS.ARCHIVED]: 3
  };

  return [...merged.values()].sort((a, b) => {
    if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
    const statusDifference = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (statusDifference) return statusDifference;
    const timeDifference = timestampValue(b.updatedAt) - timestampValue(a.updatedAt);
    if (timeDifference) return timeDifference;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function actorName(currentUser) {
  return currentUser?.fullName || currentUser?.email || "GrowVest User";
}

function slugify(value = "template") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "template";
}

function editablePayload(value, currentUser) {
  const snapshot = createEmailTemplateSnapshot(value);
  return {
    name: String(value.name || "Email Template").trim(),
    description: String(value.description || "").trim(),
    type: value.type || snapshot.type,
    content: snapshot.content,
    design: snapshot.design,
    signature: snapshot.signature,
    delivery: snapshot.delivery,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: actorName(currentUser)
  };
}

export function subscribeEmailTemplates(callback, onError) {
  callback(mergeTemplates([]), { fromFirestore: false });
  return onSnapshot(
    collection(db, "emailTemplates"),
    (snapshot) => callback(
      mergeTemplates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      { fromFirestore: true }
    ),
    (error) => {
      callback(mergeTemplates([]), { fromFirestore: false });
      onError?.(error);
    }
  );
}

export async function initialiseSystemEmailTemplates(currentUser) {
  const batch = writeBatch(db);
  let writes = 0;
  for (const template of SYSTEM_EMAIL_TEMPLATES) {
    const reference = doc(db, "emailTemplates", template.id);
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) continue;
    batch.set(reference, {
      ...template,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: currentUser.id,
      createdByName: actorName(currentUser),
      updatedByUid: currentUser.id,
      updatedByName: actorName(currentUser)
    });
    writes += 1;
  }
  if (writes) await batch.commit();
  return writes;
}

export async function getEmailTemplate(templateId) {
  const reference = doc(db, "emailTemplates", templateId);
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) {
    const remote = { id: snapshot.id, ...snapshot.data(), persisted: true };
    return mergeTemplate(getSystemEmailTemplate(templateId), remote);
  }
  const builtIn = getSystemEmailTemplate(templateId);
  return builtIn ? { ...builtIn, persisted: false } : null;
}

export async function getEmailTemplateForEditing(templateId) {
  const template = await getEmailTemplate(templateId);
  if (!template) return null;
  if (!template.draftConfig) return template;
  return {
    ...mergeTemplate(template, template.draftConfig),
    id: template.id,
    status: template.status,
    version: template.version,
    isDefault: template.isDefault,
    isSystemTemplate: template.isSystemTemplate,
    editingDraft: true
  };
}

export async function duplicateEmailTemplate(sourceTemplate, currentUser, overrides = {}) {
  const reference = doc(collection(db, "emailTemplates"));
  const name = String(overrides.name || `${sourceTemplate.name} — Copy`).trim();
  const snapshot = createEmailTemplateSnapshot(sourceTemplate);
  await setDoc(reference, {
    ...sourceTemplate,
    ...snapshot,
    ...overrides,
    name,
    slug: `${slugify(name)}-${reference.id.slice(0, 6).toLowerCase()}`,
    status: EMAIL_TEMPLATE_STATUS.DRAFT,
    isDefault: false,
    isSystemTemplate: false,
    sourceTemplateId: sourceTemplate.id,
    sourceTemplateVersion: Number(sourceTemplate.version || 1),
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: currentUser.id,
    createdByName: actorName(currentUser),
    updatedByUid: currentUser.id,
    updatedByName: actorName(currentUser)
  });
  return reference.id;
}

export async function saveEmailTemplateDraft(templateId, templateValue, currentUser) {
  const existing = await getEmailTemplate(templateId);
  if (!existing) throw new Error("Email template not found.");
  if (existing.isSystemTemplate) throw new Error("Duplicate the GrowVest standard template before editing it.");
  const payload = editablePayload(templateValue, currentUser);
  const reference = doc(db, "emailTemplates", templateId);

  if (existing.status === EMAIL_TEMPLATE_STATUS.ACTIVE) {
    await setDoc(reference, {
      draftConfig: payload,
      draftUpdatedAt: serverTimestamp(),
      draftUpdatedByUid: currentUser.id,
      draftUpdatedByName: actorName(currentUser)
    }, { merge: true });
    return { ...mergeTemplate(existing, templateValue), ...payload, id: templateId, status: existing.status, editingDraft: true };
  }

  await setDoc(reference, {
    ...payload,
    status: EMAIL_TEMPLATE_STATUS.DRAFT,
    isDefault: false,
    isSystemTemplate: false
  }, { merge: true });
  return { ...mergeTemplate(existing, templateValue), ...payload, id: templateId, status: EMAIL_TEMPLATE_STATUS.DRAFT, editingDraft: true };
}

export async function activateEmailTemplate(templateId, templateValue, currentUser) {
  const existing = await getEmailTemplate(templateId);
  if (!existing) throw new Error("Email template not found.");
  if (existing.isSystemTemplate) throw new Error("GrowVest standard templates are already active. Duplicate one to customise it.");
  const payload = editablePayload(templateValue, currentUser);
  const nextVersion = Number(existing.version || 0) + 1;
  const batch = writeBatch(db);
  const activatedAt = serverTimestamp();
  const templateRef = doc(db, "emailTemplates", templateId);
  const versionRef = doc(db, "emailTemplates", templateId, "versions", `v${nextVersion}`);

  batch.set(templateRef, {
    ...payload,
    status: EMAIL_TEMPLATE_STATUS.ACTIVE,
    version: nextVersion,
    activatedAt,
    activatedByUid: currentUser.id,
    activatedByName: actorName(currentUser),
    draftConfig: deleteField(),
    draftUpdatedAt: deleteField(),
    draftUpdatedByUid: deleteField(),
    draftUpdatedByName: deleteField(),
    isDefault: Boolean(existing.isDefault)
  }, { merge: true });
  batch.set(versionRef, {
    templateId,
    version: nextVersion,
    ...payload,
    status: EMAIL_TEMPLATE_STATUS.ACTIVE,
    createdAt: activatedAt,
    createdByUid: currentUser.id,
    createdByName: actorName(currentUser)
  });
  await batch.commit();
  return { ...mergeTemplate(existing, templateValue), ...payload, id: templateId, status: EMAIL_TEMPLATE_STATUS.ACTIVE, version: nextVersion, editingDraft: false };
}

export async function setDefaultEmailTemplate(templateId, currentUser) {
  await initialiseSystemEmailTemplates(currentUser);
  const snapshot = await getDocs(collection(db, "emailTemplates"));
  const batch = writeBatch(db);
  snapshot.docs.forEach((item) => batch.update(item.ref, {
    isDefault: item.id === templateId,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: actorName(currentUser)
  }));
  if (!snapshot.docs.some((item) => item.id === templateId)) {
    const builtIn = getSystemEmailTemplate(templateId || DEFAULT_EMAIL_TEMPLATE_ID);
    if (!builtIn) throw new Error("Email template not found.");
    batch.set(doc(db, "emailTemplates", builtIn.id), {
      ...builtIn,
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: currentUser.id,
      createdByName: actorName(currentUser),
      updatedByUid: currentUser.id,
      updatedByName: actorName(currentUser)
    });
  }
  await batch.commit();
}

export async function archiveEmailTemplate(templateId, currentUser) {
  const template = await getEmailTemplate(templateId);
  if (!template) throw new Error("Email template not found.");
  if (template.isSystemTemplate) throw new Error("Standard GrowVest templates cannot be archived.");
  if (template.isDefault) throw new Error("Select another default email template before archiving this one.");
  await updateDoc(doc(db, "emailTemplates", templateId), {
    status: EMAIL_TEMPLATE_STATUS.ARCHIVED,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: actorName(currentUser)
  });
}

export async function getEmailTemplateVersions(templateId) {
  const snapshot = await getDocs(collection(db, "emailTemplates", templateId, "versions"));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
}
