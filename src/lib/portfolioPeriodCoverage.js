/**
 * A portfolio snapshot must include confirmed external cash movements dated on
 * or before the statement cutoff. Otherwise closing minus opening minus fresh
 * money will manufacture an investment loss for money added after the snapshot.
 * The helper is shared by reports, Portfolio Master history, and investor cards.
 */
function dateKey(value = "") {
  const key = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

/**
 * Stopping, pausing, skipping or resuming a SIP is an instruction affecting the
 * future schedule. It is NOT a purchase, redemption or quantity movement.
 * A confirmed redemption can separately carry sipInstruction="stop"; its
 * transactionType remains "redemption" and must retain its cash impact.
 */
export function isSipInstructionOnly(item = {}) {
  const type = String(item.transactionType || item.type || item.sourceTransactionType || "").trim().toLowerCase();
  return /^(?:sip|systematic investment plan)(?:[\s_-]+(?:instruction|mandate))?[\s_:\-/]*(?:stop(?:ped)?|paus(?:e|ed)|cancel(?:led|ed)?|skip(?:ped)?|suspend(?:ed)?|restart(?:ed)?|resume(?:d)?|hold|clos(?:e|ed)|terminat(?:e|ed)|deactivat(?:e|ed)|activat(?:e|ed)|fail(?:ed)?|bounce(?:d)?|reject(?:ed)?|unsuccessful|not[\s_-]+processed)\b/.test(type)
    || /^(?:stop(?:ped)?|paus(?:e|ed)|cancel(?:led|ed)?|skip(?:ped)?|suspend(?:ed)?|restart(?:ed)?|resume(?:d)?|clos(?:e|ed)|terminat(?:e|ed))\s+(?:sip|systematic investment plan)\b/.test(type)
    || /^(?:sip|systematic investment plan)[\s_:\-/]+(?:purchase|instalment|installment|debit)[\s_:\-/]+(?:fail(?:ed)?|bounce(?:d)?|reject(?:ed)?|cancel(?:led|ed)?|revers(?:e|ed)|unsuccessful)\b/.test(type);
}

const INACTIVE_TRANSACTION_STATUSES = new Set([
  "planned", "pending", "in_progress", "awaiting_portfolio_confirmation",
  "cancelled", "canceled", "rejected", "failed", "skipped", "paused", "stopped"
]);

/** A report-side financial movement must be actual, not a SIP instruction. */
export function isConfirmedInvestmentActivity(item = {}) {
  if (isSipInstructionOnly(item)) return false;
  const financialStatus = String(item.financialImpactStatus || "").trim().toLowerCase();
  const transactionStatus = String(item.transactionStatus || "").trim().toLowerCase();
  // Test both statuses: a confirmed workflow wrapper must not revive an
  // underlying cancelled/failed SIP purchase.
  return !INACTIVE_TRANSACTION_STATUSES.has(financialStatus)
    && !INACTIVE_TRANSACTION_STATUSES.has(transactionStatus);
}

export function externalPortfolioCashFlow(item = {}) {
  if (!isConfirmedInvestmentActivity(item)) return { newMoney: 0, withdrawals: 0 };
  const amount = Math.abs(Number(item.amount ?? item.purchaseAmount ?? item.investedAmount ?? 0));
  if (!Number.isFinite(amount) || !(amount > 0)) return { newMoney: 0, withdrawals: 0 };
  const flow = String(item.cashFlowType || "").trim().toLowerCase();
  const type = String(item.transactionType || item.type || item.sourceTransactionType || "").toLowerCase();
  if (flow === "withdrawal") return { newMoney: 0, withdrawals: amount };
  if (flow === "new_money") return { newMoney: amount, withdrawals: 0 };
  if (["internal", "review", "internal_or_withdrawal_review", "non_cashflow", "non_cash_flow", "none"].includes(flow)) return { newMoney: 0, withdrawals: 0 };
  if (/switch\s*in|switch\s*out|transfer\s*in|transfer\s*out/.test(type)) return { newMoney: 0, withdrawals: 0 };
  if (/redemption|redeem|withdraw/.test(type)) return { newMoney: 0, withdrawals: amount };
  if (/sip|purchase|lump\s*sum|investment|deposit|fresh\s*buy|contribution/.test(type)) return { newMoney: amount, withdrawals: 0 };
  return { newMoney: 0, withdrawals: 0 };
}

export function unrepresentedExternalCashFlows({ snapshotDate = "", cutoffDate = "", transactions = [] } = {}) {
  const snapshot = dateKey(snapshotDate);
  const cutoff = dateKey(cutoffDate);
  const summary = { count: 0, newMoney: 0, withdrawals: 0, latestDate: "", sources: [] };
  if (!snapshot || !cutoff || snapshot >= cutoff) return summary;
  const sources = new Set();
  for (const item of Array.isArray(transactions) ? transactions : []) {
    const transactionDate = dateKey(item?.transactionDate || item?.entryDate || item?.date);
    if (!transactionDate || transactionDate <= snapshot || transactionDate > cutoff) continue;
    const flow = externalPortfolioCashFlow(item);
    if (!flow.newMoney && !flow.withdrawals) continue;
    summary.count += 1;
    summary.newMoney += flow.newMoney;
    summary.withdrawals += flow.withdrawals;
    if (transactionDate > summary.latestDate) summary.latestDate = transactionDate;
    if (item?.source || item?.provider) sources.add(String(item.source || item.provider));
  }
  summary.newMoney = Number(summary.newMoney.toFixed(2));
  summary.withdrawals = Number(summary.withdrawals.toFixed(2));
  summary.sources = [...sources].sort();
  return summary;
}

export function lastCalendarDayOfMonth(month = "") {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return "";
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

/**
 * A historical closing valuation also becomes obsolete if units changed after
 * its NAV date through a switch or reinvestment (even with ZERO fresh money).
 * A separate check is required because external cash-flow coverage alone
 * intentionally ignores internal movements.
 */
export function postValuationInvestmentActivity({ snapshotDate = "", cutoffDate = "", transactions = [] } = {}) {
  const snapshot = dateKey(snapshotDate);
  const cutoff = dateKey(cutoffDate);
  const result = { count: 0, latestDate: "" };
  if (!snapshot || !cutoff || snapshot >= cutoff) return result;
  for (const item of Array.isArray(transactions) ? transactions : []) {
    const transactionDate = dateKey(item?.transactionDate || item?.entryDate || item?.date);
    if (!transactionDate || transactionDate <= snapshot || transactionDate > cutoff) continue;
    if (!isConfirmedInvestmentActivity(item)) continue;
    result.count += 1;
    if (transactionDate > result.latestDate) result.latestDate = transactionDate;
  }
  return result;
}
