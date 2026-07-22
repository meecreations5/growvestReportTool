import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/constants/roles";
import {
  SYSTEM_REPORT_TEMPLATES,
  TEMPLATE_STATUS,
  getSystemReportTemplate
} from "@/lib/constants/reportTemplates";

function timestampValue(value) {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  return 0;
}

function mergeTemplates(remoteTemplates = []) {
  const merged = new Map(
    SYSTEM_REPORT_TEMPLATES.map((item) => [item.id, { ...item, persisted: false }])
  );

  remoteTemplates.forEach((item) => {
    const base = getSystemReportTemplate(item.id);
    merged.set(item.id, {
      ...(base || {}),
      ...item,
      id: item.id,
      persisted: true,
      appearance: {
        ...(base?.appearance || {}),
        ...(item.appearance || {})
      },
      sectionVisibility: {
        ...(base?.sectionVisibility || {}),
        ...(item.sectionVisibility || {})
      }
    });
  });

  const statusRank = {
    [TEMPLATE_STATUS.ACTIVE]: 0,
    [TEMPLATE_STATUS.DRAFT]: 1,
    [TEMPLATE_STATUS.INACTIVE]: 2,
    [TEMPLATE_STATUS.ARCHIVED]: 3
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

function systemTemplateDocument(template, currentUser) {
  return {
    ...template,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: currentUser?.id || null,
    createdByName: currentUser?.fullName || "GrowVest",
    updatedByUid: currentUser?.id || null,
    updatedByName: currentUser?.fullName || "GrowVest"
  };
}

function templateSlug(value = "template") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "template";
}

export function subscribeReportTemplates(currentUser, callback, onError) {
  callback(mergeTemplates([]), { fromFirestore: false });
  const reference = currentUser?.role === USER_ROLES.ADVISOR
    ? query(collection(db, "reportTemplates"), where("status", "==", TEMPLATE_STATUS.ACTIVE))
    : collection(db, "reportTemplates");

  return onSnapshot(
    reference,
    (snapshot) => {
      const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      callback(mergeTemplates(rows), { fromFirestore: true });
    },
    (error) => {
      callback(mergeTemplates([]), { fromFirestore: false });
      onError?.(error);
    }
  );
}

export async function initialiseSystemReportTemplates(currentUser) {
  const batch = writeBatch(db);
  let writes = 0;

  for (const template of SYSTEM_REPORT_TEMPLATES) {
    const reference = doc(db, "reportTemplates", template.id);
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) continue;
    batch.set(reference, systemTemplateDocument(template, currentUser));
    writes += 1;
  }

  if (writes) await batch.commit();
  return writes;
}

export async function getReportTemplate(templateId) {
  const reference = doc(db, "reportTemplates", templateId);
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) {
    const remote = { id: snapshot.id, ...snapshot.data(), persisted: true };
    const base = getSystemReportTemplate(templateId);
    return {
      ...(base || {}),
      ...remote,
      appearance: { ...(base?.appearance || {}), ...(remote.appearance || {}) },
      sectionVisibility: { ...(base?.sectionVisibility || {}), ...(remote.sectionVisibility || {}) }
    };
  }

  const builtIn = getSystemReportTemplate(templateId);
  return builtIn ? { ...builtIn, persisted: false } : null;
}

export async function getReportTemplateForEditing(templateId) {
  const template = await getReportTemplate(templateId);
  if (!template) return null;
  const draft = template.draftConfig;
  if (!draft) return template;

  return {
    ...template,
    ...draft,
    id: template.id,
    status: template.status,
    isDefault: template.isDefault,
    isSystemTemplate: template.isSystemTemplate,
    version: template.version,
    editingDraft: true,
    appearance: {
      ...(template.appearance || {}),
      ...(draft.appearance || {}),
      document: {
        ...(template.appearance?.document || {}),
        ...(draft.appearance?.document || {})
      }
    },
    sectionVisibility: {
      ...(template.sectionVisibility || {}),
      ...(draft.sectionVisibility || {})
    }
  };
}

export async function duplicateReportTemplate(sourceTemplate, currentUser, overrides = {}) {
  const reference = doc(collection(db, "reportTemplates"));
  const name = overrides.name?.trim() || `${sourceTemplate.name} — Copy`;
  const now = serverTimestamp();

  const payload = {
    ...sourceTemplate,
    ...overrides,
    id: undefined,
    name,
    slug: `${templateSlug(name)}-${reference.id.slice(0, 6).toLowerCase()}`,
    category: "custom",
    status: TEMPLATE_STATUS.DRAFT,
    isDefault: false,
    isSystemTemplate: false,
    sourceTemplateId: sourceTemplate.id,
    sourceTemplateVersion: Number(sourceTemplate.version || 1),
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName || currentUser.email || "GrowVest User",
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName || currentUser.email || "GrowVest User"
  };

  delete payload.persisted;
  delete payload.id;

  await setDoc(reference, payload);
  return reference.id;
}

export async function setDefaultReportTemplate(templateId, currentUser) {
  await initialiseSystemReportTemplates(currentUser);
  const snapshot = await getDocs(collection(db, "reportTemplates"));
  const batch = writeBatch(db);

  snapshot.docs.forEach((item) => {
    batch.update(item.ref, {
      isDefault: item.id === templateId,
      updatedAt: serverTimestamp(),
      updatedByUid: currentUser.id,
      updatedByName: currentUser.fullName || currentUser.email || "GrowVest User"
    });
  });

  if (!snapshot.docs.some((item) => item.id === templateId)) {
    const builtIn = getSystemReportTemplate(templateId);
    if (!builtIn) throw new Error("Template not found.");
    batch.set(doc(db, "reportTemplates", templateId), {
      ...systemTemplateDocument({ ...builtIn, isDefault: true }, currentUser)
    });
  }

  await batch.commit();
}

