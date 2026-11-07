import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { stableHash } from "@/lib/server/portfolioImportParser";

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const cents = (value) => Number(Number(value || 0).toFixed(2));

/**
 * Immutable evidence from every Manual PMS workbook import, including imports
 * where NAV/portfolio values remain unchanged. Does NOT promote the archive to
 * a verified complete month-end Portfolio Master snapshot.
 */
export async function archiveManualPortfolioValuation({ investorId, actor, batchId, fileName, mode, captureDate }) {
  const archiveId = `mpv_${stableHash(`${investorId}|${batchId}`, 48)}`;
  const archiveRef = adminDb.collection("portfolioDatedValuations").doc(archiveId);
  const exists = await archiveRef.get();
  if (exists.exists && exists.data()?.status === "available") return { id: archiveId, ...exists.data(), existed: true };

  const [positionDocs, accountDocs] = await Promise.all([
    adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioAccountSnapshots").where("investorId", "==", investorId).get()
  ]);
  const positions = positionDocs.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => item.source === "manual" && item.manualPortfolioManaged === true && !["inactive", "exited", "removed"].includes(String(item.status || "").toLowerCase()));
  const dates = positions.map((item) => validDate(item.navDate || item.valuationDate || item.priceDate));
  const actualDates = dates.filter(Boolean).sort();
  const latest = actualDates.at(-1) || "";
  const earliest = actualDates[0] || "";
  const total = cents(positions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0));
  const invested = cents(positions.reduce((sum, item) => sum + Number(item.totalInvested ?? item.investedAmount ?? 0), 0));
  const missingDates = dates.filter((item) => !item).length;
  const snapshotAccounts = accountDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => item.manualBulkImportId === batchId);

  await archiveRef.set({
    investorId,
    source: "manual",
    provider: "Manual PMS",
    sourceReportType: "manual_pms_workbook",
    sourceImportId: batchId,
    sourceFileName: String(fileName || ""),
    sourceCaptureDate: captureDate,
    sourceConfirmationDate: captureDate,
    valuationDate: latest,
    earliestNavDate: earliest,
    latestNavDate: latest,
    uniformNavDate: Boolean(latest && earliest === latest && !missingDates),
    historyReady: Boolean(positions.length && latest && !missingDates),
    missingValuationDateCount: missingDates,
    verificationStatus: "pending_review",
    monthlyReportEligible: false,
    fullPortfolioMasterSnapshot: false,
    archiveScope: mode === "replace" ? "operational_replace" : "operational_merge",
    summary: { currentValue: total, totalInvested: invested, holdingCount: positions.length, accountCount: snapshotAccounts.length },
    status: "writing",
    capturedByUid: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const writer = adminDb.bulkWriter();
  positions.forEach((position, index) => {
    const { createdAt, updatedAt, ...record } = position;
    const id = `${archiveId}_h_${stableHash(`${position.id}|${index}`, 24)}`;
    writer.set(adminDb.collection("portfolioDatedValuationHoldings").doc(id), {
      ...record,
      valuationId: archiveId,
      investorId,
      source: "manual",
      valuationDate: validDate(position.navDate || position.valuationDate || position.priceDate),
      sourceCaptureDate: captureDate,
      sourceImportId: batchId
    });
  });
  await writer.close();
  await archiveRef.set({ status: "available", archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { id: archiveId, valuationDate: latest, holdingCount: positions.length, missingValuationDateCount: missingDates, existed: false };
}
