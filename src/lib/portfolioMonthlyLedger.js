/**
 * Unified investor-level monthly cash-flow classification.
 * For a managed Manual PMS account, portfolio purchases/redemptions are trades
 * inside the account, NOT fresh investor money or an external withdrawal.
 * 05_Cash_Ledger (and explicitly labelled capital transactions where the cash
 * ledger is absent) is the evidence of external funding.
 * Pure functions: used identically by report generation, snapshot analytics and
 * report publication guards. No Firestore access or side effects.
 */
import { isConfirmedInvestmentActivity } from "./portfolioPeriodCoverage.js";

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const positive = (value) => Math.abs(Number(value) || 0);
const text = (value) => String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const dateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10)) ? String(value).slice(0, 10) : "";
const applicable = (date, startDate = "", cutoffDate = "") => {
  const key = dateKey(date);
  return Boolean(key && (!startDate || key >= dateKey(startDate)) && (!cutoffDate || key <= dateKey(cutoffDate)));
};

export function manualPmsCashEntryFlow(entryType = "") {
  const type = text(entryType);
  if (!type) return "review";
  if (/\btransfer\b|\binternal\b|purchase debit|sale proceeds|buy settlement|sell settlement|dividend|interest|brokerage|charges|fees?|expense|refund|maturity proceeds|tax|tds/.test(type)) return "internal";
  // An opening cash balance is NOT proof of fresh investor funding. It may
  // already be included in the opening NAV. Block until explicitly classified.
  if (/opening cash|opening balance/.test(type)) return "review";
  if (/withdrawal|withdrawn|capital redemption|investor payout|capital returned|external outflow/.test(type)) return "withdrawal";
  if (/contribution|investor deposit|capital add|additional capital|capital infus|fresh capital|new capital|top up|topup|external inflow|additional investment/.test(type)) return "new_money";
  return "review";
}

export function manualPmsTradeFlow(transactionType = "") {
  const type = text(transactionType);
  if (!type) return "review";
  // Only an EXPLICIT capital instruction can cross the managed account boundary.
  // An underlying PMS Buy/Sell/Redemption is a reallocation until separately
  // accompanied by a confirmed investor contribution/withdrawal.
  if (/capital withdrawal|withdrawal of capital|investor withdrawal|external withdrawal|capital redemption|investor payout/.test(type)) return "withdrawal";
  if (/capital addition|capital added|additional capital|capital contribution|fresh capital|capital infusion|pms top up|external contribution|investor deposit/.test(type)) return "new_money";
  if (/sip|purchase|buy|sell|sale|redemption|switch|transfer|reinvest|dividend|interest|fee|charge|settlement|bonus|split|maturity/.test(type)) return "internal";
  return "review";
}

export function manualCashLedgerMovement(item = {}, investorId = "") {
  const amount = positive(item.amount ?? item.signedAmount);
  const transactionDate = dateKey(item.entryDate || item.transactionDate);
  if (!transactionDate || !(amount > 0)) return null;
  const cashFlowType = manualPmsCashEntryFlow(item.entryType || item.cashEntryType);
  return {
    id: `manual_cash_${item.id || item.entryKey || `${item.accountCode || ""}_${transactionDate}_${amount}`}`,
    investorId: item.investorId || investorId,
    source: "manual",
    manualPortfolioCashFlow: true,
    manualPortfolioAccountCode: item.accountCode || item.manualPortfolioAccountCode || "",
    transactionDate,
    transactionType: `Manual cash - ${item.entryType || "Unknown"}`,
    cashFlowType,
    amount: round(amount),
    transactionStatus: "confirmed",
    transactionReference: item.reference || "",
    notes: item.notes || ""
  };
}

export function normalisePmsManagedTransaction(item = {}) {
  const managed = item.manualPortfolioManaged === true
    || (item.manualInvestmentTemplate === true && String(item.productType || "").toLowerCase() === "pms");
  if (String(item.source || "").toLowerCase() !== "manual" || !managed) return item;
  const cashFlowType = manualPmsTradeFlow(item.transactionType);
  const amount = positive(item.amount ?? item.netAmount ?? item.grossAmount ?? item.transactionAmount);
  return { ...item, cashFlowType, amount: round(amount), manualPortfolioTrade: true };
}

