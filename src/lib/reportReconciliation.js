import { REPORT_TYPE } from "@/lib/constants/report";
import { derivePortfolioGoalProgress, normaliseGoalName } from "@/lib/portfolioGoalAllocation";

function amount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toleranceFor(total) {
  return Math.max(1, Math.abs(amount(total)) * 0.0005);
}

function check(id, label, status, detail, expected = null, actual = null) {
  return { id, label, status, detail, expected, actual };
}

function findGoal(goals, candidate) {
  const id = String(candidate?.goalId || candidate?.id || "").trim();
  if (id) {
    const exact = goals.find((goal) => String(goal.goalId || goal.id || "").trim() === id);
    if (exact) return exact;
  }
  const name = normaliseGoalName(candidate?.name || candidate?.goalName || "");
  return name ? goals.find((goal) => normaliseGoalName(goal.name || goal.goalName || "") === name) || null : null;
}

/**
 * Pure pre-publish reconciliation for the frozen report payload.
 * It deliberately validates only facts that must agree inside the report;
 * Portfolio Master verification/freshness remains a separate control.
 */
export function buildReportReconciliation(report = {}) {
  const funds = Array.isArray(report.funds) ? report.funds : [];
  const goals = Array.isArray(report.goals) ? report.goals : [];
  const holdings = Array.isArray(report.holdings) ? report.holdings : [];
  const reportType = report.reportType === REPORT_TYPE.OPENING ? REPORT_TYPE.OPENING : REPORT_TYPE.MONTHLY;
  const totalCorpus = amount(report.summary?.totalCorpus);
  const monthlySip = amount(report.summary?.monthlySip);
  const fundCorpus = funds.reduce((sum, item) => sum + amount(item.currentValue), 0);
  const fundSip = funds.reduce((sum, item) => sum + amount(item.monthlySip), 0);
  const holdingCorpus = holdings.reduce((sum, item) => sum + amount(item.currentValue), 0);
  const goalProgress = derivePortfolioGoalProgress(goals, funds);
  const checks = [];

  const corpusTolerance = toleranceFor(totalCorpus);
  const corpusDifference = Math.abs(fundCorpus - totalCorpus);
  checks.push(check(
    "portfolio_total",
    "Portfolio total reconciles",
    corpusDifference <= corpusTolerance ? "pass" : "block",
    corpusDifference <= corpusTolerance
      ? "Investment-wise current values reconcile to the report portfolio total."
      : `Investment-wise current values differ from the report portfolio total by ${corpusDifference.toFixed(2)}.`,
    Number(totalCorpus.toFixed(2)),
    Number(fundCorpus.toFixed(2))
  ));

  const sipTolerance = Math.max(1, Math.abs(monthlySip) * 0.001);
  const sipDifference = Math.abs(fundSip - monthlySip);
  checks.push(check(
    "active_sip",
    "Active monthly SIP reconciles",
    sipDifference <= sipTolerance ? "pass" : "block",
    sipDifference <= sipTolerance
      ? "Investment-wise active SIP reconciles to the report summary."
      : `Investment-wise active SIP differs from the report summary by ${sipDifference.toFixed(2)}.`,
    Number(monthlySip.toFixed(2)),
    Number(fundSip.toFixed(2))
  ));

  if (holdings.length) {
    const holdingDifference = Math.abs(holdingCorpus - totalCorpus);
    checks.push(check(
      "asset_allocation_total",
      "Asset allocation reconciles",
      holdingDifference <= corpusTolerance ? "pass" : "block",
      holdingDifference <= corpusTolerance
        ? "Asset-class current values reconcile to the report portfolio total."
        : `Asset-class values differ from the report portfolio total by ${holdingDifference.toFixed(2)}.`,
      Number(totalCorpus.toFixed(2)),
      Number(holdingCorpus.toFixed(2))
    ));
  } else {
    checks.push(check("asset_allocation_total", "Asset allocation reconciles", totalCorpus > 0 ? "warn" : "pass", "No asset-class rows are available for reconciliation."));
  }

  let goalMismatchCount = 0;
  goals.forEach((goal) => {
    const expectedGoal = findGoal(goalProgress.goals, goal);
    const expected = amount(expectedGoal?.currentAmount);
    const actual = amount(goal.currentAmount);
    if (Math.abs(expected - actual) > toleranceFor(expected || actual || totalCorpus)) goalMismatchCount += 1;
  });
  checks.push(check(
    "goal_corpus",
    "Goal / Bucket List corpus reconciles",
    goalProgress.invalidGoalAllocations.length || goalMismatchCount ? "block" : "pass",
    goalProgress.invalidGoalAllocations.length
      ? `${goalProgress.invalidGoalAllocations.length} investment allocation references a goal that is not present in this report.`
      : goalMismatchCount
        ? `${goalMismatchCount} goal corpus value${goalMismatchCount === 1 ? " does" : "s do"} not match the investments allocated to the goal.`
        : goals.length
          ? "Every goal's current corpus is derived from the investments allocated to that goal."
          : "No specific Bucket List goal is required; unallocated long-term wealth remains in General Wealth."
  ));

  let goalStatusMismatchCount = 0;
  if (report.reportGenerationSource === "portfolio_master") {
    goals.forEach((goal) => {
      const expectedGoal = findGoal(goalProgress.goals, goal);
      if (!expectedGoal) return;
      const actualStatus = String(goal.status || "").trim();
      const expectedStatus = String(expectedGoal.status || "").trim();
      const actualSip = amount(goal.monthlySip ?? goal.monthlyContribution);
      const expectedSip = amount(expectedGoal.monthlySip ?? expectedGoal.monthlyContribution);
      if (actualStatus !== expectedStatus || Math.abs(actualSip - expectedSip) > Math.max(1, Math.abs(expectedSip) * 0.001)) {
        goalStatusMismatchCount += 1;
      }
    });
  }
  checks.push(check(
    "goal_status_sip",
    "Goal status and Active SIP agree",
    goalStatusMismatchCount ? "block" : "pass",
    goalStatusMismatchCount
      ? `${goalStatusMismatchCount} goal status/SIP value${goalStatusMismatchCount === 1 ? " is" : "s are"} inconsistent with Portfolio Master allocations.`
      : "Goal status and Active SIP are consistent with Portfolio Master allocations."
  ));

  const generalPlusGoals = goalProgress.assignedGoalCorpus + goalProgress.generalWealthCorpus;
  const allocationDifference = Math.abs(generalPlusGoals - totalCorpus);
  checks.push(check(
    "goal_allocation_total",
    "Goal allocation covers the portfolio",
    allocationDifference <= corpusTolerance ? "pass" : "block",
    allocationDifference <= corpusTolerance
      ? "Goal-linked corpus plus General Wealth reconciles to the full long-term portfolio."
      : `Goal-linked corpus plus General Wealth differs from the portfolio total by ${allocationDifference.toFixed(2)}.`,
    Number(totalCorpus.toFixed(2)),
    Number(generalPlusGoals.toFixed(2))
  ));

  if (reportType === REPORT_TYPE.OPENING) {
    const baselineId = String(report.openingBaseline?.sourceSnapshotId || "");
    const sourceId = String(report.sourcePortfolioSnapshotId || "");
    const baselineDate = report.openingBaseline?.asOfDate || report.openingBaseline?.sourceSnapshotDate || "";
    checks.push(check(
      "opening_baseline",
      "Opening baseline is established",
      sourceId && baselineId === sourceId && baselineDate ? "pass" : "block",
      sourceId && baselineId === sourceId && baselineDate
        ? `The verified Portfolio Master snapshot establishes the opening baseline as of ${baselineDate}.`
        : "The Opening Wealth Review must be tied to the same verified Portfolio Master snapshot used by the report."
    ));
  }

  const verification = report.portfolioVerification || null;
  if (verification?.required) {
    const blocked = ["blocked", "pending"].includes(String(verification.status || ""));
    const reviewRequired = verification.status === "review_required" && !verification.acknowledged;
    checks.push(check(
      "portfolio_verification",
      "Portfolio Master verification",
      blocked || reviewRequired ? "block" : "pass",
      blocked
        ? "Portfolio Master verification is blocked or pending."
        : reviewRequired
          ? "Portfolio Master warnings must be reviewed and acknowledged before publication."
          : "Portfolio Master verification is ready for publication."
    ));
  }

  const blockerCount = checks.filter((item) => item.status === "block").length;
  const warningCount = checks.filter((item) => item.status === "warn").length;
  return {
    status: blockerCount ? "blocked" : warningCount ? "warning" : "pass",
    blockerCount,
    warningCount,
    checks,
    totals: {
      totalCorpus: Number(totalCorpus.toFixed(2)),
      investmentCorpus: Number(fundCorpus.toFixed(2)),
      activeMonthlySip: Number(monthlySip.toFixed(2)),
      investmentMonthlySip: Number(fundSip.toFixed(2)),
      assignedGoalCorpus: goalProgress.assignedGoalCorpus,
      generalWealthCorpus: goalProgress.generalWealthCorpus,
      invalidGoalAllocationCount: goalProgress.invalidGoalAllocations.length
    }
  };
}
