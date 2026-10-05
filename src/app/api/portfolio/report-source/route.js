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

export const runtime = "nodejs";

const REPORT_SNAPSHOT_CAPTURE_GRACE_DAYS = 5;

function safeDateKey(value = "") {
  const dateKey = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : "";
}

function addDaysToDateKey(dateKey, days) {
  const parsed = Date.parse(`${String(dateKey || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed + Number(days || 0) * 86400000).toISOString().slice(0, 10);
}

function portfolioValueDate(position = {}) {
  return String(position.navDate || position.valuationDate || position.priceDate || "").slice(0, 10);
}

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function latestVerifiedSnapshot(snapshots = [], predicate = () => true) {
  return snapshots
    .filter((item) => item.verificationStatus === "verified" && predicate(item))
    .sort((a, b) => String(b.snapshotDate || "").localeCompare(String(a.snapshotDate || "")))[0] || null;
}

async function loadSnapshotPositions(snapshotId) {
  if (!snapshotId) return [];
  const result = await adminDb.collection("portfolioSnapshotPositions")
    .where("snapshotId", "==", snapshotId)
    .get();
  return rows(result);
}

async function findPostCutoffCaptureSnapshot(snapshots, cutoffDate) {
  const graceEnd = addDaysToDateKey(cutoffDate, REPORT_SNAPSHOT_CAPTURE_GRACE_DAYS);
  if (!cutoffDate || !graceEnd) return null;

  const candidates = snapshots
    .filter((item) => item.verificationStatus === "verified")
    .filter((item) => String(item.snapshotDate || "") > cutoffDate && String(item.snapshotDate || "") <= graceEnd)
    .sort((a, b) => String(a.snapshotDate || "").localeCompare(String(b.snapshotDate || "")));

  const compatible = [];
  for (const candidate of candidates) {
    const positions = await loadSnapshotPositions(candidate.id);
    const datedValues = [
      // Manual PMS sourceFreshness uses the workbook import date from v0.34.27.
      // Do not treat that operational refresh date as the financial value date
      // when deciding whether a post-cutoff capture can be back-dated.
      ...(candidate.sourceFreshness || [])
        .filter((item) => item.freshnessBasis !== "manual_import")
        .map((item) => String(item.valuationDate || "").slice(0, 10)),
      ...positions.map(portfolioValueDate)
    ].filter(Boolean);

    // A later capture is usable only when every dated underlying value belongs
    // to the report cutoff or earlier. This prevents September market values
    // from being pulled backwards into an August report.
    if (!datedValues.length || datedValues.some((value) => value > cutoffDate)) continue;
    const effectiveDate = [...datedValues].sort().at(-1) || cutoffDate;
    compatible.push({ candidate, positions, effectiveDate });
  }

  if (!compatible.length) return null;
  compatible.sort((a, b) => {
    const effectiveCompare = String(b.effectiveDate).localeCompare(String(a.effectiveDate));
    if (effectiveCompare) return effectiveCompare;
    return String(a.candidate.snapshotDate || "").localeCompare(String(b.candidate.snapshotDate || ""));
  });

  const selected = compatible[0];
  return {
    snapshot: {
      ...selected.candidate,
      capturedSnapshotDate: selected.candidate.snapshotDate || "",
      snapshotDate: selected.effectiveDate,
      reportSnapshotMode: "post_cutoff_capture",
      reportCutoffDate: cutoffDate
    },
    positions: selected.positions
  };
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

function overlayManualFreshness(snapshotPositions = [], livePositions = [], manualAccountSnapshots = [], cutoffDate = "") {
  const liveById = new Map(livePositions.map((item) => [String(item.id || item.positionId || ""), item]));
  const latestPmsSnapshotDate = manualAccountSnapshots
    .map((item) => safeDateKey(item.snapshotDate || item.manualImportDate || ""))
    .filter((date) => date && (!cutoffDate || date <= cutoffDate))
    .sort()
    .at(-1) || "";

  return snapshotPositions.map((position) => {
    if (String(position.source || "") !== "manual") return position;
    const live = liveById.get(String(position.positionId || "")) || null;
    const manualManaged = position.manualPortfolioManaged === true || live?.manualPortfolioManaged === true;
    if (!manualManaged) return position;
    const liveRefreshDate = live ? manualPortfolioRefreshDate(live) : "";
    const allowedLiveDate = liveRefreshDate && (!cutoffDate || liveRefreshDate <= cutoffDate) ? liveRefreshDate : "";
    const refreshDate = allowedLiveDate || manualPortfolioRefreshDate(position) || latestPmsSnapshotDate;
    if (!refreshDate) return position;
    return {
      ...position,
      manualPortfolioManaged: true,
      manualImportDate: refreshDate,
      manualSourceRefreshDate: refreshDate,
      manualBulkImportId: position.manualBulkImportId || live?.manualBulkImportId || "",
      freshnessDateBasis: "manual_workbook_import"
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

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { searchParams } = new URL(request.url);
    const investorId = String(searchParams.get("investorId") || "").trim();
    const asOfDate = safeDateKey(searchParams.get("asOfDate"));

    if (!investorId) throw new AppRequestError("Investor is required.", 400, "investor_required");
    if (!asOfDate) throw new AppRequestError("A valid portfolio cutoff date is required.", 400, "portfolio_cutoff_required");

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

    let snapshot = latestVerifiedSnapshot(
      snapshots,
      (item) => String(item.snapshotDate || "") <= asOfDate
    );
    let closingPositions = null;

    if (!snapshot) {
      const graceSnapshot = await findPostCutoffCaptureSnapshot(snapshots, asOfDate);
      snapshot = graceSnapshot?.snapshot || null;
      closingPositions = graceSnapshot?.positions || null;
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

    if (!closingPositions) closingPositions = await loadSnapshotPositions(snapshot.id);

    // Manual Portfolio Management/PMS is a staff-maintained source. Its
    // freshness is the dated workbook import/account snapshot, not whether
    // every holding row happened to carry a NAV/valuation date. Overlay the
    // source-refresh metadata for legacy snapshots before report verification
    // so a recently maintained PMS portfolio does not show a false missing or
    // stale-source warning. Financial valuation dates remain untouched.
    if (closingPositions.some((item) => String(item.source || "") === "manual")) {
      const [liveManualResult, manualAccountSnapshotResult] = await Promise.all([
        adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
        adminDb.collection("manualPortfolioAccountSnapshots").where("investorId", "==", investorId).get()
      ]);
      const livePositions = rows(liveManualResult);
      const manualAccountSnapshots = rows(manualAccountSnapshotResult);
      const freshnessReferenceDate = safeDateKey(snapshot.snapshotDate || asOfDate) || asOfDate;
      closingPositions = overlayManualFreshness(closingPositions, livePositions, manualAccountSnapshots, freshnessReferenceDate);
      snapshot = patchSnapshotFreshness(snapshot, closingPositions, freshnessReferenceDate);
    }

    const monthKey = asOfDate.slice(0, 7);
    const monthStart = `${monthKey}-01`;
    let openingSnapshot = latestVerifiedSnapshot(
      snapshots,
      (item) => String(item.snapshotDate || "") < monthStart
    );
    let openingPositions = null;

    if (!openingSnapshot) {
      const openingCutoff = addDaysToDateKey(monthStart, -1);
      const graceOpening = await findPostCutoffCaptureSnapshot(snapshots, openingCutoff);
      openingSnapshot = graceOpening?.snapshot || null;
      openingPositions = graceOpening?.positions || null;
    }
    if (openingSnapshot?.id && !openingPositions) openingPositions = await loadSnapshotPositions(openingSnapshot.id);
    if (!openingPositions) openingPositions = [];

    const transactionResult = await adminDb.collection("investmentTransactions")
      .where("investorId", "==", investorId)
      .get();
    let transactions = rows(transactionResult)
      .filter((item) => String(item.transactionDate || "") >= monthStart && String(item.transactionDate || "") <= asOfDate)
      .sort((a, b) => dateSortValue(a.transactionDate) - dateSortValue(b.transactionDate));
    transactions = dedupeActionWithdrawalTransactions(transactions);

    const cashResult = await adminDb.collection("manualPortfolioCashLedger")
      .where("investorId", "==", investorId)
      .get();
    const manualCashFlows = rows(cashResult)
      .filter((item) => String(item.entryDate || "") >= monthStart && String(item.entryDate || "") <= asOfDate)
      .sort((a, b) => dateSortValue(a.entryDate) - dateSortValue(b.entryDate))
      .flatMap((item) => {
        const type = String(item.entryType || "").trim().toLowerCase();
        const amount = Math.abs(Number(item.amount || item.signedAmount || 0));
        if (!amount) return [];
        let cashFlowType = "";
        if (type.includes("opening cash") || type.includes("contribution") || type.includes("investor deposit")) cashFlowType = "new_money";
        else if (type.includes("withdrawal") || type.includes("investor withdrawal")) cashFlowType = "withdrawal";
        else if (type.includes("transfer in") || type.includes("transfer out")) cashFlowType = "internal";
        else return [];
        return [{
          id: `manual_cash_${item.id}`,
          investorId,
          source: "manual",
          manualPortfolioCashFlow: true,
          transactionDate: item.entryDate,
          transactionType: `Manual cash - ${item.entryType || cashFlowType}`,
          cashFlowType,
          amount,
          notes: item.notes || item.reference || ""
        }];
      });

    const actionResult = await adminDb.collection("investorActions")
      .where("investorId", "==", investorId)
      .get();
    const confirmedActionCashFlows = rows(actionResult).flatMap((item) => {
      if (item.financialImpactStatus !== "confirmed" || item.financialConfirmationMode !== "manual_cash_movement") return [];
      const transactionDate = String(item.actualFinancialDate || "");
      if (!transactionDate || transactionDate < monthStart || transactionDate > asOfDate) return [];
      const amount = Math.abs(Number(item.actualFinancialAmount || 0));
      if (!amount) return [];
      const cashFlowType = item.financialImpactType === "external_inflow"
        ? "new_money"
        : item.financialImpactType === "external_outflow"
          ? "withdrawal"
          : "";
      if (!cashFlowType) return [];
      return [{
        id: `action_cash_${item.id}`,
        investorId,
        source: "investor_action_confirmation",
        sourceActionId: item.id,
        transactionDate,
        transactionType: item.requestType || item.recommendationType || (cashFlowType === "withdrawal" ? "Confirmed Withdrawal" : "Confirmed Investment"),
        instrumentName: item.relatedInvestmentName || item.requestedAccountReference || "Portfolio",
        cashFlowType,
        financialImpactStatus: "confirmed",
        amount,
        notes: [item.requestedAccountReference, item.actualFinancialReference, item.portfolioConfirmationNote].filter(Boolean).join(" · ")
      }];
    });

    transactions = [...transactions, ...manualCashFlows, ...confirmedActionCashFlows]
      .sort((a, b) => dateSortValue(a.transactionDate) - dateSortValue(b.transactionDate));

    const tradingId = `${investorId}_${monthKey}`;
    const tradingDoc = await adminDb.collection("tradingMonthlySummaries").doc(tradingId).get();
    const tradingSummary = tradingDoc.exists ? { id: tradingDoc.id, ...tradingDoc.data() } : null;

    const payload = {
      asOfDate,
      snapshot,
      openingSnapshot,
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
    console.error("Portfolio report source load failed", error);
    return Response.json(
      { error: error?.message || "Unable to load Portfolio Master for this report." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
