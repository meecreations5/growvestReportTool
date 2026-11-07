/**
 * Immutable Manual PMS workbook evidence for a mixed-source monthly close.
 * Do not use an upload timestamp as a financial valuation date and never
 * consolidate a managed PMS position without a dated account/source record.
 */
import { inspectFrozenMonthlyActivity } from "./portfolioMonthlyIntegrity.js";
import { addCalendarDays } from "./portfolioMonthlyClose.js";

const d = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10)) ? String(value).slice(0, 10) : "";
const n = (value) => Number(value);
const round = (value) => Math.round(n(value) * 100) / 100;

export function assessManualPmsMonthlyArchive({ archive = null, holdings = [], accountSnapshots = [], transactions = [], cutoffDate = "", monthKey = "" } = {}) {
  const blockers = [];
  if (!archive || archive.source !== "manual" || archive.status !== "available" || archive.sourceReportType !== "manual_pms_workbook") {
    blockers.push("A complete original Manual PMS workbook archive is required.");
  }
  const date = d(archive?.valuationDate);
  const captureDate = d(archive?.sourceCaptureDate);
  const cutoff = d(cutoffDate);
  const first = `${monthKey}-01`;
  if (!cutoff || !date || date > cutoff || date < first || date < addCalendarDays(cutoff, -15)) {
    blockers.push("Manual PMS source valuation is missing, outside the month or older than the 15-day review window.");
  }
  // Staff may import the frozen October workbook during the first week of
  // November, but a December operational workbook cannot be backdated.
  if (!captureDate || (cutoff && (captureDate < date || captureDate > addCalendarDays(cutoff, 7)))) {
    blockers.push("Manual PMS workbook capture date is incompatible with a first-week month-end close.");
  }
  const rows = Array.isArray(holdings) ? holdings : [];
  const batchId = String(archive?.sourceImportId || "");
  if (!batchId || !rows.length || rows.length !== n(archive?.summary?.holdingCount)) {
    blockers.push("Manual PMS archived holding count or original import batch is missing.");
  }
  if (archive?.historyReady !== true || n(archive?.missingValuationDateCount) > 0) {
    blockers.push("The original Manual PMS workbook did not provide complete dated valuations.");
  }
  const ids = new Set();
  for (const item of rows) {
    const holdingDate = d(item.valuationDate || item.navDate || item.priceDate);
    const identity = String(item.positionId || item.id || "").trim();
    if (!identity || ids.has(identity) || item.source !== "manual" || item.manualPortfolioManaged !== true || item.sourceImportId !== batchId) {
      blockers.push("Manual PMS holdings are duplicated, do not belong to this import, or are not managed PMS records.");
      break;
    }
    ids.add(identity);
    if (!holdingDate || holdingDate > cutoff || holdingDate < addCalendarDays(cutoff, -15) || item.valuationDateBasis === "manual_import_date") {
      blockers.push("Manual PMS has a missing, provisional or stale actual valuation date.");
      break;
    }
    if (!Number.isFinite(n(item.currentValue)) || n(item.currentValue) < 0
      || !Number.isFinite(n(item.totalInvested ?? item.investedAmount)) || n(item.totalInvested ?? item.investedAmount) < 0
      || (n(item.currentValue) > 0 && n(item.totalInvested ?? item.investedAmount) === 0 && item.costBasisAvailable !== true)) {
      blockers.push("Manual PMS position value or invested capital is inconsistent.");
      break;
    }
  }
  const sumValue = round(rows.reduce((acc, item) => acc + n(item.currentValue || 0), 0));
  const sumInvested = round(rows.reduce((acc, item) => acc + n(item.totalInvested ?? item.investedAmount ?? 0), 0));
  if (!Number.isFinite(sumValue) || !Number.isFinite(sumInvested) || Math.abs(sumValue - n(archive?.summary?.currentValue)) > 1 || Math.abs(sumInvested - n(archive?.summary?.totalInvested)) > 1) {
    blockers.push("Original Manual PMS archive totals do not reconcile to its holdings.");
  }
  const accounts = (Array.isArray(accountSnapshots) ? accountSnapshots : []).filter((item) => String(item.manualBulkImportId || "") === batchId);
  if (!accounts.length || accounts.length !== n(archive?.summary?.accountCount)) {
    blockers.push("Manual PMS account-level import receipts are missing or incomplete.");
  }
  const keys = new Set(accounts.map((item) => String(item.accountCode || "").trim().toUpperCase()));
  if (keys.has("") || keys.size !== accounts.length) blockers.push("Manual PMS account receipt identities overlap or are missing.");
  if (accounts.length && rows.some((item) => !keys.has(String(item.manualPortfolioAccountCode || item.accountCode || "").trim().toUpperCase()))) {
    blockers.push("A Manual PMS holding does not map to the original imported account.");
  }
  const activity = inspectFrozenMonthlyActivity({
    snapshot: { snapshotDate: date, reportSnapshotMode: "approved_historical_multi_source" },
    positions: rows, transactions: (Array.isArray(transactions) ? transactions : []).filter((item) => item.source === "manual"),
    startDate: first, cutoffDate: cutoff
  });
  if (activity.invalidPositionDates || activity.postValuationActivity.count) {
    blockers.push(`${activity.postValuationActivity.count} Manual PMS ledger movement(s) occurred after an account's frozen valuation date; a later original workbook is required.`);
  }
  return {
    ready: blockers.length === 0,
    blockers, archiveId: String(archive?.id || ""), valuationDate: date,
    sourceValue: sumValue, sourceInvested: sumInvested, holdingCount: rows.length,
    sourceCaptureDate: captureDate,
    receiptCount: accounts.length,
    postValuationActivity: activity.postValuationActivity
  };
}
