import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { stableHash } from "@/lib/server/portfolioImportParser";

const COLLECTIONS = ["investmentTransactions", "manualPortfolioCashLedger", "manualPortfolioCorporateActions", "manualPortfolioIncome", "manualPortfolioCharges"];
const asRows = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

/**
 * Preserve the previous Manual PMS ledger BEFORE a workbook Replace deletes
 * active rows. Never store Firestore references; the batch-scoped archive
 * key makes retries idempotent without rewriting another import's history.
 * Replacement remains a fresh operational import, but prior-month evidence
 * survives for month-end reporting and provenance checks.
 */
export async function archiveManualLedgerBeforeReplace({ investorId, previous = {}, batchId, actor }) {
  const writer = adminDb.bulkWriter();
  let retained = 0;
  for (const collection of COLLECTIONS) {
    for (const row of (previous[collection] || []).filter((item) => collection !== "investmentTransactions" || (item.source === "manual" && item.manualPortfolioManaged === true))) {
      const { ref, ...originalData } = row;
      const archiveId = `mpled_${stableHash([investorId, batchId, collection, row.id].join("|"), 45)}`;
      writer.set(adminDb.collection("manualPortfolioLedgerHistory").doc(archiveId), {
        investorId,
        originalCollection: collection,
        originalDocumentId: row.id,
        originalBatchId: String(row.manualBulkImportId || ""),
        replacementBatchId: batchId,
        source: "manual",
        data: originalData,
        archivedAt: FieldValue.serverTimestamp(),
        archivedByUid: actor.uid
      });
      retained += 1;
    }
  }
  await writer.close();
  return retained;
}

/**
 * Current rows take precedence if the same stable transaction/ledger ID is
 * reimported or corrected. Historical revisions remain queryable for audit.
 */
export async function loadInvestorPortfolioLedger(investorId) {
  const [txDocs, cashDocs, actionDocs, corporateDocs, incomeDocs, chargeDocs, historyDocs] = await Promise.all([
    adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioCashLedger").where("investorId", "==", investorId).get(),
    adminDb.collection("investorActions").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioCorporateActions").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioIncome").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioCharges").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioLedgerHistory").where("investorId", "==", investorId).get()
  ]);
  const history = asRows(historyDocs).sort((a, b) => String(a.replacementBatchId || "").localeCompare(String(b.replacementBatchId || "")));
  function merged(collection, current) {
    const map = new Map();
    for (const entry of history.filter((item) => item.originalCollection === collection)) {
      const id = String(entry.originalDocumentId || "");
      if (id) map.set(id, { ...entry.data, id, retainedHistoricalManualRecord: true });
    }
    for (const item of asRows(current)) map.set(item.id, item);
    return [...map.values()];
  }
  return {
    transactions: merged("investmentTransactions", txDocs),
    manualCash: merged("manualPortfolioCashLedger", cashDocs),
    manualCorporateActions: merged("manualPortfolioCorporateActions", corporateDocs),
    manualIncome: merged("manualPortfolioIncome", incomeDocs),
    manualCharges: merged("manualPortfolioCharges", chargeDocs),
    investorActions: asRows(actionDocs),
    retainedHistoricalCount: history.length
  };
}
