function dateText(value) {
  return String(value || "").slice(0, 10);
}

function monthKey(value) {
  const text = dateText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : "";
}

function amount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function snapshotValue(snapshot = {}) {
  const value = Number(snapshot?.summary?.currentValue ?? snapshot?.currentValue ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function flowForTransaction(item = {}) {
  const value = amount(item.amount ?? item.purchaseAmount ?? item.investedAmount);
  if (!(value > 0)) return { newMoney: 0, withdrawals: 0 };
  const flow = String(item.cashFlowType || "").toLowerCase();
  const type = String(item.transactionType || item.type || item.sourceTransactionType || "").toLowerCase();
  const status = String(item.financialImpactStatus || item.transactionStatus || "confirmed").toLowerCase();
  if (["planned", "pending", "in_progress", "awaiting_portfolio_confirmation"].includes(status)) return { newMoney: 0, withdrawals: 0 };
  if (flow === "withdrawal" || /redemption|redeem|withdraw|sell/.test(type)) return { newMoney: 0, withdrawals: value };
  if (flow === "new_money" || (!flow && !/switch|redemption|redeem|withdraw|sell|dividend/.test(type))) return { newMoney: value, withdrawals: 0 };
  return { newMoney: 0, withdrawals: 0 };
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
    .sort((a, b) => String(a.snapshotDate || "").localeCompare(String(b.snapshotDate || "")));
  if (!ordered.length) return [];

  const latestByMonth = new Map();
  ordered.forEach((item) => latestByMonth.set(monthKey(item.snapshotDate), item));
  const months = [...latestByMonth.keys()].sort();
  const nowMonthKey = options.currentMonthKey || currentIndiaMonthKey(options.now || new Date());

  return months.map((key) => {
    const closingSnapshot = latestByMonth.get(key);
    const closingDate = dateText(closingSnapshot?.snapshotDate);
    const previousSnapshot = [...ordered].reverse().find((item) => dateText(item.snapshotDate) < `${key}-01`) || null;
    const openingDate = dateText(previousSnapshot?.snapshotDate);
    const openingValue = previousSnapshot ? snapshotValue(previousSnapshot) : null;
    const closingValue = snapshotValue(closingSnapshot);

    const flows = (Array.isArray(transactions) ? transactions : []).reduce((total, item) => {
      const txDate = dateText(item?.transactionDate || item?.date);
      if (!txDate || monthKey(txDate) !== key || txDate > closingDate) return total;
      const flow = flowForTransaction(item);
      total.newMoney += flow.newMoney;
      total.withdrawals += flow.withdrawals;
      total.count += flow.newMoney > 0 || flow.withdrawals > 0 ? 1 : 0;
      return total;
    }, { newMoney: 0, withdrawals: 0, count: 0 });

    const netContribution = flows.newMoney - flows.withdrawals;
    const change = openingValue === null ? null : closingValue - openingValue;
    const investmentGain = openingValue === null ? null : closingValue - openingValue - flows.newMoney + flows.withdrawals;
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
      isCurrentMonth: key === nowMonthKey,
      status: key === nowMonthKey ? "mtd" : "closed",
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