function sameExternalMovement(trade, cash) {
  if (trade.cashFlowType !== cash.cashFlowType || !["new_money", "withdrawal"].includes(trade.cashFlowType)) return false;
  if (trade.transactionDate !== cash.transactionDate || Math.abs(trade.amount - cash.amount) > 0.01) return false;
  const accountA = String(trade.manualPortfolioAccountCode || trade.accountCode || "").trim().toUpperCase();
  const accountB = String(cash.manualPortfolioAccountCode || "").trim().toUpperCase();
  if (accountA && accountB && accountA !== accountB) return false;
  const refA = text(trade.transactionReference || trade.reference);
  const refB = text(cash.transactionReference);
  // With incomplete account mapping, a matching bank reference is mandatory.
  // Otherwise same-day equal amounts could be two unrelated deposits.
  if (!accountA || !accountB) return Boolean(refA && refB && refA === refB);
  // When source references disagree, do not silently merge two real payments.
  return !refA || !refB || refA === refB;
}

function normaliseConfirmedAction(item = {}, investorId = "") {
  if (item.financialImpactStatus !== "confirmed" || item.financialConfirmationMode !== "manual_cash_movement") return null;
  const cashFlowType = item.financialImpactType === "external_inflow" ? "new_money"
    : item.financialImpactType === "external_outflow" ? "withdrawal" : "";
  const transactionDate = dateKey(item.actualFinancialDate);
  const amount = positive(item.actualFinancialAmount);
  if (!cashFlowType || !transactionDate || !amount) return null;
  return {
    id: `action_cash_${item.id}`,
    investorId,
    source: "investor_action_confirmation",
    sourceActionId: item.id || "",
    transactionDate,
    transactionType: item.requestType || item.recommendationType || (cashFlowType === "withdrawal" ? "Confirmed Withdrawal" : "Confirmed Investment"),
    instrumentName: item.relatedInvestmentName || item.requestedAccountReference || "Portfolio",
    cashFlowType,
    financialImpactStatus: "confirmed",
    manualPortfolioAccountCode: item.manualPortfolioAccountCode || item.accountCode || "",
    transactionReference: item.actualFinancialReference || "",
    amount: round(amount),
    notes: [item.requestedAccountReference, item.actualFinancialReference, item.portfolioConfirmationNote].filter(Boolean).join(" / ")
  };
}

/**
 * One normalized reporting ledger for ALL month-end consumers. Source records
 * remain untouched, and imported Manual trades are preserved as internal
 * activity even when their names contain 'purchase', 'redemption' or 'SIP'.
 * Legacy Managed PMS rows are normalized at read-time as well.
 */
export function buildMonthlyReportingLedger({ ledger = {}, investorId = "", startDate = "", cutoffDate = "" } = {}) {
  const cash = (Array.isArray(ledger.manualCash) ? ledger.manualCash : [])
    .map((item) => manualCashLedgerMovement(item, investorId))
    .filter((item) => item && applicable(item.transactionDate, startDate, cutoffDate));

  const trades = (Array.isArray(ledger.transactions) ? ledger.transactions : [])
    .filter((item) => applicable(item.transactionDate, startDate, cutoffDate))
    .map(normalisePmsManagedTransaction)
    .map((item) => (cash.some((entry) => sameExternalMovement(item, entry))
      ? { ...item, cashFlowType: "internal", pmsCapitalMovementCoveredByCashLedger: true }
      : item));

  const actions = (Array.isArray(ledger.investorActions) ? ledger.investorActions : [])
    .map((item) => normaliseConfirmedAction(item, investorId))
    .filter((item) => item && applicable(item.transactionDate, startDate, cutoffDate))
    // Deduplicate only with evidence of an exact matching reference. Two
    // unrelated, same-amount deposits on one day must not disappear.
    .filter((action) => ![...cash, ...trades].some((entry) => entry.cashFlowType === action.cashFlowType
      && entry.transactionDate === action.transactionDate
      && entry.amount === action.amount
      && action.transactionReference
      && entry.transactionReference
      && text(action.transactionReference) === text(entry.transactionReference)));

  return [...trades, ...cash, ...actions]
    .filter((item) => isConfirmedInvestmentActivity(item) || item.manualPortfolioCashFlow || item.source === "investor_action_confirmation")
    .sort((a, b) => String(a.transactionDate || "").localeCompare(String(b.transactionDate || "")));
}
