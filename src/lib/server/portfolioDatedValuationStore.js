import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { stableHash } from "@/lib/server/portfolioImportParser";
import { planFundbazaarDatedValuation } from "@/lib/portfolioDatedValuationPlan";

function safeText(value) { return String(value || "").trim(); }

export async function archiveImportedFundbazaarValuation({ file, investorId, actor }) {
  if (!investorId || !file?.id || !actor?.uid) throw new Error("Investor, uploaded file and authenticated staff member are required.");
  if (safeText(file.matchedInvestorId) !== investorId || file.status !== "imported") {
    throw new Error("Only a completed, correctly mapped Fundbazaar import can be archived.");
  }
  const plan = planFundbazaarDatedValuation(file);
  const fingerprint = safeText(file.fileFingerprint);
  if (!fingerprint) throw new Error("The source file fingerprint is missing. Reanalyse the file before archiving.");
  const archiveId = `fbv_${stableHash(`${investorId}|${plan.valuationDate}|${fingerprint}|${file.id}`, 48)}`;
  const archiveRef = adminDb.collection("portfolioDatedValuations").doc(archiveId);
  const existing = await archiveRef.get();
  if (existing.exists && existing.data()?.status === "voided") {
    throw new Error("This archival revision was voided following a source correction. Use the corrected import.");
  }
  if (existing.exists && existing.data()?.status === "available") {
    await adminDb.collection("portfolioImportFiles").doc(file.id).set({
      datedValuationId: archiveId,
      datedValuationDate: plan.valuationDate,
      datedValuationStatus: "available"
    }, { merge: true });
    return { id: archiveId, date: plan.valuationDate, alreadyArchived: true, summary: plan.summary };
  }
  await archiveRef.set({
    investorId,
    source: "fundbazaar",
    provider: "Fundbazaar",
    sourceReportType: file.reportType,
    sourceImportId: file.batchId || "",
    sourceImportFileId: file.id,
    sourceFileFingerprint: fingerprint,
    sourceFileName: safeText(file.fileName),
    valuationDate: plan.valuationDate,
    earliestNavDate: plan.earliestNavDate,
    latestNavDate: plan.latestNavDate,
    uniformNavDate: plan.uniformNavDate,
    postValuationTransactionCount: plan.postValuationTransactionCount,
    historyReady: plan.historyReady,
    verificationStatus: "pending_review",
    monthlyReportEligible: false,
    // This archive is a historical source record, not a full Portfolio Master
    // snapshot or a reason to overwrite later live holdings.
    fullPortfolioMasterSnapshot: false,
    summary: plan.summary,
    status: "writing",
    capturedByUid: actor.uid,
    createdAt: existing.exists ? (existing.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const writer = adminDb.bulkWriter();
  plan.holdings.forEach((holding, index) => {
    const id = `${archiveId}_h_${stableHash(`${holding.isin}|${holding.folioNo}|${index}`, 24)}`;
    writer.set(adminDb.collection("portfolioDatedValuationHoldings").doc(id), {
      valuationId: archiveId,
      investorId,
      valuationDate: plan.valuationDate,
      source: "fundbazaar",
      ...holding
    });
  });
  plan.transactions.forEach((transaction, index) => {
    const id = `${archiveId}_t_${stableHash(`${transaction.isin}|${transaction.folioNo}|${transaction.transactionDate}|${index}`, 24)}`;
    writer.set(adminDb.collection("portfolioDatedValuationTransactions").doc(id), {
      valuationId: archiveId,
      investorId,
      valuationDate: plan.valuationDate,
      source: "fundbazaar",
      ...transaction
    });
  });
  await writer.close();
  await archiveRef.set({ status: "available", archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await adminDb.collection("portfolioImportFiles").doc(file.id).set({
    datedValuationId: archiveId,
    datedValuationDate: plan.valuationDate,
    datedValuationStatus: "available",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { id: archiveId, date: plan.valuationDate, alreadyArchived: false, summary: plan.summary };
}

export async function voidDatedValuationForImport({ file, actor, reason }) {
  if (!file?.datedValuationId) return;
  const archiveRef = adminDb.collection("portfolioDatedValuations").doc(file.datedValuationId);
  const snapshot = await archiveRef.get();
  if (!snapshot.exists || snapshot.data()?.sourceImportFileId !== file.id) return;
  // A corrected/rolled-back source must no longer be selectable by reports.
  const approvedSnapshotId = String(snapshot.data()?.reportSnapshotId || "");
  if (approvedSnapshotId) {
    const linkedRef = adminDb.collection("portfolioSnapshots").doc(approvedSnapshotId);
    const linked = await linkedRef.get();
    if (linked.exists && linked.data()?.sourceDatedValuationId === file.datedValuationId) {
      await linkedRef.set({ verificationStatus: "voided", invalidationReason: "source_import_rolled_back", invalidatedAt: FieldValue.serverTimestamp(), invalidatedByUid: actor.uid }, { merge: true });
    }
  }
  await archiveRef.set({
    status: "voided",
    historyReady: false,
    monthlyReportEligible: false,
    verificationStatus: "voided",
    voidReason: safeText(reason),
    voidedByUid: actor.uid,
    voidedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}
