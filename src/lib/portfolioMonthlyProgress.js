import { comparePortfolioSnapshots, latestPortfolioSnapshotByMonth } from "./portfolioSnapshotSelection.js";
import { externalPortfolioCashFlow, lastCalendarDayOfMonth, unrepresentedExternalCashFlows } from "./portfolioPeriodCoverage.js";

function dateText(value) {
  return String(value || "").slice(0, 10);
}

function monthKey(value) {
  const text = dateText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : "";
}

function snapshotValue(snapshot = {}) {
  const value = Number(snapshot?.summary?.currentValue ?? snapshot?.currentValue ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function currentIndiaMonthKey(now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit"
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 7);
  }
}

export function buildMonthlyPortfolioProgress(snapshots = [], transactions = [], options = {}) {
  const ordered = [...(Array.isArray(snapshots) ? snapshots : [])]
    .filter((item) => monthKey(item?.snapshotDate))
    .sort(comparePortfolioSnapshots);
  if (!ordered.length) return [];

  const latestByMonth = latestPortfolioSnapshotByMonth(ordered);
  const months = [...latestByMonth.keys()].sort();
  const nowMonthKey = options.currentMonthKey || currentIndiaMonthKey(options.now || new Date());

  return months.map((key) => {
    const closingSnapshot = latestByMonth.get(key);
    const closingDate = dateText(closingSnapshot?.snapshotDate);
    const previousSnapshot = [...ordered].reverse().find((item) => dateText(item.snapshotDate) < `${key}-01`) || null;
    const openingDate = dateText(previousSnapshot?.snapshotDate);
    const openingValue = previousSnapshot ? snapshotValue(previousSnapshot) : null;
    const closingValue = snapshotValue(closingSnapshot);
    const periodEndDate = key === nowMonthKey
      ? String(options.todayDate || options.now?.toISOString?.().slice(0, 10) || new Date().toISOString().slice(0, 10))
      : lastCalendarDayOfMonth(key);
    const monthTransactions = (Array.isArray(transactions) ? transactions : []).filter((item) => {
      const txDate = dateText(item?.transactionDate || item?.date);
      return monthKey(txDate) === key && txDate <= periodEndDate;
    });
    // Show confirmed October subscriptions in October even if its last saved
    // snapshot predates them. Never present the earlier snapshot as a valid
    // October closing statement or interpret those purchases as market losses.
    const flows = monthTransactions.reduce((total, item) => {
      const flow = externalPortfolioCashFlow(item);
      total.newMoney += flow.newMoney;
      total.withdrawals += flow.withdrawals;
      total.count += flow.newMoney > 0 || flow.withdrawals > 0 ? 1 : 0;
      return total;
    }, { newMoney: 0, withdrawals: 0, count: 0 });
    const uncovered = unrepresentedExternalCashFlows({ snapshotDate: closingDate, cutoffDate: periodEndDate, transactions: monthTransactions });
    const previousMonthEndDate = new Date(Date.parse(`${key}-01T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const uncoveredOpening = unrepresentedExternalCashFlows({ snapshotDate: openingDate, cutoffDate: previousMonthEndDate, transactions });
    const needsClosingSnapshotRefresh = uncovered.count > 0;
    const needsOpeningSnapshotRefresh = uncoveredOpening.count > 0;
    const needsSnapshotRefresh = needsClosingSnapshotRefresh || needsOpeningSnapshotRefresh;
    const netContribution = flows.newMoney - flows.withdrawals;
    const change = openingValue === null || needsSnapshotRefresh ? null : closingValue - openingValue;
    const investmentGain = openingValue === null || needsSnapshotRefresh ? null : closingValue - openingValue - flows.newMoney + flows.withdrawals;
    const monthlyReturn = openingValue !== null && openingValue > 0 && investmentGain !== null
      ? investmentGain / openingValue * 100
      : null;

    return {
      monthKey: key,
      openingDate,
      closingDate,
      openingValue,
      closingValue,
      newMoney: Number(flows.newMoney.toFixed(2)),
      withdrawals: Number(flows.withdrawals.toFixed(2)),
      netContribution: Number(netContribution.toFixed(2)),
      investmentGain: investmentGain === null ? null : Number(investmentGain.toFixed(2)),
      monthlyReturn: monthlyReturn === null ? null : Number(monthlyReturn.toFixed(4)),
      cashFlowCount: flows.count,
      needsSnapshotRefresh,
      needsClosingSnapshotRefresh,
      needsOpeningSnapshotRefresh,
      unrepresentedCashFlows: uncovered,
      unrepresentedOpeningCashFlows: uncoveredOpening,
      isCurrentMonth: key === nowMonthKey,
      status: needsSnapshotRefresh ? "needs_snapshot_refresh" : key === nowMonthKey ? "mtd" : "closed",
      snapshotId: closingSnapshot?.id || ""
    };
  }).sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
}

export function monthProgressLabel(monthKeyValue = "") {
  const match = String(monthKeyValue).match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKeyValue || "Month";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}
