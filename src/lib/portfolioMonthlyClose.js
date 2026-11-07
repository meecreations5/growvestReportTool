import { isConfirmedInvestmentActivity, lastCalendarDayOfMonth } from "./portfolioPeriodCoverage.js";

const DAY_MS = 86400000;
const dateKey = (value) => {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const ms = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === raw ? raw : "";
};

export function addCalendarDays(date, days) {
  const valid = dateKey(date);
  return valid ? new Date(Date.parse(`${valid}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10) : "";
}

/** Period dates follow the investment's effective date, never upload/publishing time. */
export function monthlyReportingWindow(monthKey) {
  const cutoffDate = lastCalendarDayOfMonth(monthKey);
  if (!cutoffDate) throw new Error("A valid reporting month (YYYY-MM) is required.");
  return {
    monthKey,
    startDate: `${monthKey}-01`,
    cutoffDate,
    generationOpens: addCalendarDays(cutoffDate, 1),
    generationTargetEnd: addCalendarDays(cutoffDate, 7)
  };
}

export function transactionBelongsToMonth(item = {}, monthKey = "") {
  const start = `${monthKey}-01`;
  const cutoff = lastCalendarDayOfMonth(monthKey);
  const effectiveDate = dateKey(item.actualFinancialDate || item.transactionDate || item.entryDate || item.actionDate || item.incomeDate || item.chargeDate || item.date);
  return Boolean(cutoff && effectiveDate && effectiveDate >= start && effectiveDate <= cutoff);
}

export function portfolioValueDate(position = {}) {
  return dateKey(position.navDate || position.valuationDate || position.priceDate);
}

/**
 * A snapshot captured in the following month is NOT a month-end portfolio
 * merely because its NAV dates look old. Every holding must have an eligible
 * source value date, and no confirmed later transaction (including internal
 * switches, PMS ledger movements or corporate actions) may be reflected.
 * Returns a candidate for explicit review, not a publication approval.
 */
export function inspectPostCutoffCapture({ snapshot = {}, positions = [], cutoffDate = "", postCutoffActivity = [] } = {}) {
  const capturedDate = dateKey(snapshot.snapshotDate);
  const cutoff = dateKey(cutoffDate);
  const errors = [];
  if (!cutoff || !capturedDate || capturedDate <= cutoff || capturedDate > addCalendarDays(cutoff, 7)) {
    errors.push("Capture must be within seven calendar days after the reporting cutoff.");
  }
  if (snapshot.verificationStatus !== "verified") errors.push("Capture is not verified.");
  if (!positions.length || (Number(snapshot.summary?.positionCount || 0) > 0 && positions.length !== Number(snapshot.summary.positionCount))) {
    errors.push("Complete frozen snapshot positions are unavailable.");
  }
  const sourceDates = positions.map(portfolioValueDate);
  if (sourceDates.some((value) => !value)) errors.push("At least one holding has no actual valuation date.");
  if (sourceDates.some((value) => value > cutoff)) errors.push("A holding contains a post-cutoff valuation.");
  const later = (Array.isArray(postCutoffActivity) ? postCutoffActivity : []).filter((item) => {
    const effective = dateKey(item.actualFinancialDate || item.transactionDate || item.entryDate || item.actionDate || item.incomeDate || item.chargeDate || item.date);
    if (!effective || effective <= cutoff || effective > capturedDate) return false;
    return isConfirmedInvestmentActivity(item);
  });
  if (later.length) errors.push(`${later.length} post-cutoff transaction/ledger activity record(s) exist before capture.`);
  const sumPositions = positions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const sumSnapshot = Number(snapshot.summary?.currentValue);
  if (!Number.isFinite(sumSnapshot) || !Number.isFinite(sumPositions) || Math.abs(sumPositions - sumSnapshot) > Math.max(1, Math.abs(sumSnapshot) * 0.00001)) {
    errors.push("Frozen holding totals do not reconcile to the snapshot summary.");
  }
  const effectiveDate = sourceDates.filter(Boolean).sort().at(-1) || "";
  return {
    eligible: errors.length === 0,
    errors,
    effectiveDate,
    capturedDate,
    cutoffDate: cutoff,
    requiresStaffApproval: true,
    valuationDates: [...new Set(sourceDates.filter(Boolean))].sort()
  };
}

/**
 * The last confirmed NAV and the date that holdings were refreshed are two
 * different facts. A 15-day-old NAV may be carried in an indicative valuation
 * but is not evidence of a fresh month-end market price.
 */
export function inspectMonthEndValuationDates(positions = [], cutoffDate = "") {
  const cutoff = dateKey(cutoffDate);
  const rows = positions.map((position) => {
    const valuationDate = portfolioValueDate(position);
    const confirmationDate = dateKey(position.manualSourceRefreshDate || position.manualImportDate || position.sourceRefreshDate);
    const lagDays = cutoff && valuationDate ? Math.floor((Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${valuationDate}T00:00:00Z`)) / DAY_MS) : null;
    const source = String(position.source || "").toLowerCase();
    const reviewAfterDays = source === "manual" ? 15 : 7;
    const status = !valuationDate ? "missing" : lagDays < 0 ? "future" : lagDays > reviewAfterDays ? "stale" : lagDays > 0 ? "earlier" : "current";
    return { source, valuationDate, confirmationDate, lagDays, reviewAfterDays, status };
  });
  return {
    rows,
    future: rows.filter((item) => item.status === "future").length,
    missing: rows.filter((item) => item.status === "missing").length,
    stale: rows.filter((item) => item.status === "stale").length,
    earlier: rows.filter((item) => item.status === "earlier").length
  };
}

/** Weekends only; holidays and special exchange sessions still require source evidence. */
export function lastWeekdayOnOrBefore(date) {
  let current = dateKey(date);
  if (!current) return "";
  while ([0, 6].includes(new Date(`${current}T00:00:00Z`).getUTCDay())) current = addCalendarDays(current, -1);
  return current;
}
