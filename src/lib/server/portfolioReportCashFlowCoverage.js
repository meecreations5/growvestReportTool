import { loadInvestorPortfolioLedger } from "@/lib/server/portfolioHistoricalManualLedger";
import { unrepresentedExternalCashFlows, postValuationInvestmentActivity } from "@/lib/portfolioPeriodCoverage";
import { buildMonthlyReportingLedger } from "@/lib/portfolioMonthlyLedger";
import { inspectFrozenMonthlyActivity } from "@/lib/portfolioMonthlyIntegrity";
import { adminDb } from "@/lib/server/firebaseAdmin";

/**
 * Check investor-level cash flows that were not yet reflected in a historical
 * portfolio snapshot. All source collections are read by investorId, and the
 * shared helper applies exact date and confirmed-external-flow filtering.
 * The server gate protects existing completed/PDF/published reports too.
 */
export async function checkReportCashFlowCoverage(investorId, snapshotDate, cutoffDate) {
  if (!snapshotDate || !cutoffDate || snapshotDate >= cutoffDate) {
    return unrepresentedExternalCashFlows({ snapshotDate, cutoffDate });
  }
  const ledger = await loadInvestorPortfolioLedger(investorId);
  const transactions = buildMonthlyReportingLedger({ ledger, investorId, cutoffDate });
  return unrepresentedExternalCashFlows({ snapshotDate, cutoffDate, transactions });
}

/** Protect historical, admin-approved NAV snapshots from later non-cash trades. */
export async function checkHistoricalInvestmentActivityCoverage(investorId, snapshotDate, cutoffDate) {
  if (!snapshotDate || !cutoffDate || snapshotDate >= cutoffDate) return { count: 0, latestDate: "" };
  const ledger = await loadInvestorPortfolioLedger(investorId);
  return postValuationInvestmentActivity({ snapshotDate, cutoffDate, transactions: ledger.transactions });
}

/** The PDF/publish gate, scan and report API must use the same frozen-source check. */
export async function inspectStoredMonthlySourceCoverage({ investorId, snapshot, cutoffDate, positions = null } = {}) {
  if (!investorId || !snapshot?.id) throw new Error("A saved investor snapshot is required to reconcile source coverage.");
  const [ledger, stored] = await Promise.all([
    loadInvestorPortfolioLedger(investorId),
    positions === null
      ? adminDb.collection("portfolioSnapshotPositions").where("snapshotId", "==", snapshot.id).get()
      : Promise.resolve(null)
  ]);
  const frozen = positions === null ? stored.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : positions;
  const monthKey = String(cutoffDate || "").slice(0, 7);
  const transactions = buildMonthlyReportingLedger({ ledger, investorId, startDate: `${monthKey}-01`, cutoffDate });
  return inspectFrozenMonthlyActivity({
    snapshot, positions: frozen, transactions,
    startDate: `${monthKey}-01`, cutoffDate
  });
}
