import {adminDb, verifyStaffRequest, appRequestErrorStatus} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_RECONCILIATION_STATUS,
  PORTFOLIO_RECONCILIATION_THRESHOLDS
} from "@/lib/constants/portfolio";
import { indiaDateKey } from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateMillis(value = "") {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return 0;
  const parsed = new Date(`${text}T00:00:00+05:30`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function daysBetween(left = "", right = "") {
  const leftTime = dateMillis(left);
  const rightTime = dateMillis(right);
  if (!leftTime || !rightTime) return null;
  return Math.max(0, Math.floor((rightTime - leftTime) / DAY_MS));
}

async function accessibleInvestors(actor) {
  let query = adminDb.collection("investors").where("isDeleted", "==", false);
  if (actor.role === "advisor") query = query.where("assignedAdvisorUid", "==", actor.uid);
  const snapshot = await query.get();
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function fallbackStatus(snapshot = null, today = indiaDateKey()) {
  if (!snapshot) return PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE;
  const sources = Array.isArray(snapshot.sourceFreshness) ? snapshot.sourceFreshness : [];
  if (!sources.length) return PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE;
  const missingDate = sources.some((item) => !item.valuationDate || Number(item.missingDateCount || 0) > 0);
  if (missingDate) return PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE;
  const oldest = Math.max(...sources.map((item) => Number(daysBetween(item.oldestValuationDate || item.valuationDate, today) ?? 0)));
  if (oldest > PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS) return PORTFOLIO_RECONCILIATION_STATUS.STALE;
  return PORTFOLIO_RECONCILIATION_STATUS.VERIFIED;
}

function reconciliationRow(investor = {}, snapshot = null, today = indiaDateKey()) {
  const intelligence = snapshot?.intelligence || null;
  const issues = Array.isArray(intelligence?.issues) ? intelligence.issues : [];
  const rawFreshness = Array.isArray(intelligence?.sourceFreshness)
    ? intelligence.sourceFreshness
    : Array.isArray(snapshot?.sourceFreshness) ? snapshot.sourceFreshness : [];
  const sourceFreshness = rawFreshness.map((item) => {
    const referenceDate = item.oldestValuationDate || item.valuationDate || "";
    const age = daysBetween(referenceDate, today);
    let freshnessStatus = "fresh";
    if (!referenceDate || Number(item.missingDateCount || 0) > 0 || age === null) freshnessStatus = "missing";
    else if (age > PORTFOLIO_RECONCILIATION_THRESHOLDS.CRITICAL_STALE_DAYS) freshnessStatus = "critical";
    else if (age > PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS) freshnessStatus = "stale";
    else if (age > PORTFOLIO_RECONCILIATION_THRESHOLDS.FRESH_DAYS) freshnessStatus = "aging";
    return { ...item, ageDays: age, oldestAgeDays: age, freshnessStatus };
  });
  const baseStatus = intelligence?.status || snapshot?.reconciliationStatus || investor.latestPortfolioReconciliationStatus || fallbackStatus(snapshot, today);
  const hasMissingSource = sourceFreshness.some((item) => item.freshnessStatus === "missing");
  const hasStaleSource = sourceFreshness.some((item) => ["stale", "critical"].includes(item.freshnessStatus));
  const status = [PORTFOLIO_RECONCILIATION_STATUS.MISMATCH, PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT, PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW].includes(baseStatus)
    ? baseStatus
    : hasMissingSource
      ? PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE
      : hasStaleSource
        ? PORTFOLIO_RECONCILIATION_STATUS.STALE
        : baseStatus;
  const dynamicIssues = [...issues];
  const hasStoredFreshnessIssue = dynamicIssues.some((item) => ["stale_source", "missing_source_date"].includes(item.code));
  if (hasMissingSource && !hasStoredFreshnessIssue) {
    dynamicIssues.unshift({
      severity: "warn",
      code: "missing_source_date",
      title: "Source valuation date missing",
      description: "One or more active portfolio sources do not have a reliable valuation date. Review the latest source file before relying on freshness."
    });
  } else if (hasStaleSource && !hasStoredFreshnessIssue) {
    const staleNames = sourceFreshness.filter((item) => ["stale", "critical"].includes(item.freshnessStatus)).map((item) => item.sourceLabel || item.source).filter(Boolean);
    dynamicIssues.unshift({
      severity: "warn",
      code: "stale_source",
      title: "Portfolio source is stale",
      description: `${staleNames.join(", ") || "A portfolio source"} has valuation data older than ${PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS} days.`
    });
  }
  const actionableIssues = dynamicIssues.filter((item) => item.severity !== "info");
  const counts = intelligence?.counts || {};
  const concentration = intelligence?.concentration || {};

  return {
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    clientCode: investor.clientCode || "",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    snapshotId: snapshot?.id || investor.latestPortfolioSnapshotId || "",
    snapshotDate: snapshot?.snapshotDate || investor.latestPortfolioSnapshotDate || "",
    portfolioValue: Number(snapshot?.summary?.currentValue ?? investor.latestPortfolioValue ?? 0),
    investedAmount: Number(snapshot?.summary?.totalInvested ?? investor.latestPortfolioInvested ?? 0),
    gainLoss: Number(snapshot?.summary?.gainLoss ?? investor.latestPortfolioGainLoss ?? 0),
    reconciliationStatus: status,
    intelligenceAvailable: Boolean(intelligence),
    issueCount: intelligence ? actionableIssues.length : Math.max(Number(investor.latestPortfolioIssueCount || 0), actionableIssues.length),
    issues: dynamicIssues.slice(0, 8),
    counts: {
      activeHoldings: Number(counts.activeHoldings ?? snapshot?.summary?.positionCount ?? 0),
      newHoldings: Number(counts.newHoldings ?? investor.latestPortfolioNewHoldingCount ?? 0),
      exitedHoldings: Number(counts.exitedHoldings ?? investor.latestPortfolioExitedHoldingCount ?? 0),
      partialExits: Number(counts.partialExits || 0),
      unassignedHoldings: Number(counts.unassignedHoldings ?? investor.latestPortfolioUnassignedCount ?? 0),
      valuationMismatches: Number(counts.valuationMismatches || 0),
      duplicateGroups: Number(counts.duplicateGroups || 0),
      staleSources: Number(counts.staleSources || sourceFreshness.filter((item) => ["stale", "critical"].includes(item.freshnessStatus)).length),
      missingSourceDates: Number(counts.missingSourceDates || sourceFreshness.filter((item) => item.freshnessStatus === "missing").length)
    },
    movement: intelligence?.movement || null,
    concentration: {
      largestHolding: concentration.largestHolding || null,
      largestAssetClass: concentration.largestAssetClass || null,
      largestGoal: concentration.largestGoal || null,
      unassignedPercentage: Number(concentration.unassignedPercentage || 0)
    },
    sourceFreshness,
    updatedAt: snapshot?.updatedAt || investor.latestPortfolioUpdatedAt || null
  };
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const investors = await accessibleInvestors(actor);
    const portfolioInvestors = investors.filter((investor) => investor.latestPortfolioSnapshotId || investor.latestPortfolioUpdatedAt || Number(investor.latestPortfolioValue || 0) > 0);
    const refs = portfolioInvestors
      .filter((investor) => investor.latestPortfolioSnapshotId)
      .map((investor) => adminDb.collection("portfolioSnapshots").doc(investor.latestPortfolioSnapshotId));
    const snapshots = refs.length ? await adminDb.getAll(...refs) : [];
    const snapshotById = new Map();
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) snapshotById.set(snapshot.id, { id: snapshot.id, ...snapshot.data() });
    });

    const today = indiaDateKey();
    const rows = portfolioInvestors.map((investor) => reconciliationRow(
      investor,
      snapshotById.get(investor.latestPortfolioSnapshotId) || null,
      today
    )).sort((a, b) => {
      const priority = {
        [PORTFOLIO_RECONCILIATION_STATUS.MISMATCH]: 6,
        [PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT]: 6,
        [PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE]: 5,
        [PORTFOLIO_RECONCILIATION_STATUS.STALE]: 4,
        [PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW]: 3,
        [PORTFOLIO_RECONCILIATION_STATUS.VERIFIED]: 1
      };
      const statusDelta = Number(priority[b.reconciliationStatus] || 0) - Number(priority[a.reconciliationStatus] || 0);
      if (statusDelta) return statusDelta;
      return String(a.investorName || "").localeCompare(String(b.investorName || ""));
    });

    const summary = rows.reduce((totals, row) => {
      totals.investors += 1;
      if (row.reconciliationStatus === PORTFOLIO_RECONCILIATION_STATUS.VERIFIED) totals.verified += 1;
      else if (row.reconciliationStatus === PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW) totals.needsReview += 1;
      else if ([PORTFOLIO_RECONCILIATION_STATUS.MISMATCH, PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT].includes(row.reconciliationStatus)) totals.mismatch += 1;
      else if (row.reconciliationStatus === PORTFOLIO_RECONCILIATION_STATUS.STALE) totals.stale += 1;
      else if (row.reconciliationStatus === PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE) totals.missingSource += 1;
      totals.newHoldings += Number(row.counts.newHoldings || 0);
      totals.exitedHoldings += Number(row.counts.exitedHoldings || 0);
      totals.unassignedHoldings += Number(row.counts.unassignedHoldings || 0);
      totals.issueCount += Number(row.issueCount || 0);
      return totals;
    }, {
      investors: 0,
      verified: 0,
      needsReview: 0,
      mismatch: 0,
      stale: 0,
      missingSource: 0,
      newHoldings: 0,
      exitedHoldings: 0,
      unassignedHoldings: 0,
      issueCount: 0
    });

    return Response.json({ dateKey: today, summary, rows });
  } catch (error) {
    console.error("Portfolio reconciliation load failed", error);
    return Response.json({ error: error?.message || "Unable to load portfolio reconciliation." }, { status: appRequestErrorStatus(error, 500) });
  }
}
