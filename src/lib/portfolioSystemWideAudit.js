import { latestVerifiedPortfolioSnapshot, selectVerifiedMonthEndClosingSnapshot } from "./portfolioSnapshotSelection.js";
import { lastCalendarDayOfMonth } from "./portfolioPeriodCoverage.js";
import { inspectMonthEndValuationDates, lastWeekdayOnOrBefore } from "./portfolioMonthlyClose.js";
import { lastExchangeSessionOnOrBefore, portfolioValuationCalendar } from "./portfolioMarketCalendar.js";

function dateKey(value = "") {
  const key = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== key ? "" : key;
}

export function portfolioMonthCutoff(monthKey) {
  const cutoff = lastCalendarDayOfMonth(monthKey);
  if (!cutoff || cutoff.slice(0, 7) !== String(monthKey || "")) throw new Error("A valid reporting month (YYYY-MM) is required.");
  return cutoff;
}

/**
 * Conservative, READ-ONLY portfolio readiness assessment. Never promotes an
 * imported file to a verified Portfolio Master snapshot. A page can have a
 * verified operational snapshot but still be unfit for month-end reporting.
 */
export function assessInvestorMonthEnd({ monthKey, snapshots = [], snapshotPositions = [], valuations = [], uncoveredCashFlows = null, laterInvestmentActivity = null, closingOverride = null, captureIssue = null, sourceSet = null } = {}) {
  const cutoffDate = portfolioMonthCutoff(monthKey);
  const closing = closingOverride || selectVerifiedMonthEndClosingSnapshot(snapshots, cutoffDate);
  const laterSnapshot = latestVerifiedPortfolioSnapshot(snapshots, (item) => dateKey(item.snapshotDate) > cutoffDate);
  const archives = valuations
    .filter((item) => item.status === "available" && dateKey(item.valuationDate) && dateKey(item.valuationDate) <= cutoffDate)
    .sort((a, b) => dateKey(b.valuationDate).localeCompare(dateKey(a.valuationDate)));
  const latestArchive = archives[0] || null;
  const latestManual = archives.find((item) => item.source === "manual") || null;
  const latestFundbazaar = archives.find((item) => item.source === "fundbazaar") || null;
  const latestDate = dateKey(closing?.snapshotDate);
  const uncovered = uncoveredCashFlows || { count: 0, newMoney: 0, withdrawals: 0, latestDate: "" };
  const result = {
    monthKey, cutoffDate,
    snapshotId: closing?.id || "",
    snapshotDate: latestDate,
    snapshotVersion: Number(closing?.snapshotVersion || 0),
    snapshotValue: Number(closing?.summary?.currentValue || 0),
    archivedValuationDate: dateKey(latestArchive?.valuationDate),
    archivedValuationSource: latestArchive?.source || "",
    manualValuationDate: dateKey(latestManual?.valuationDate),
    fundbazaarValuationDate: dateKey(latestFundbazaar?.valuationDate),
    capturedSnapshotDate: dateKey(closing?.capturedSnapshotDate),
    archivedValuationId: latestArchive?.id || "",
    archivedValuationStatus: latestArchive?.verificationStatus || "",
    archivedValuationValue: Number(latestArchive?.summary?.currentValue || 0),
    uncoveredCashFlows: { count: Number(uncovered.count || 0), newMoney: Number(uncovered.newMoney || 0), withdrawals: Number(uncovered.withdrawals || 0), latestDate: uncovered.latestDate || "" },
    status: "blocked", code: "", message: ""
  };

  if (!closing) {
    result.code = "verified_month_end_missing";
    result.message = latestArchive
      ? `A historical valuation dated ${result.archivedValuationDate} is stored but is not a verified complete Portfolio Master month-end snapshot.`
      : captureIssue
        ? `A later portfolio capture exists, but is ineligible for this month's closing: ${captureIssue.message}`
        : laterSnapshot
          ? `Only a later snapshot (${dateKey(laterSnapshot.snapshotDate)}) exists. Its values must not be backdated without verified source dates.`
          : "No verified historical Portfolio Master snapshot is available for this month.";
    return result;
  }
  if (Number(laterInvestmentActivity?.count || 0) > 0) {
    result.code = "historical_nav_outdated_by_transactions";
    result.message = `${Number(laterInvestmentActivity.count)} confirmed portfolio transaction(s) occurred after their own frozen holding/source valuation date. Reconcile against a complete newer source before reporting.`;
    return result;
  }
  if (uncovered.count > 0) {
    result.code = "cash_flow_after_snapshot";
    result.message = `${uncovered.count} confirmed investment/withdrawal movements (₹${Number(uncovered.newMoney || 0).toLocaleString("en-IN")} invested, ₹${Number(uncovered.withdrawals || 0).toLocaleString("en-IN")} withdrawn) occurred after the ${latestDate} valuation.`;
    return result;
  }

  if (sourceSet && !sourceSet.ready) {
    result.status = "blocked";
    result.code = "incomplete_month_end_source_set";
    result.message = sourceSet.issues.map((item) => item.message).join(" ");
    return result;
  }

  // A multi-source historical close needs BOTH original approvals. A later
  // correction/void of the PMS archive must never leave an apparently ready
  // Fundbazaar-only snapshot in the all-investor readiness scan.
  if (closing.reportSnapshotMode === "approved_historical_multi_source") {
    const ids = closing.sourceDatedValuationIds || {};
    const linked = ["fundbazaar", "manual"].map((source) => valuations.find((item) =>
      item.id === ids[source] && item.source === source && item.status === "available"
      && item.monthlyReportEligible === true && item.reportSnapshotId === closing.id));
    if (linked.some((item) => !item) || closing.reportCutoffDate !== cutoffDate) {
      result.code = "historical_multi_source_provenance_incomplete";
      result.message = "The approved month-end snapshot no longer links to both valid Fundbazaar and Manual PMS original source approvals. Reconcile the source archives before publishing.";
      return result;
    }
  }

  // A newly archived NAV file is evidence requiring independent review and
  // source-level consolidation; its value must not replace a different source.
  if (latestArchive && dateKey(latestArchive.valuationDate) > latestDate) {
    result.status = "review";
    result.code = "historical_valuation_not_promoted";
    result.message = `Newer ${latestArchive.source || "portfolio"} valuation evidence (${result.archivedValuationDate}) is archived. Verify complete portfolio coverage before report preparation.`;
    return result;
  }

  const valuationCoverage = inspectMonthEndValuationDates(snapshotPositions, cutoffDate);
  const dates = snapshotPositions.map((item) => ({
    source: String(item.source || ""),
    productType: String(item.productType || ""),
    marketCalendar: portfolioValuationCalendar(item),
    date: dateKey(item.navDate || item.valuationDate || item.priceDate || "")
  }));
  const futureDates = dates.filter((item) => item.date && item.date > cutoffDate);
  if (futureDates.length) {
    result.code = "post_cutoff_valuations";
    result.message = `${futureDates.length} underlying position valuation dates are later than ${cutoffDate}. They cannot be used as month-end figures.`;
    return result;
  }
  if (Number(closing.summary?.positionCount || 0) > 0 && !snapshotPositions.length) {
    result.code = "snapshot_positions_missing";
    result.message = "The snapshot summary has positions, but historical holdings were not found.";
    return result;
  }
  const undated = dates.filter((item) => !item.date);
  if (undated.length) {
    result.status = "review";
    result.code = "position_value_dates_missing";
    result.message = `${undated.length} historical holding(s) are missing NAV/price/valuation dates. Verify their source dates before reporting.`;
    return result;
  }
  // A manually approved historical Fundbazaar-only source may use the last
  // available NAV date before the calendar cutoff. Keep that actual NAV date
  // visible and check the precise approval linkage; never treat an unapproved
  // earlier operational snapshot as month-end ready.
  if (latestDate < cutoffDate && ["approved_historical_source", "approved_historical_multi_source"].includes(closing.reportSnapshotMode)) {
    const linked = valuations.find((item) => item.id === closing.sourceDatedValuationId);
    const datedMatches = closing.reportSnapshotMode === "approved_historical_multi_source"
      ? latestDate === [closing.sourceValuationDates?.fundbazaar, closing.sourceValuationDates?.manual].sort().at(-1)
      : closing.sourceValuationDate === latestDate;
    if (linked?.monthlyReportEligible === true && linked.reportSnapshotId === closing.id
      && closing.reportCutoffDate === cutoffDate && datedMatches) {
      result.status = "ready";
      result.code = "approved_last_available_nav";
      result.message = `Approved historical ${closing.reportSnapshotMode === "approved_historical_multi_source" ? "multi-source" : "Fundbazaar"} valuation dated ${latestDate} for the ${cutoffDate} reporting cutoff. Original source dates remain visible; confirm all cash flows before publication.`;
      return result;
    }
  }
  if (closing.reportSnapshotMode === "post_cutoff_capture" && closing.monthEndApprovalStatus !== "approved") {
    result.status = "review";
    result.code = "eligible_post_cutoff_capture_review";
    result.message = `A complete capture dated ${result.capturedSnapshotDate} contains eligible pre-cutoff valuations through ${latestDate}. An administrator must verify source coverage and approve the capture before a report can be completed.`;
    return result;
  }
  if (valuationCoverage.stale) {
    result.status = "review";
    result.code = "old_nav_requires_source_confirmation";
    result.message = `${valuationCoverage.stale} holding(s) have older last-known NAVs. Confirm whether these prices remained the latest available source valuations; an unchanged value is not proof of a fresh NAV.`;
    return result;
  }
  // Stock exchanges can trade on a Sunday (e.g. Diwali 2026-11-08).
  // Mutual-fund NAV dates are DIFFERENT: an NSE Sunday session is not proof
  // that an AMC published a NAV. Compare only to the relevant source's
  // calendar, and keep a weekday NAV comparison advisory rather than final
  // proof of publication.
  const equityReference = lastExchangeSessionOnOrBefore(cutoffDate, "nse_cash");
  const navWeekdayGuide = lastWeekdayOnOrBefore(cutoffDate);
  const sourceReferenceDate = (holding) => holding.marketCalendar === "nse_cash"
    ? equityReference.date
    : holding.marketCalendar === "mutual_fund_nav"
      ? navWeekdayGuide
      : holding.source ? "" : navWeekdayGuide;
  const earlierSourceDates = dates.filter((holding) => {
    const expected = sourceReferenceDate(holding);
    return expected && holding.date && holding.date < expected;
  });
  // A snapshot of a cash-market portfolio before the special Sunday session
  // needs review even if the last normal weekday is earlier.
  if (latestDate < equityReference.date && dates.some((holding) => holding.marketCalendar === "nse_cash")) {
    result.status = "review";
    result.code = "closing_before_reporting_cutoff";
    result.message = `The verified closing snapshot is dated ${latestDate}, before the last recorded NSE cash-market session ${equityReference.date}. Verify official special sessions, source coverage and transaction dates.`;
    return result;
  }
  if (earlierSourceDates.length) {
    result.status = "review";
    result.code = "earlier_source_nav_dates";
    result.message = `${earlierSourceDates.length} holding(s) have valuation dates earlier than their source-specific calendar guide. Check actual AMC NAV publication, exchange special sessions, holidays and frozen source coverage. A calendar alone is not NAV evidence.`;
    return result;
  }
  result.status = "ready";
  result.code = "verified_complete_snapshot";
  result.message = `Valuations are through ${latestDate}, with no uncovered confirmed cash movements or invalid source dates found. Equity calendar through ${equityReference.date}; mutual-fund NAVs use actual AMC source dates, including genuine weekend observations.`;
  return result;
}