export async function archiveReportTemplate(templateId, currentUser) {
  const template = await getReportTemplate(templateId);
  if (!template) throw new Error("Template not found.");
  if (template.isSystemTemplate) throw new Error("Standard GrowVest templates cannot be archived.");
  if (template.isDefault) throw new Error("Select another default template before archiving this template.");

  await updateDoc(doc(db, "reportTemplates", templateId), {
    status: TEMPLATE_STATUS.ARCHIVED,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName || currentUser.email || "GrowVest User"
  });
}

export async function restoreReportTemplate(templateId, currentUser) {
  await updateDoc(doc(db, "reportTemplates", templateId), {
    status: TEMPLATE_STATUS.DRAFT,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName || currentUser.email || "GrowVest User"
  });
}

function editableTemplatePayload(templateValue, currentUser) {
  return {
    name: String(templateValue.name || "Custom Report Template").trim(),
    description: String(templateValue.description || "").trim(),
    category: templateValue.category || "custom",
    estimatedPages: templateValue.estimatedPages || "6–9 pages",
    sectionOrder: Array.isArray(templateValue.sectionOrder) ? templateValue.sectionOrder : [],
    sectionVisibility: { ...(templateValue.sectionVisibility || {}) },
    appearance: {
      ...(templateValue.appearance || {}),
      document: {
        showLogo: templateValue.appearance?.document?.showLogo !== false,
        showClientCode: templateValue.appearance?.document?.showClientCode !== false,
        showReportMonth: templateValue.appearance?.document?.showReportMonth !== false,
        showConfidentialLabel: templateValue.appearance?.document?.showConfidentialLabel !== false,
        showPageNumbers: templateValue.appearance?.document?.showPageNumbers !== false,
        showContactInformation: templateValue.appearance?.document?.showContactInformation !== false,
        disclaimerStyle: templateValue.appearance?.document?.disclaimerStyle || "standard"
      }
    },
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName || currentUser.email || "GrowVest User"
  };
}

export async function saveReportTemplateDraft(templateId, templateValue, currentUser) {
  const existing = await getReportTemplate(templateId);
  if (!existing) throw new Error("Template not found.");
  if (existing.isSystemTemplate) throw new Error("Duplicate this GrowVest standard template before editing it.");

  const payload = editableTemplatePayload(templateValue, currentUser);
  const reference = doc(db, "reportTemplates", templateId);

  if (existing.status === TEMPLATE_STATUS.ACTIVE) {
    await setDoc(reference, {
      draftConfig: payload,
      draftUpdatedAt: serverTimestamp(),
      draftUpdatedByUid: currentUser.id,
      draftUpdatedByName: currentUser.fullName || currentUser.email || "GrowVest User"
    }, { merge: true });

    return {
      id: templateId,
      ...existing,
      ...templateValue,
      ...payload,
      status: TEMPLATE_STATUS.ACTIVE,
      isDefault: Boolean(existing.isDefault),
      editingDraft: true
    };
  }

  await setDoc(reference, {
    ...payload,
    status: TEMPLATE_STATUS.DRAFT,
    isDefault: false,
    isSystemTemplate: false
  }, { merge: true });

  return {
    id: templateId,
    ...existing,
    ...templateValue,
    ...payload,
    status: TEMPLATE_STATUS.DRAFT,
    isDefault: false,
    editingDraft: true
  };
}

export async function activateReportTemplate(templateId, templateValue, currentUser) {
  const existing = await getReportTemplate(templateId);
  if (!existing) throw new Error("Template not found.");
  if (existing.isSystemTemplate) throw new Error("GrowVest standard templates are already active. Duplicate one to create an editable version.");

  const nextVersion = Number(existing.version || 0) + 1;
  const payload = editableTemplatePayload(templateValue, currentUser);
  const activatedAt = serverTimestamp();
  const batch = writeBatch(db);
  const templateRef = doc(db, "reportTemplates", templateId);
  const versionRef = doc(db, "reportTemplates", templateId, "versions", `v${nextVersion}`);

  batch.set(templateRef, {
    ...payload,
    status: TEMPLATE_STATUS.ACTIVE,
    version: nextVersion,
    activatedAt,
    activatedByUid: currentUser.id,
    activatedByName: currentUser.fullName || currentUser.email || "GrowVest User",
    draftConfig: deleteField(),
    draftUpdatedAt: deleteField(),
    draftUpdatedByUid: deleteField(),
    draftUpdatedByName: deleteField(),
    isDefault: Boolean(existing.isDefault)
  }, { merge: true });

  batch.set(versionRef, {
    templateId,
    version: nextVersion,
    name: payload.name,
    description: payload.description,
    category: payload.category,
    estimatedPages: payload.estimatedPages,
    sectionOrder: payload.sectionOrder,
    sectionVisibility: payload.sectionVisibility,
    appearance: payload.appearance,
    status: TEMPLATE_STATUS.ACTIVE,
    createdAt: activatedAt,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName || currentUser.email || "GrowVest User"
  });

  await batch.commit();
  return {
    id: templateId,
    ...existing,
    ...templateValue,
    ...payload,
    status: TEMPLATE_STATUS.ACTIVE,
    version: nextVersion,
    isDefault: Boolean(existing.isDefault),
    editingDraft: false,
    draftConfig: undefined
  };
}

export async function getReportTemplateVersions(templateId) {
  const snapshot = await getDocs(collection(db, "reportTemplates", templateId, "versions"));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
}
