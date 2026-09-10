function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function positionCost(position = {}) {
  return number(position.totalInvested ?? position.investedAmount ?? 0);
}

function positionCurrent(position = {}) {
  return number(position.currentValue ?? 0);
}

export function positionPerformanceExcluded(position = {}) {
  const assetClass = normalise(position.assetClass);
  const productType = normalise(position.productType);
  return position.manualPortfolioCashPosition === true
    || position.performanceExcluded === true
    || assetClass === "cash"
    || productType === "cash";
}

function explicitCostBasisUnavailable(position = {}) {
  return position.costBasisAvailable === false
    || position.performanceAvailable === false
    || normalise(position.costBasisStatus) === "pending";
}

export function positionPerformanceAvailable(position = {}) {
  if (positionPerformanceExcluded(position)) return false;
  const productType = normalise(position.productType);
  if (productType === "ulip") {
    return position.gainLossAvailable !== false && positionCost(position) > 0;
  }
  if (explicitCostBasisUnavailable(position)) return false;
  const invested = positionCost(position);
  if (invested > 0) return true;
  // An active holding with market value but no purchase cost must never be
  // treated as 100% profit. Keep its performance pending until cost arrives.
  if (positionCurrent(position) > 0) return false;
  return position.costBasisAvailable === true || position.performanceAvailable === true;
}

function uniqueUlipPremiumFromPositions(positions = []) {
  const premiums = new Map();
  positions
    .filter((item) => normalise(item.productType) === "ulip")
    .forEach((item, index) => {
      const premium = number(item.policyTotalPremiumPaid || 0);
      if (!(premium > 0)) return;
      const key = String(item.policyNumber || item.accountReference || `ulip-${index}`).trim().toUpperCase();
      if (!premiums.has(key)) premiums.set(key, premium);
    });
  return [...premiums.values()].reduce((sum, value) => sum + number(value), 0);
}

function ulipPremiumFromPolicies(policies = []) {
  return policies.reduce((sum, policy) => sum + number(policy.totalPremiumPaid || 0), 0);
}

const BREAKDOWN_ORDER = [
  "mutual_fund",
  "stock_delivery",
  "ulip",
  "pms",
  "bond",
  "fixed_deposit",
  "gold",
  "etf",
  "real_estate",
  "cash",
  "other"
];

const BREAKDOWN_LABELS = {
  mutual_fund: "Mutual Funds",
  stock_delivery: "Equity - Delivery",
  ulip: "ULIP",
  pms: "PMS",
  bond: "Bonds",
  fixed_deposit: "Fixed Deposits",
  gold: "Gold",
  etf: "ETFs",
  real_estate: "Real Estate",
  cash: "Cash",
  other: "Other Investments"
};

function breakdownKey(position = {}) {
  const productType = normalise(position.productType);
  const assetClass = normalise(position.assetClass);
  if (productType === "mutual_fund") return "mutual_fund";
  if (productType === "stock_delivery") return "stock_delivery";
  if (productType === "ulip") return "ulip";
  if (productType === "pms") return "pms";
  if (productType === "bond") return "bond";
  if (productType === "fixed_deposit") return "fixed_deposit";
  if (productType === "gold") return "gold";
  if (productType === "etf") return "etf";
  if (productType === "real_estate") return "real_estate";
  if (position.manualPortfolioCashPosition === true || productType === "cash" || assetClass === "cash") return "cash";
  return "other";
}

function emptyBreakdownRow(key) {
  return {
    key,
    label: BREAKDOWN_LABELS[key] || "Other Investments",
    holdingCount: 0,
    invested: 0,
    current: 0,
    gain: 0,
    gainPercent: 0,
    monthlySip: 0,
    pendingCostBasisCount: 0,
    performanceHoldingCount: 0,
    performanceExcluded: key === "cash"
  };
}

/**
 * Holding-level totals by investment type.
 *
 * These rows are designed to reconcile to the portfolio summary. Invested and
 * gain/loss include only holdings whose genuine cost basis is available. A
 * holding with a current market value but missing purchase cost remains in
 * current value while its return stays pending. ULIP premium is counted once
 * per policy even when a policy has multiple underlying fund positions.
 */
