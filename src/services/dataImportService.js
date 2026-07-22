import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/constants/roles";
import { DATA_IMPORT_STATUS } from "@/lib/constants/dataImport";

function isAdmin(currentUser) {
  return [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser?.role);
}

function rowsFromSnapshot(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function serialise(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

function sortImports(items = []) {
  return [...items].sort((a, b) => {
    const aValue = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
    const bValue = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
    return bValue - aValue;
  });
}

export function subscribeDataImports(currentUser, callback, onError) {
  const constraints = isAdmin(currentUser)
    ? [orderBy("createdAt", "desc"), limit(100)]
    : [where("advisorUid", "==", currentUser.id), orderBy("createdAt", "desc"), limit(100)];

  let fallbackUnsubscribe = () => {};
  const primaryUnsubscribe = onSnapshot(
    query(collection(db, "dataImports"), ...constraints),
    (snapshot) => callback(rowsFromSnapshot(snapshot)),
    (error) => {
      const isMissingIndex = error?.code === "failed-precondition" || /index/i.test(error?.message || "");
      if (!isMissingIndex || isAdmin(currentUser)) {
        onError?.(error);
        return;
      }
      fallbackUnsubscribe = onSnapshot(
        query(collection(db, "dataImports"), where("advisorUid", "==", currentUser.id)),
        (snapshot) => callback(sortImports(rowsFromSnapshot(snapshot)).slice(0, 100)),
        onError
      );
    }
  );

  return () => {
    primaryUnsubscribe();
    fallbackUnsubscribe();
  };
}

export async function getDataImport(importId) {
  const snapshot = await getDoc(doc(db, "dataImports", importId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createDataImport(payload, currentUser) {
  const created = await addDoc(collection(db, "dataImports"), serialise({
    investorId: payload.investorId,
    investorName: payload.investorName || "",
    clientCode: payload.clientCode || "",
    advisorUid: payload.advisorUid || currentUser.id,
    advisorName: payload.advisorName || currentUser.fullName || "",
    reportMonth: Number(payload.reportMonth),
    reportYear: Number(payload.reportYear),
    reportMonthKey: payload.reportMonthKey,
    sourceLabel: payload.sourceLabel || "Manual file upload",
    fileName: payload.fileName || "",
    fileSize: Number(payload.fileSize || 0),
    fileType: payload.fileType || "",
    sheetName: payload.sheetName || "",
    headers: payload.headers || [],
    mapping: payload.mapping || {},
    rows: payload.rows || [],
    validationSummary: payload.validationSummary || {},
    reportPayload: payload.reportPayload || {},
    status: payload.status || DATA_IMPORT_STATUS.READY,
    targetReportId: payload.targetReportId || null,
    importedReportId: null,
    importedAt: null,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  return created.id;
}

export async function linkDataImportToReport(importId, reportId, currentUser) {
  if (!importId || !reportId) return;
  await updateDoc(doc(db, "dataImports", importId), {
    status: DATA_IMPORT_STATUS.IMPORTED,
    importedReportId: reportId,
    importedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName || "",
    updatedAt: serverTimestamp()
  });
}

export async function archiveDataImport(importId, currentUser) {
  await updateDoc(doc(db, "dataImports", importId), {
    status: DATA_IMPORT_STATUS.ARCHIVED,
    archivedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName || "",
    updatedAt: serverTimestamp()
  });
}
