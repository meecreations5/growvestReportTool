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
import { deleteObject, getBlob, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { notifyInvestorDocumentUploaded } from "@/services/communicationService";
import { refreshInvestorStatusSummary } from "@/services/investorStatusService";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function safeFileName(value = "document") {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

export function subscribeInvestorDocuments(investorId, callback, onError) {
  if (!investorId) return () => {};
  return onSnapshot(
    query(
      collection(db, "investorDocuments"),
      where("investorId", "==", investorId),
      orderBy("createdAt", "desc"),
      limit(100)
    ),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

function timestampToMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
  }
  return 0;
}

/**
 * Investor Portal queries must include investorVisible == true because
 * Firestore security rules are not filters. Without this constraint,
 * Firestore cannot prove that every possible result is readable by the
 * signed-in Investor and rejects the query with permission-denied.
 *
 * The results are sorted client-side so this query does not require a new
 * composite index merely to order by createdAt.
 */
export function subscribeInvestorPortalDocuments(investorId, callback, onError) {
  if (!investorId) return () => {};

  return onSnapshot(
    query(
      collection(db, "investorDocuments"),
      where("investorId", "==", investorId),
      where("investorVisible", "==", true),
      limit(100)
    ),
    (snapshot) => {
      const records = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => timestampToMillis(right.createdAt) - timestampToMillis(left.createdAt));

      callback(records);
    },
    onError
  );
}

export async function requestInvestorDocument(investor, currentUser, { title, documentType, notes = "", dueDate = "" }) {
  if (!investor?.id || !currentUser?.id) throw new Error("Investor and staff profile are required.");
  if (!title?.trim()) throw new Error("Document title is required.");
  const batch = writeBatch(db);
  const documentRef = doc(collection(db, "investorDocuments"));
  batch.set(documentRef, {
    investorId: investor.id,
    investorName: investor.fullName || "",
    clientCode: investor.clientCode || "",
    investorUid: investor.portalUid || investor.investorPortalUid || null,
    advisorUid: investor.advisorUid || investor.assignedAdvisorUid || currentUser.id,
    title: title.trim(),
    documentType: documentType || "Other",
    notes: notes.trim(),
    dueDate: dueDate || "",
    status: "requested",
    investorVisible: true,
    storagePath: null,
    fileName: null,
    mimeType: null,
    sizeBytes: null,
    requestedByUid: currentUser.id,
    requestedByName: currentUser.fullName || currentUser.email || "GrowVest",
    requestedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (investor.portalUid || investor.investorPortalUid) {
    const notificationRef = doc(collection(db, "notifications"));
    batch.set(notificationRef, {
      recipientUid: investor.portalUid || investor.investorPortalUid,
      recipientType: "investor",
      title: "Document requested",
      message: `GrowVest requested: ${title.trim()}.`,
      eventType: "investor_document_requested",
      link: "/investor/documents",
      investorId: investor.id,
      documentId: documentRef.id,
      createdByUid: currentUser.id,
      status: "unread",
      createdAt: serverTimestamp(),
      readAt: null
    });
  }
  await batch.commit();
  try { await refreshInvestorStatusSummary(investor.id); } catch (error) { console.warn("Investor status summary could not be refreshed", error); }
  return documentRef.id;
}

export async function uploadInvestorDocument(documentRecord, file, currentUser) {
  if (!documentRecord?.id || !file || !currentUser?.id) throw new Error("Document request, file and user profile are required.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Upload a PDF, JPG or PNG file.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File size must be 10 MB or less.");
  const storagePath = `investor-documents/${documentRecord.investorId}/${documentRecord.id}/${Date.now()}-${safeFileName(file.name)}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      investorId: documentRecord.investorId,
      documentId: documentRecord.id,
      uploadedByUid: currentUser.id,
      uploadedByRole: currentUser.role || "user"
    }
  });

  const batch = writeBatch(db);
  const documentRef = doc(db, "investorDocuments", documentRecord.id);
  batch.update(documentRef, {
    storagePath,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    status: "uploaded",
    uploadedByUid: currentUser.id,
    uploadedByRole: currentUser.role,
    uploadedByName: currentUser.fullName || "User",
    uploadedAt: serverTimestamp(),
    verificationNote: "",
    verifiedAt: null,
    verifiedByUid: null,
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  try { await refreshInvestorStatusSummary(documentRecord.investorId); } catch (error) { console.warn("Investor status summary could not be refreshed", error); }
  try {
    await notifyInvestorDocumentUploaded(documentRecord.id);
  } catch (error) {
    console.warn("Document uploaded but Advisor notification could not be created", error);
  }
  return storagePath;
}

export async function updateInvestorDocumentStatus(documentRecord, currentUser, status, verificationNote = "") {
  if (!documentRecord?.id || !currentUser?.id) throw new Error("Document and staff profile are required.");
  if (!["verified", "rejected", "expired", "requested"].includes(status)) throw new Error("Invalid document status.");
  const batch = writeBatch(db);
  batch.update(doc(db, "investorDocuments", documentRecord.id), {
    status,
    verificationNote: verificationNote.trim(),
    verifiedAt: status === "verified" ? serverTimestamp() : null,
    verifiedByUid: status === "verified" ? currentUser.id : null,
    verifiedByName: status === "verified" ? currentUser.fullName || "GrowVest" : null,
    updatedAt: serverTimestamp()
  });
  if (documentRecord.investorUid) {
    const notificationRef = doc(collection(db, "notifications"));
    batch.set(notificationRef, {
      recipientUid: documentRecord.investorUid,
      recipientType: "investor",
      title: status === "verified" ? "Document verified" : status === "rejected" ? "Document requires attention" : "Document status updated",
      message: `${documentRecord.title || "Your document"} is now ${status}.`,
      eventType: `investor_document_${status}`,
      link: "/investor/documents",
      investorId: documentRecord.investorId,
      documentId: documentRecord.id,
      createdByUid: currentUser.id,
      status: "unread",
      createdAt: serverTimestamp(),
      readAt: null
    });
  }
  await batch.commit();
  try { await refreshInvestorStatusSummary(documentRecord.investorId); } catch (error) { console.warn("Investor status summary could not be refreshed", error); }
}

export async function downloadInvestorDocument(documentRecord) {
  if (!documentRecord?.storagePath) throw new Error("No file has been uploaded for this document.");
  const blob = await getBlob(ref(storage, documentRecord.storagePath));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = documentRecord.fileName || "GrowVest-document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function deleteInvestorDocumentFile(documentRecord) {
  if (documentRecord?.storagePath) await deleteObject(ref(storage, documentRecord.storagePath));
  await updateDoc(doc(db, "investorDocuments", documentRecord.id), {
    storagePath: null,
    fileName: null,
    mimeType: null,
    sizeBytes: null,
    status: "requested",
    updatedAt: serverTimestamp()
  });
  try { await refreshInvestorStatusSummary(documentRecord.investorId); } catch (error) { console.warn("Investor status summary could not be refreshed", error); }
}
