// Dated valuation plan contains no Firebase or browser state; keep the source
// NAV date independent of the upload time and Monthly Wealth Review cutoff.
function dateKey(value = "") {
  const key = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const dt = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== key ? "" : key;
}

function numeric(value, name) {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${name} in Fundbazaar valuation.`);
  return result;
}

const roundMoney = (value) => Number(Number(value).toFixed(2));

export function planFundbazaarDatedValuation(file = {}) {
  if (file.source !== "fundbazaar" || file.reportType !== "fundbazaar_client_valuation") {
    throw new Error("Only Fundbazaar Client Wise Valuation files can be archived as dated NAV valuations.");
  }
  const holdings = Array.isArray(file.holdings) ? file.holdings : [];
  if (!holdings.length) throw new Error("The imported file has no holdings to archive.");
  if (holdings.length > 1000) throw new Error("This source contains too many holdings for a single dated valuation archive.");
  const transactions = Array.isArray(file.transactions) ? file.transactions : [];
  if (transactions.length > 10000) throw new Error("This source contains too many transactions for one dated valuation archive.");

  const datedHoldings = holdings.map((holding, index) => {
    const navDate = dateKey(holding.navDate || holding.valuationDate);
    if (!navDate) throw new Error(`Holding ${index + 1} has no valid NAV date. The report export date must not be substituted.`);
    return {
      instrumentName: String(holding.instrumentName || holding.schemeName || "").trim(),
      schemeName: String(holding.schemeName || holding.instrumentName || "").trim(),
      isin: String(holding.isin || "").trim(),
      folioNo: String(holding.folioNo || "").trim(),
      assetClass: String(holding.assetClass || "Equity").trim(),
      navDate,
      totalInvested: roundMoney(numeric(holding.totalInvested, "invested value")),
      totalUnits: numeric(holding.totalUnits, "units"),
      currentNav: numeric(holding.currentNav, "NAV"),
      currentValue: roundMoney(numeric(holding.currentValue, "portfolio value")),
      monthlySip: roundMoney(numeric(holding.monthlySip, "SIP amount"))
    };
  });
  const dateKeys = [...new Set(datedHoldings.map((holding) => holding.navDate))].sort();
  const valuationDate = dateKeys.at(-1);
  const uniformNavDate = dateKeys.length === 1;
  const datedTransactions = transactions.map((transaction, index) => {
    const transactionDate = dateKey(transaction.transactionDate);
    if (!transactionDate) throw new Error(`Transaction ${index + 1} has no valid transaction date.`);
    return {
      transactionDate,
      transactionType: String(transaction.transactionType || transaction.sourceTransactionType || ""),
      schemeName: String(transaction.schemeName || ""),
      isin: String(transaction.isin || ""),
      folioNo: String(transaction.folioNo || ""),
      amount: roundMoney(numeric(transaction.purchaseAmount ?? transaction.investedAmount ?? transaction.amount, "transaction amount")),
      purchaseNav: numeric(transaction.purchaseNav ?? transaction.navRate, "purchase NAV"),
      units: numeric(transaction.units, "transaction units")
    };
  });
  const postValuationTransactionCount = datedTransactions.filter((transaction) => transaction.transactionDate > valuationDate).length;
  const summary = {
    currentValue: roundMoney(datedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0)),
    totalInvested: roundMoney(datedHoldings.reduce((sum, holding) => sum + holding.totalInvested, 0)),
    monthlySip: roundMoney(datedHoldings.reduce((sum, holding) => sum + holding.monthlySip, 0)),
    holdingCount: datedHoldings.length,
    transactionCount: datedTransactions.length
  };
  const claimedValue = Number(file.summary?.currentValue);
  if (Number.isFinite(claimedValue) && Math.abs(summary.currentValue - claimedValue) > 1) {
    throw new Error(`Fundbazaar holdings total (₹${summary.currentValue}) does not match the source summary (₹${claimedValue}).`);
  }
  // A mixed-NAV file is archived for audit but never treated as a verified
  // valuation of a single date. Approval/reporting must be separate.
  return {
    valuationDate,
    earliestNavDate: dateKeys[0],
    latestNavDate: valuationDate,
    uniformNavDate,
    postValuationTransactionCount,
    historyReady: uniformNavDate && !postValuationTransactionCount,
    summary,
    holdings: datedHoldings,
    transactions: datedTransactions
  };
}
