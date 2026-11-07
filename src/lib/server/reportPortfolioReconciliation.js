import { adminDb } from "@/lib/server/firebaseAdmin";
import { inspectFrozenSourceSet } from "@/lib/portfolioMonthlyIntegrity";
import { lastCalendarDayOfMonth } from "@/lib/portfolioPeriodCoverage";
import { resolveMonthEndSnapshot } from "@/lib/server/portfolioMonthEndSelection";
import { REPORT_TYPE } from "@/lib/constants/report";
import { checkReportCashFlowCoverage, checkHistoricalInvestmentActivityCoverage, inspectStoredMonthlySourceCoverage } from "@/lib/server/portfolioReportCashFlowCoverage";
import {
  comparePortfolioSnapshots,
  selectVerifiedMonthEndClosingSnapshot,
  snapshotRevisionValue
} from "@/lib/portfolioSnapshotSelection";

function safeDateKey(value = "") {
  const key = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function reportCutoffDate(report = {}) {
  return safeDateKey(
    report.reportingPeriod?.portfolioCutoffDate
      || report.statementDate
      || report.portfolioAsOfDate
      || ""
  );
}

function staleReasonMessage(details = {}, actionLabel = "continue") {
  const cutoff = details.cutoffDate || "the reporting cutoff";
  const reportVersion = Number(details.reportSnapshotVersion || 0);
  const latestVersion = Number(details.latestSnapshotVersion || 0);
  const versionText = latestVersion > reportVersion
    ? ` Snapshot revision ${reportVersion || "-"} has been replaced by revision ${latestVersion}.`
    : "";
  return `Portfolio data for ${cutoff} changed after this Wealth Review was prepared.${versionText} Refresh Financial Data, review the recalculated figures, and complete the report again before you ${actionLabel}.`;
}

export async function inspectReportPortfolioReconciliation(report = {}) {
  if (report.reportType === REPORT_TYPE.OPENING) {
    return { required: false, status: "not_required", reason: "opening_review" };
  }
  if (!report.investorId) {
    return { required: true, status: "blocked", reason: "investor_missing", message: "Investor is missing from this Monthly Wealth Review." };
  }

  const cutoffDate = reportCutoffDate(report);
  if (!cutoffDate) {
    return { required: true, status: "blocked", reason: "cutoff_missing", message: "The Monthly Wealth Review reporting cutoff is missing." };
  }

  const reportMonthKey = String(report.reportMonthKey || cutoffDate.slice(0, 7));
  const mandatoryCutoff = lastCalendarDayOfMonth(reportMonthKey);
  if (!mandatoryCutoff || cutoffDate !== mandatoryCutoff) {
    return { required: true, status: "blocked", reason: "incorrect_monthly_cutoff", cutoffDate,
      message: `Monthly Wealth Reviews must close on the final calendar day of the selected month (${mandatoryCutoff || "invalid month"}). September/October investment periods cannot use an interim or next-month date.` };
  }

  const sourceSnapshotId = String(report.sourcePortfolioSnapshotId || "").trim();
  const reportSnapshotVersion = Number(report.sourcePortfolioSnapshotVersion || 0);
  if (!sourceSnapshotId) {
    return {
      required: true,
      status: "stale",
      reason: "source_snapshot_missing",
      cutoffDate,
      reportSnapshotVersion,
      latestSnapshotId: "",
      latestSnapshotVersion: 0,
      message: `This Monthly Wealth Review is not linked to a verified Portfolio Master snapshot for ${cutoffDate}. Refresh Financial Data before continuing.`
    };
  }

  const sourceDoc = await adminDb.collection("portfolioSnapshots").doc(sourceSnapshotId).get();
  if (!sourceDoc.exists) {
    return {
      required: true,
      status: "stale",
      reason: "source_snapshot_deleted",
      cutoffDate,
      sourceSnapshotId,
      reportSnapshotVersion,
      latestSnapshotId: "",
      latestSnapshotVersion: 0,
      message: `The Portfolio Master snapshot used by this Monthly Wealth Review is no longer available. Refresh Financial Data before continuing.`
    };
  }

  const sourceSnapshot = { id: sourceDoc.id, ...sourceDoc.data() };
  if (String(sourceSnapshot.investorId || "") !== String(report.investorId || "")) {
    return {
      required: true,
      status: "blocked",
      reason: "source_snapshot_investor_mismatch",
      cutoffDate,
      sourceSnapshotId,
      reportSnapshotVersion,
      message: "The Portfolio Master snapshot does not belong to this investor. Refresh Financial Data before continuing."
    };
  }
  const sourceCurrentVersion = Number(sourceSnapshot.snapshotVersion || 0);
  const sourceSnapshotDate = safeDateKey(sourceSnapshot.snapshotDate);
  if (sourceSnapshot.verificationStatus !== "verified") {
    return {
      required: true,
      status: "stale",
      reason: "source_snapshot_not_verified",
      cutoffDate,
      sourceSnapshotId,
      sourceSnapshotDate,
      reportSnapshotVersion,
      latestSnapshotId: sourceSnapshotId,
      latestSnapshotVersion: sourceCurrentVersion,
      message: `The Portfolio Master snapshot linked to this report is no longer verified. Refresh Financial Data and resolve Portfolio Verification before continuing.`
    };
  }

  let approvedClosingSnapshotForCoverage = sourceSnapshot;
  // Revalidate captures imported in the first week of the following month.
  // A new November purchase may later be entered with an effective date before
  // that capture, making it ineligible for October even if its NAV is old.
  if (sourceSnapshotDate > cutoffDate) {
    const snapshotDocs = await adminDb.collection("portfolioSnapshots").where("investorId", "==", report.investorId).get();
    const candidates = snapshotDocs.docs.map((item) => ({ id: item.id, ...item.data() }));
    const selection = await resolveMonthEndSnapshot({ investorId: report.investorId, snapshots: candidates, cutoffDate });
    if (selection.snapshot?.id !== sourceSnapshotId || selection.snapshot?.reportSnapshotMode !== "post_cutoff_capture"
      || selection.snapshot?.monthEndApprovalStatus !== "approved") {
      return {
        required: true, status: "stale", reason: "post_cutoff_capture_invalid", cutoffDate,
        sourceSnapshotId, sourceSnapshotDate, reportSnapshotVersion,
        message: "The post-month-end portfolio capture is not approved, has changed, or now contains post-cutoff activity. Refresh and reconcile before PDF generation or publication."
      };
    }
    const effectiveNavDate = safeDateKey(selection.snapshot.snapshotDate);
    approvedClosingSnapshotForCoverage = { ...sourceSnapshot,
      snapshotDate: effectiveNavDate, reportSnapshotMode: "post_cutoff_capture",
      reportCutoffDate: cutoffDate };
    if (effectiveNavDate && effectiveNavDate < cutoffDate) {
      const [uncoveredCash, laterInvestments] = await Promise.all([
        checkReportCashFlowCoverage(report.investorId, effectiveNavDate, cutoffDate),
        checkHistoricalInvestmentActivityCoverage(report.investorId, effectiveNavDate, cutoffDate)
      ]);
      if (uncoveredCash.count || laterInvestments.count) {
        return {
          required: true, status: "stale", reason: "post_cutoff_capture_late_october_movements", cutoffDate,
          sourceSnapshotId, sourceSnapshotDate, reportSnapshotVersion,
          message: `${uncoveredCash.count} external cash movement(s) and ${laterInvestments.count} investment transaction(s) were recorded after the approved ${effectiveNavDate} valuation and inside the reporting month. Confirm a later complete source value before generating or publishing this Wealth Review.`
        };
      }
    }
  }

  // First protect the exact source document. This is the important same-date
  // revision case: Portfolio Master rebuilds the deterministic month-end
  // snapshot document and increments snapshotVersion.
  if (sourceCurrentVersion > reportSnapshotVersion) {
    const details = {
      required: true,
      status: "stale",
      reason: "source_snapshot_revision_advanced",
      cutoffDate,
      sourceSnapshotId,
      sourceSnapshotDate,
      reportSnapshotVersion,
      latestSnapshotId: sourceSnapshotId,
      latestSnapshotDate: sourceSnapshotDate,
      latestSnapshotVersion: sourceCurrentVersion
    };
    return { ...details, message: staleReasonMessage(details) };
  }

  // A report is not reconciled simply because its snapshot ID/version matches.
  // Verify the closing valuation too: some legacy snapshot refreshes replaced
  // financial values without incrementing the snapshot version.
  const snapshotClosing = sourceSnapshot.summary?.currentValue;
  const reportClosing = report.summary?.totalCorpus;
  if (snapshotClosing !== null && snapshotClosing !== undefined
    && reportClosing !== null && reportClosing !== undefined
    && Number.isFinite(Number(snapshotClosing)) && Number.isFinite(Number(reportClosing))
    && Math.abs(Number(snapshotClosing) - Number(reportClosing)) > Math.max(1, Math.abs(Number(snapshotClosing)) * 0.0005)) {
    return {
      required: true,
      status: "stale",
      reason: "financial_summary_mismatch",
      cutoffDate,
      sourceSnapshotId,
      sourceSnapshotDate,
      reportSnapshotVersion,
      latestSnapshotId: sourceSnapshotId,
      latestSnapshotVersion: sourceCurrentVersion,
      message: `Closing portfolio in this Wealth Review no longer matches the verified Portfolio Master value for ${cutoffDate}. Refresh Financial Data, review the recalculated figures, and complete the report again.`
    };
  }

  // A mixed-source snapshot can have MF NAVs dated 30 Oct and PMS account
  // valuations on 31 Oct. Check EACH frozen source date, not only the max
  // snapshotDate; otherwise a late SIP/withdrawal could be missed at publish.
  const frozenCoverage = await inspectStoredMonthlySourceCoverage({
    investorId: report.investorId, snapshot: approvedClosingSnapshotForCoverage, cutoffDate
  });
  const [sourceArchivesDocs, frozenPositionDocs] = await Promise.all([
    adminDb.collection("portfolioDatedValuations").where("investorId", "==", report.investorId).get(),
    adminDb.collection("portfolioSnapshotPositions").where("snapshotId", "==", sourceSnapshotId).get()
  ]);
  const sourceSet = inspectFrozenSourceSet({
    snapshot: approvedClosingSnapshotForCoverage, positions: frozenPositionDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    archives: sourceArchivesDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() })), cutoffDate
  });
  if (!sourceSet.ready) {
    return {
      required: true, status: "stale", reason: "month_end_source_set_incomplete",
      cutoffDate, sourceSnapshotId, sourceSnapshotDate, reportSnapshotVersion,
      message: `The closing portfolio is missing a newer original source: ${sourceSet.issues.map((item) => item.message).join(" ")} Refresh and reconcile before completing or publishing.`
    };
  }
  if (frozenCoverage.invalidPositionDates || frozenCoverage.postValuationActivity.count) {
    return {
      required: true, status: "stale", reason: "frozen_source_activity_after_valuation",
      cutoffDate, sourceSnapshotId, sourceSnapshotDate, reportSnapshotVersion,
      sourceIntegrity: frozenCoverage,
      message: frozenCoverage.invalidPositionDates
        ? `${frozenCoverage.invalidPositionDates} frozen source dates are missing or outside ${cutoffDate}. Refresh and reconcile the dated source before publishing.`
        : `${frozenCoverage.postValuationActivity.count} confirmed financial movement(s) occurred after their own holding/source NAV date, including ₹${frozenCoverage.postValuationCash.newMoney.toLocaleString("en-IN")} fresh capital. Reconcile the full month-end portfolio before generating a PDF or publishing.`
    };
  }

  // If the report uses a normal on/before-cutoff snapshot, also ensure another
  // newer verified snapshot has not become the preferred month-end source.
  // Post-cutoff grace captures are checked by exact source-document revision
  // above because their physical snapshotDate can be after the report cutoff.
  if (sourceSnapshotDate && sourceSnapshotDate <= cutoffDate) {
    const result = await adminDb.collection("portfolioSnapshots")
      .where("investorId", "==", report.investorId)
      .get();
    const snapshots = result.docs.map((item) => ({ id: item.id, ...item.data() }));
    const latestSnapshot = selectVerifiedMonthEndClosingSnapshot(snapshots, cutoffDate);

    if (latestSnapshot && latestSnapshot.id !== sourceSnapshotId
      && (safeDateKey(latestSnapshot.snapshotDate) >= sourceSnapshotDate || comparePortfolioSnapshots(latestSnapshot, sourceSnapshot) > 0)) {
      const latestRevision = snapshotRevisionValue(latestSnapshot);
      const details = {
        required: true,
        status: "stale",
        reason: "newer_month_end_snapshot_available",
        cutoffDate,
        sourceSnapshotId,
        sourceSnapshotDate,
        reportSnapshotVersion,
        latestSnapshotId: latestSnapshot.id,
        latestSnapshotDate: safeDateKey(latestSnapshot.snapshotDate),
        latestSnapshotVersion: Number(latestSnapshot.snapshotVersion || latestRevision.version || 0)
      };
      return { ...details, message: staleReasonMessage(details) };
    }
  }

  // A matching snapshot ID and revision is not enough: transactions imported
  // after that valuation may be dated inside the report month. A 05 October
  // closing snapshot cannot be combined with SIP purchases dated 06-31 October.
  // This guard also runs before completing, generating PDFs and publishing.
  if (sourceSnapshotDate && sourceSnapshotDate < cutoffDate) {
    const uncovered = await checkReportCashFlowCoverage(report.investorId, sourceSnapshotDate, cutoffDate);
    if (uncovered.count) {
      return {
        required: true,
        status: "stale",
        reason: "cash_flows_after_closing_snapshot",
        cutoffDate,
        sourceSnapshotId,
        sourceSnapshotDate,
        reportSnapshotVersion,
        uncoveredCashFlows: uncovered,
        message: `The Wealth Review uses a portfolio snapshot from ${sourceSnapshotDate}, but ${uncovered.count} confirmed cash movement${uncovered.count === 1 ? "" : "s"} occurred after that date and before the reporting cutoff (${cutoffDate}). A newer verified month-end valuation is required before this report can be completed, converted to PDF or published.`
      };
    }
  }

  if (["approved_historical_source", "approved_historical_multi_source", "post_cutoff_capture"].includes(sourceSnapshot.reportSnapshotMode) && sourceSnapshotDate < cutoffDate) {
    const changed = await checkHistoricalInvestmentActivityCoverage(report.investorId, sourceSnapshotDate, cutoffDate);
    if (changed.count) return {
      required: true, status: "stale", reason: "transactions_after_approved_historical_nav",
      cutoffDate, sourceSnapshotId, sourceSnapshotDate, reportSnapshotVersion,
      message: `New portfolio transaction(s) were recorded after the approved ${sourceSnapshotDate} NAV date. Refresh with a newer verified historical source before completing, generating a PDF or publishing.`
    };
  }

  return {
    required: true,
    status: "current",
    reason: "reconciled",
    cutoffDate,
    sourceSnapshotId,
    sourceSnapshotDate,
    reportSnapshotVersion,
    latestSnapshotId: sourceSnapshotId,
    latestSnapshotDate: sourceSnapshotDate,
    latestSnapshotVersion: sourceCurrentVersion,
    checkedAt: new Date()
  };
}

export async function assertReportPortfolioCurrent(report = {}, { actionLabel = "continue" } = {}) {
  const reconciliation = await inspectReportPortfolioReconciliation(report);
  if (reconciliation.status === "current" || reconciliation.status === "not_required") return reconciliation;
  const error = new Error(reconciliation.message || staleReasonMessage(reconciliation, actionLabel));
  error.statusCode = 409;
  error.code = "report_portfolio_stale";
  error.reconciliation = reconciliation;
  throw error;
}
