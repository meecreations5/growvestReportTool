function dateDistanceDays(a = "", b = "") {
  const av = Date.parse(String(a || ""));
  const bv = Date.parse(String(b || ""));
  if (Number.isNaN(av) || Number.isNaN(bv)) return Number.POSITIVE_INFINITY;
  return Math.abs(av - bv) / 86400000;
}

function samePosition(a = {}, b = {}) {
  const aId = String(a.positionId || a.relatedInvestmentId || "").trim();
  const bId = String(b.positionId || b.relatedInvestmentId || "").trim();
  if (aId && bId) return aId === bId;
  const aIsin = String(a.isin || "").trim().toUpperCase();
  const bIsin = String(b.isin || "").trim().toUpperCase();
  const aFolio = String(a.folioNo || "").trim().toUpperCase();
  const bFolio = String(b.folioNo || "").trim().toUpperCase();
  if (aIsin && bIsin) return aIsin === bIsin && (!aFolio || !bFolio || aFolio === bFolio);
  return false;
}

function similarAmount(a = {}, b = {}) {
  const av = Math.abs(Number(a.amount || 0));
  const bv = Math.abs(Number(b.amount || 0));
  if (!(av > 0) || !(bv > 0)) return false;
  return Math.abs(av - bv) <= Math.max(1, Math.max(av, bv) * 0.005);
}

function isConfirmedWithdrawal(item = {}) {
  const flow = String(item.cashFlowType || "").toLowerCase();
  const type = String(item.transactionType || item.type || "").toLowerCase();
  const status = String(item.financialImpactStatus || item.transactionStatus || "confirmed").toLowerCase();
  if (["planned", "pending", "in_progress", "awaiting_portfolio_confirmation"].includes(status)) return false;
  return flow === "withdrawal" || /redemption|redeem|withdraw/.test(type);
}

/**
 * Action-completion transactions are a provisional bridge so the portfolio and
 * monthly report can update immediately. If a provider later supplies the same
 * confirmed redemption, prefer the provider transaction and drop only the
 * matching provisional action transaction. Provider transactions are never
 * deduplicated against one another here.
 */
export function dedupeActionWithdrawalTransactions(transactions = []) {
  const rows = Array.isArray(transactions) ? transactions : [];
  const providerWithdrawals = rows.filter((item) => isConfirmedWithdrawal(item) && item.provisionalActionTransaction !== true);
  return rows.filter((item) => {
    if (item.provisionalActionTransaction !== true || !isConfirmedWithdrawal(item)) return true;
    return !providerWithdrawals.some((provider) => (
      samePosition(item, provider)
      && similarAmount(item, provider)
      && dateDistanceDays(item.transactionDate, provider.transactionDate) <= 7
    ));
  });
}
