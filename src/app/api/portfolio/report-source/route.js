import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  canStaffAccessRecord,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";
import { dedupeActionWithdrawalTransactions } from "@/lib/portfolioCashFlow";
import { normalisePortfolioGoalAllocations, portfolioAllocationStatus } from "@/lib/portfolioGoalAllocation";
import {
  PORTFOLIO_RECONCILIATION_STATUS,
  PORTFOLIO_RECONCILIATION_THRESHOLDS,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import { buildPortfolioSourceFreshness, manualPortfolioRefreshDate } from "@/lib/server/portfolioFreshness";
import { sameMonthOpeningBaselineDate } from "@/lib/reportPeriodRules";
import { latestVerifiedPortfolioSnapshot, selectVerifiedReportSnapshot } from "@/lib/portfolioSnapshotSelection";
import { businessDateKey } from "@/lib/utils/date";
import { inspectFrozenMonthlyActivity, inspectFrozenSourceSet } from "@/lib/portfolioMonthlyIntegrity";
import { monthlyReportingWindow } from "@/lib/portfolioMonthlyClose";
import { resolveMonthEndSnapshot } from "@/lib/server/portfolioMonthEndSelection";
import { loadInvestorPortfolioLedger } from "@/lib/server/portfolioHistoricalManualLedger";
import { buildMonthlyReportingLedger } from "@/lib/portfolioMonthlyLedger";

export const runtime = "nodejs";

function safeDateKey(value = "") {
  const dateKey = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : "";
}

function addDaysToDateKey(dateKey, days) {
  const parsed = Date.parse(`${String(dateKey || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed + Number(days || 0) * 86400000).toISOString().slice(0, 10);
}

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function loadSnapshotPositions(snapshotId) {
  if (!snapshotId) return [];
  const result = await adminDb.collection("portfolioSnapshotPositions")
    .where("snapshotId", "==", snapshotId)
    .get();
  return rows(result);
}

function freshnessIssueRows(sourceFreshness = []) {
  const missing = sourceFreshness.filter((item) => item.freshnessStatus === "missing");
  const stale = sourceFreshness.filter((item) => ["stale", "critical"].includes(item.freshnessStatus));
  const aging = sourceFreshness.filter((item) => item.freshnessStatus === "aging");
  const issues = [];
  if (missing.length) {
    issues.push({
      code: "missing_source_date",
      severity: "warn",
      title: "Source valuation date missing",
      description: `${missing.length} portfolio source${missing.length === 1 ? " has" : "s have"} no usable source refresh date.`,
      count: missing.length
    });
  }
  if (stale.length) {
    const oldest = Math.max(...stale.map((item) => Number(item.ageDays || 0)));
    issues.push({
      code: "stale_source",
      severity: oldest > PORTFOLIO_RECONCILIATION_THRESHOLDS.CRITICAL_STALE_DAYS ? "block" : "warn",
      title: "Portfolio source is stale",
      description: `${stale.length} source${stale.length === 1 ? " is" : "s are"} older than ${PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS} days. Oldest source is ${oldest} days old.`,
      count: stale.length,
      oldestAgeDays: oldest
    });
  } else if (aging.length) {
    issues.push({
      code: "aging_source",
      severity: "info",
      title: "Source freshness attention",
      description: `${aging.length} source${aging.length === 1 ? " is" : "s are"} more than ${PORTFOLIO_RECONCILIATION_THRESHOLDS.FRESH_DAYS} days old.`,
      count: aging.length
    });
  }
  return issues;
}

function patchSnapshotFreshness(snapshot = {}, positions = [], referenceDate = "") {
  if (!snapshot || !positions.length) return snapshot;
  const sourceFreshness = buildPortfolioSourceFreshness(positions, referenceDate, PORTFOLIO_RECONCILIATION_THRESHOLDS).map((item) => ({
    ...item,
    sourceLabel: item.source === "manual" && item.freshnessBasis === "manual_import" ? "Manual Portfolio" : (PORTFOLIO_SOURCE_LABELS[item.source] || item.sourceLabel || item.source)
  }));
  const previousIntelligence = snapshot.intelligence || {};
  const retainedIssues = (Array.isArray(previousIntelligence.issues) ? previousIntelligence.issues : [])
    .filter((item) => !["missing_source_date", "stale_source", "aging_source"].includes(String(item?.code || "")));
  const freshnessIssues = freshnessIssueRows(sourceFreshness);
  const issues = [...retainedIssues, ...freshnessIssues];
  const hasBlockingOther = retainedIssues.some((item) => ["block", "error", "critical", "fatal"].includes(String(item?.severity || "").toLowerCase()));
  const hasWarningOther = retainedIssues.some((item) => ["warn", "warning", "review", "needs_review"].includes(String(item?.severity || "").toLowerCase()));
  const hasMissing = sourceFreshness.some((item) => item.freshnessStatus === "missing");
  const hasStale = sourceFreshness.some((item) => ["stale", "critical"].includes(item.freshnessStatus));
  let status = String(previousIntelligence.status || snapshot.reconciliationStatus || PORTFOLIO_RECONCILIATION_STATUS.VERIFIED);
  if (hasBlockingOther) {
    if (![PORTFOLIO_RECONCILIATION_STATUS.MISMATCH, PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT].includes(status)) status = PORTFOLIO_RECONCILIATION_STATUS.MISMATCH;
  } else if (hasMissing) status = PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE;
  else if (hasStale) status = PORTFOLIO_RECONCILIATION_STATUS.STALE;
  else if (hasWarningOther) status = PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW;
  else if ([PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE, PORTFOLIO_RECONCILIATION_STATUS.STALE].includes(status)) status = PORTFOLIO_RECONCILIATION_STATUS.VERIFIED;

  return {
    ...snapshot,
    sourceFreshness,
    reconciliationStatus: status,
    intelligence: {
      ...previousIntelligence,
      status,
      sourceFreshness,
      issues,
      counts: {
        ...(previousIntelligence.counts || {}),
        sourceCount: sourceFreshness.length,
        staleSources: sourceFreshness.filter((item) => ["stale", "critical"].includes(item.freshnessStatus)).length,
        missingSourceDates: sourceFreshness.filter((item) => item.freshnessStatus === "missing").length
      }
    }
  };
}

function overlayManualFreshness(snapshotPositions = [], manualAccountSnapshots = [], cutoffDate = "") {
  // A historical report must NEVER inherit a later live portfolio's refresh
  // timestamp. The frozen holding is the primary evidence. A saved Manual PMS
  // account receipt is only usable if it belongs to that exact import batch
  // and was recorded no later than the original snapshot capture date.
  const receiptsByBatch = new Map();
  for (const account of manualAccountSnapshots) {
    const batchId = String(account.manualBulkImportId || "");
    const receiptDate = safeDateKey(account.snapshotDate || account.manualImportDate || "");
    if (!batchId || !receiptDate || (cutoffDate && receiptDate > cutoffDate)) continue;
    const previous = receiptsByBatch.get(batchId) || "";
    if (receiptDate > previous) receiptsByBatch.set(batchId, receiptDate);
  }
  return snapshotPositions.map((position) => {
    if (String(position.source || "") !== "manual" || position.manualPortfolioManaged !== true) return position;
    const existing = manualPortfolioRefreshDate(position);
    const receipt = receiptsByBatch.get(String(position.manualBulkImportId || "")) || "";
    const confirmed = existing || receipt;
    if (!confirmed) return position;
    return {
      ...position,
      manualSourceRefreshDate: confirmed,
      freshnessDateBasis: "manual_workbook_import",
      // NAV date is deliberately not changed or inferred from the receipt.
      sourceConfirmationDate: confirmed
    };
  });
}

function dateSortValue(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  }
  return value;
}

async function loadOpeningWealthReview(investorId) {
  const canonical = await adminDb.collection("monthlyReports").doc(`${investorId}_opening`).get();
  if (canonical.exists) return { id: canonical.id, ...canonical.data() };
  const history = await adminDb.collection("monthlyReports").where("investorId", "==", investorId).get();
  return rows(history).find((item) => item.reportType === "opening") || null;
}

async function loadPreviousCompletedMonthlyReview(investorId, currentMonthKey) {
  const history = await adminDb.collection("monthlyReports").where("investorId", "==", investorId).get();
  const precedingMonth = addDaysToDateKey(`${currentMonthKey}-01`, -1).slice(0, 7);
  return rows(history)
    .filter((item) => item.reportType !== "opening")
    .filter((item) => item.status === "completed")
    .filter((item) => String(item.reportMonthKey || "") === precedingMonth)
    .sort((a, b) => {
      const monthCompare = String(b.reportMonthKey || "").localeCompare(String(a.reportMonthKey || ""));
      if (monthCompare) return monthCompare;
      const publishedCompare = Number(Boolean(b.publishedAt)) - Number(Boolean(a.publishedAt));
      if (publishedCompare) return publishedCompare;
      return String(b.updatedAt || b.completedAt || "").localeCompare(String(a.updatedAt || a.completedAt || ""));
    })[0] || null;
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { searchParams } = new URL(request.url);
    const investorId = String(searchParams.get("investorId") || "").trim();
    const asOfDate = safeDateKey(searchParams.get("asOfDate"));
    const reportType = searchParams.get("reportType") === "opening" ? "opening" : "monthly";

    if (!investorId) throw new AppRequestError("Investor is required.", 400, "investor_required");
    if (!asOfDate) throw new AppRequestError("A valid portfolio cutoff date is required.", 400, "portfolio_cutoff_required");
    if (reportType === "monthly") {
      if (asOfDate !== monthlyReportingWindow(asOfDate.slice(0, 7)).cutoffDate) {
        throw new AppRequestError("Monthly Wealth Reviews must use the last calendar day of the selected reporting month, not an interim valuation or report-generation date.", 400, "invalid_monthly_cutoff");
      }
      if (asOfDate >= businessDateKey()) {
        throw new AppRequestError("This reporting month has not ended. Monthly Wealth Reviews can be prepared from the 1st of the following month.", 409, "reporting_period_not_closed");
      }
    }

    const investorSnapshot = await adminDb.collection("investors").doc(investorId).get();
    if (!investorSnapshot.exists) throw new AppRequestError("Investor profile was not found.", 404, "investor_not_found");
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (investor.isDeleted === true || investor.lifecycleStatus === "deleted") {
      throw new AppRequestError("This Investor has been deleted from active GrowVest records.", 410, "investor_deleted");
    }
    if (!canStaffAccessRecord(actor, investor)) {
      throw new AppRequestError("You are not authorised to access this investor portfolio.", 403, "portfolio_access_denied");
    }

    // Report creation is a privileged server workflow. Load all source records
    // by investor on the server and apply reporting-date rules here instead of
    // querying protected Portfolio Master collections from the browser.
    const snapshotsResult = await adminDb.collection("portfolioSnapshots")
      .where("investorId", "==", investorId)
      .get();
    const snapshots = rows(snapshotsResult);
    const monthKey = asOfDate.slice(0, 7);
    const [openingWealthReview, previousMonthlyReview] = await Promise.all([
      loadOpeningWealthReview(investorId),
      loadPreviousCompletedMonthlyReview(investorId, monthKey)
    ]);

    const selection = reportType === "monthly"
      ? await resolveMonthEndSnapshot({ investorId, snapshots, cutoffDate: asOfDate })
      : { snapshot: latestVerifiedPortfolioSnapshot(snapshots, (item) => String(item.snapshotDate || "") <= asOfDate), positions: null };
    let snapshot = selection.snapshot;
    let closingPositions = selection.positions;

    // First Opening Review has no historical cutoff to honor when the default
    // previous-month date predates the investor's first verified snapshot.
    // Use the actual latest verified baseline, without backdating its value.
    if (!snapshot && reportType === "opening") {
      snapshot = selectVerifiedReportSnapshot(snapshots, asOfDate, { reportType, todayDate: businessDateKey() });
    }

    if (!snapshot) {
      return Response.json({
        asOfDate,
        snapshot: null,
        openingSnapshot: null,
        positions: [],
        openingPositions: [],
        transactions: [],
        tradingSummary: null
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (reportType === "monthly" && snapshot.reportSnapshotMode === "post_cutoff_capture"
      && snapshot.monthEndApprovalStatus !== "approved") {
      throw new AppRequestError(
        `A ${snapshot.capturedSnapshotDate} portfolio upload contains potentially usable ${monthKey} valuations, but an administrator has not yet approved its period-end source coverage. Open Portfolio Overview, scan the month and approve the eligible capture before preparing the Monthly Wealth Review.`,
        409, "post_cutoff_capture_not_approved"
      );
    }

    if (!closingPositions) closingPositions = await loadSnapshotPositions(snapshot.id);

    // Manual Portfolio Management/PMS is a staff-maintained source. Its
    // freshness is the dated workbook import/account snapshot, not whether
    // every holding row happened to carry a NAV/valuation date. Overlay the
    // source-refresh metadata for legacy snapshots before report verification
    // so a recently maintained PMS portfolio does not show a false missing or
    // stale-source warning. Financial valuation dates remain untouched.
    if (closingPositions.some((item) => String(item.source || "") === "manual")) {
      const manualAccountSnapshotResult = await adminDb.collection("manualPortfolioAccountSnapshots")
        .where("investorId", "==", investorId).get();
      const manualAccountSnapshots = rows(manualAccountSnapshotResult);
      const freshnessReferenceDate = safeDateKey(snapshot.capturedSnapshotDate || snapshot.snapshotDate || asOfDate) || asOfDate;
      closingPositions = overlayManualFreshness(closingPositions, manualAccountSnapshots, freshnessReferenceDate);
      snapshot = patchSnapshotFreshness(snapshot, closingPositions, freshnessReferenceDate);
    }

    const monthStart = `${monthKey}-01`;
    let openingSnapshot = latestVerifiedPortfolioSnapshot(
      snapshots,
      (item) => String(item.snapshotDate || "") < monthStart
    );
    let openingPositions = null;

    if (!openingSnapshot) {
      const openingCutoff = addDaysToDateKey(monthStart, -1);
      const graceOpening = await resolveMonthEndSnapshot({ investorId, snapshots, cutoffDate: openingCutoff });
      openingSnapshot = graceOpening?.snapshot || null;
      openingPositions = graceOpening?.positions || null;
    }

    // For an established monthly-review chain, prefer the previous completed
    // Monthly Wealth Review's frozen closing corpus as the next month's opening
    // value. This prevents later historical portfolio corrections from silently
    // changing an already-reviewed month-to-month performance baseline.
    let openingBaselineSource = openingSnapshot ? "portfolio_snapshot" : "";
    if (previousMonthlyReview?.sourcePortfolioSnapshotId && Number(previousMonthlyReview?.summary?.totalCorpus || 0) >= 0) {
      const previousSnapshotId = String(previousMonthlyReview.sourcePortfolioSnapshotId || "");
      const previousSnapshotDate = safeDateKey(previousMonthlyReview.portfolioAsOfDate || previousMonthlyReview.statementDate || "");
      openingSnapshot = {
        id: previousSnapshotId,
        snapshotDate: previousSnapshotDate,
        verificationStatus: "verified",
        snapshotVersion: Number(previousMonthlyReview.sourcePortfolioSnapshotVersion || 0),
        reportBaseline: true,
        sourceReportId: previousMonthlyReview.id,
        sourceReportMonthKey: previousMonthlyReview.reportMonthKey || "",
        summary: {
          currentValue: Number(previousMonthlyReview.summary?.totalCorpus || 0),
          totalInvested: Number(previousMonthlyReview.summary?.totalInvested || 0),
          monthlySip: Number(previousMonthlyReview.summary?.monthlySip || 0)
        }
      };
      openingPositions = previousSnapshotId ? await loadSnapshotPositions(previousSnapshotId) : [];
      openingBaselineSource = "previous_monthly_review";
    }

    // When the investor's Opening Wealth Review was established earlier in the
    // same month, that verified snapshot is the correct performance baseline for
    // the first Monthly Wealth Review. Example: Opening 11 Sep -> Monthly 30 Sep.
    const sameMonthOpeningDate = sameMonthOpeningBaselineDate(openingWealthReview, asOfDate);
    if (sameMonthOpeningDate) {
      const openingSnapshotId = String(
        openingWealthReview?.openingBaseline?.sourceSnapshotId
          || openingWealthReview?.sourcePortfolioSnapshotId
          || ""
      );
      const openingReportSnapshot = snapshots.find((item) =>
        item.verificationStatus === "verified"
          && (openingSnapshotId ? item.id === openingSnapshotId : String(item.snapshotDate || "") <= sameMonthOpeningDate)
      ) || latestVerifiedPortfolioSnapshot(
        snapshots,
        (item) => String(item.snapshotDate || "") <= sameMonthOpeningDate
      );
      if (openingReportSnapshot) {
        openingSnapshot = openingReportSnapshot;
        openingPositions = await loadSnapshotPositions(openingReportSnapshot.id);
        openingBaselineSource = "opening_wealth_review";
      }
    }

    if (openingSnapshot?.id && !openingPositions) openingPositions = await loadSnapshotPositions(openingSnapshot.id);
    if (!openingPositions) openingPositions = [];

    if (reportType === "monthly") {
      const archiveDocs = await adminDb.collection("portfolioDatedValuations").where("investorId", "==", investorId).get();
      const sourceSet = inspectFrozenSourceSet({
        snapshot, positions: closingPositions, archives: rows(archiveDocs), cutoffDate: asOfDate
      });
      if (!sourceSet.ready) {
        const error = new AppRequestError(
          `Month-end source coverage is incomplete: ${sourceSet.issues.map((item) => item.message).join(" ")} The archived source must pass Check reporting eligibility and be approved as the verified month-end closing before this report can continue.`,
          409, "portfolio_source_coverage_incomplete"
        );
        // The client can invoke its existing guarded automatic close once,
        // while support/QA can identify the precise stale snapshot and archive
        // without guessing or repeatedly uploading old Fundbazaar files.
        error.details = {
          reportingMonth: monthKey,
          cutoffDate: asOfDate,
          selectedSnapshot: { id: snapshot.id, date: safeDateKey(snapshot.snapshotDate), mode: String(snapshot.reportSnapshotMode || "") },
          sourceIssues: sourceSet.issues.map(({ code, source, archiveId, valuationDate }) => ({
            code, source, archiveId: archiveId || "", valuationDate: valuationDate || ""
          })),
          nextAction: "check_reporting_eligibility"
        };
        throw error;
      }
    }

    const reportingLedger = await loadInvestorPortfolioLedger(investorId);
    // Cash ledger is authoritative for managed PMS capital additions and
    // withdrawals. The same normalized movements feed the scanner, financial
    // model and publication guard, including manual_cash_movement actions.
    let transactions = buildMonthlyReportingLedger({
      ledger: reportingLedger, investorId, startDate: monthStart, cutoffDate: asOfDate
    });
    transactions = dedupeActionWithdrawalTransactions(transactions);

    if (reportType === "monthly") {
      // A single max(snapshotDate) can conceal activity after an individual
      // fund's older NAV or a Manual PMS account's older valuation. Check the
      // frozen source/holding dates, never today's upload timestamp.
      const coverage = inspectFrozenMonthlyActivity({
        snapshot, positions: closingPositions, transactions,
        startDate: monthStart, cutoffDate: asOfDate
      });
      if (coverage.invalidPositionDates) {
        throw new AppRequestError(
          `${coverage.invalidPositionDates} frozen holding(s) have missing or post-cutoff source valuation dates. Confirm the actual NAV/PMS valuation dates before preparing this Monthly Wealth Review.`,
          409, "portfolio_monthly_invalid_source_dates"
        );
      }
      const uncovered = coverage.postValuationCash;
      if (uncovered.count) {
        throw new AppRequestError(
          `Financial reconciliation pending. The frozen portfolio has ${uncovered.count} confirmed external cash movement${uncovered.count === 1 ? "" : "s"} after an applicable holding/source valuation date in ${monthKey} (₹${uncovered.newMoney.toLocaleString("en-IN")} invested, ₹${uncovered.withdrawals.toLocaleString("en-IN")} withdrawn). Earlier valuations cannot represent these later investments. Reconcile a complete, verified month-end source; do not use post-cutoff NAVs.`,
          409, "portfolio_closing_snapshot_missing_cash_flow"
        );
      }
      if (coverage.postValuationActivity.count) {
        throw new AppRequestError(
          `${coverage.postValuationActivity.count} confirmed transaction(s) occurred after a holding's frozen valuation date in ${monthKey}. This includes internal switches or PMS trades, not just external money. A newer verified source valuation is required before completing the Wealth Review.`,
          409, "portfolio_historical_snapshot_outdated"
        );
      }
    }

    const tradingId = `${investorId}_${monthKey}`;
    const tradingDoc = await adminDb.collection("tradingMonthlySummaries").doc(tradingId).get();
    const tradingSummary = tradingDoc.exists ? { id: tradingDoc.id, ...tradingDoc.data() } : null;

    const payload = {
      asOfDate: reportType === "opening" && safeDateKey(snapshot.snapshotDate) > asOfDate
        ? safeDateKey(snapshot.snapshotDate)
        : asOfDate,
      snapshot,
      openingSnapshot,
      openingBaselineSource,
      openingMonthlyReportId: openingBaselineSource === "previous_monthly_review" ? (previousMonthlyReview?.id || "") : "",
      openingMonthlyReportMonthKey: openingBaselineSource === "previous_monthly_review" ? (previousMonthlyReview?.reportMonthKey || "") : "",
      positions: closingPositions.map((item) => ({
        ...item,
        goalAllocations: normalisePortfolioGoalAllocations(item.goalAllocations),
        allocationStatus: portfolioAllocationStatus(item.goalAllocations)
      })),
      openingPositions: openingPositions.map((item) => ({
        ...item,
        goalAllocations: normalisePortfolioGoalAllocations(item.goalAllocations),
        allocationStatus: portfolioAllocationStatus(item.goalAllocations)
      })),
      transactions,
      tradingSummary
    };

    return Response.json(serialise(payload), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    // A missing month-end valuation is an expected financial-validation
    // outcome, not a server exception or an investor access failure.
    if (!["portfolio_closing_snapshot_missing_cash_flow", "portfolio_historical_snapshot_outdated", "post_cutoff_capture_not_approved", "portfolio_monthly_invalid_source_dates", "portfolio_source_coverage_incomplete"].includes(error?.code)) {
      console.error("Portfolio report source load failed", error);
    }
    return Response.json(
      {
        error: error?.message || "Unable to load Portfolio Master for this report.",
        code: error?.code || "portfolio_source_load_failed",
        ...(error?.details ? { details: error.details } : {})
      },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