export function summarisePortfolioByInvestmentType(positions = [], ulipPolicies = []) {
  const rows = new Map();
  const active = Array.isArray(positions) ? positions : [];

  active.forEach((position) => {
    const key = breakdownKey(position);
    if (!rows.has(key)) rows.set(key, emptyBreakdownRow(key));
    const row = rows.get(key);
    const current = positionCurrent(position);
    const invested = positionCost(position);

    row.holdingCount += 1;
    row.current += current;
    row.monthlySip += number(position.monthlySip || position.monthlyContribution || 0);

    if (key === "ulip") return;
    if (positionPerformanceExcluded(position)) return;

    if (positionPerformanceAvailable(position)) {
      row.invested += invested;
      row.gain += current - invested;
      row.performanceHoldingCount += 1;
    } else if (current > 0 || invested > 0) {
      row.pendingCostBasisCount += 1;
    }
  });

  const ulipRow = rows.get("ulip");
  if (ulipRow) {
    const ulipPositions = active.filter((item) => breakdownKey(item) === "ulip");
    const premium = ulipPremiumFromPolicies(ulipPolicies) || uniqueUlipPremiumFromPositions(ulipPositions);
    if (premium > 0) {
      ulipRow.invested = premium;
      ulipRow.gain = ulipRow.current - premium;
      ulipRow.performanceHoldingCount = ulipRow.holdingCount;
    } else if (ulipRow.current > 0) {
      ulipRow.pendingCostBasisCount = ulipRow.holdingCount;
    }
  }

  return BREAKDOWN_ORDER
    .filter((key) => rows.has(key))
    .map((key) => {
      const row = rows.get(key);
      const gainPercent = row.invested > 0 ? row.gain / row.invested * 100 : 0;
      return {
        ...row,
        invested: Number(row.invested.toFixed(2)),
        current: Number(row.current.toFixed(2)),
        gain: Number(row.gain.toFixed(2)),
        gainPercent: Number(gainPercent.toFixed(2)),
        monthlySip: Number(row.monthlySip.toFixed(2)),
        gainPartial: row.pendingCostBasisCount > 0
      };
    });
}

/**
 * Portfolio-level performance source of truth.
 *
 * Current value always includes every active holding. Gain/loss only includes
 * holdings for which a genuine cost basis exists. This prevents a stock or
 * other holding with missing purchase cost from being counted as 100% profit.
 * Mutual-fund SIP losses are naturally included because gain = current - cost.
 */
export function summarisePortfolioPerformance(positions = [], ulipPolicies = []) {
  const active = Array.isArray(positions) ? positions : [];
  let currentValue = 0;
  let totalInvested = 0;
  let gainLoss = 0;
  let monthlySip = 0;
  let pendingCostBasisCount = 0;
  let pendingCurrentValue = 0;
  let performanceHoldingCount = 0;

  const ulipPositions = [];

  active.forEach((position) => {
    const current = positionCurrent(position);
    const productType = normalise(position.productType);
    currentValue += current;
    monthlySip += number(position.monthlySip || position.monthlyContribution || 0);

    if (productType === "ulip") {
      ulipPositions.push(position);
      return;
    }

    if (positionPerformanceExcluded(position)) return;

    const invested = positionCost(position);
    if (positionPerformanceAvailable(position)) {
      totalInvested += invested;
      gainLoss += current - invested;
      performanceHoldingCount += 1;
    } else if (current > 0 || invested > 0) {
      pendingCostBasisCount += 1;
      pendingCurrentValue += current;
    }
  });

  if (ulipPositions.length) {
    const ulipCurrent = ulipPositions.reduce((sum, item) => sum + positionCurrent(item), 0);
    const policyPremium = ulipPremiumFromPolicies(ulipPolicies) || uniqueUlipPremiumFromPositions(ulipPositions);
    if (policyPremium > 0) {
      totalInvested += policyPremium;
      gainLoss += ulipCurrent - policyPremium;
      performanceHoldingCount += ulipPositions.length;
    } else if (ulipCurrent > 0) {
      pendingCostBasisCount += ulipPositions.length;
      pendingCurrentValue += ulipCurrent;
    }
  }

  const gainLossPartial = pendingCostBasisCount > 0;
  const gainLossPercentage = totalInvested > 0 ? gainLoss / totalInvested * 100 : 0;

  return {
    currentValue: Number(currentValue.toFixed(2)),
    totalInvested: Number(totalInvested.toFixed(2)),
    gainLoss: Number(gainLoss.toFixed(2)),
    gainLossPercentage: Number(gainLossPercentage.toFixed(2)),
    monthlySip: Number(monthlySip.toFixed(2)),
    gainLossPartial,
    pendingCostBasisCount,
    pendingCurrentValue: Number(pendingCurrentValue.toFixed(2)),
    performanceHoldingCount,
    positionCount: active.length
  };
}
