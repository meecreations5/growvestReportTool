import {
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_RECONCILIATION_STATUS,
  PORTFOLIO_RECONCILIATION_THRESHOLDS,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import {
  GENERAL_WEALTH_BUCKET_NAME,
  normalisePortfolioGoalAllocations,
  primaryPortfolioBucket
} from "@/lib/portfolioGoalAllocation";

const DAY_MS = 24 * 60 * 60 * 1000;
const QUANTITY_EPSILON = 0.000001;

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

function dateMillis(value = "") {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return 0;
  const parsed = new Date(`${text}T00:00:00+05:30`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ageDays(referenceDate = "", valuationDate = "") {
  const reference = dateMillis(referenceDate);
  const valuation = dateMillis(valuationDate);
  if (!reference || !valuation) return null;
  return Math.max(0, Math.floor((reference - valuation) / DAY_MS));
}

function activePosition(position = {}) {
  return !["inactive", "exited"].includes(String(position.status || "").toLowerCase());
}

function positionId(position = {}) {
  return String(position.positionId || position.id || "");
}

function positionName(position = {}) {
  return position.instrumentName || position.schemeName || position.stockName || position.fundName || position.symbol || "Investment";
}

function positionQuantity(position = {}) {
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) return number(position.quantity);
  return number(position.totalUnits || position.quantity);
}

function positionRate(position = {}) {
  return number(position.currentNav || position.currentRate);
}

function normalizedToken(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function identityKey(position = {}) {
  const source = normalizedToken(position.source || position.provider || "manual");
  const product = normalizedToken(position.productType || "other");
  const instrument = normalizedToken(
    position.isin
      || position.symbol
      || [position.policyNumber, position.fundCode || position.fundName].filter(Boolean).join("|")
      || position.instrumentName
      || position.schemeName
      || position.stockName
  );
  const account = normalizedToken(position.folioNo || position.accountReference || position.policyNumber || position.exchange || "");
  return [source, product, instrument, account].join("|");
}

function goalPercentage(position = {}) {
  return normalisePortfolioGoalAllocations(position.goalAllocations)
    .filter((item) => item?.goalId)
    .reduce((sum, item) => sum + Math.max(0, Math.min(100, number(item?.percentage))), 0);
}

function bucketPercentage(position = {}) {
  return normalisePortfolioGoalAllocations(position.goalAllocations)
    .reduce((sum, item) => sum + Math.max(0, Math.min(100, number(item?.percentage))), 0);
}

function goalName(position = {}) {
  return primaryPortfolioBucket(position.goalAllocations)?.goalName || GENERAL_WEALTH_BUCKET_NAME;
}

function assetClass(position = {}) {
  return position.assetClass || "Other";
}

function sourceDate(position = {}) {
  return position.navDate || position.valuationDate || position.priceDate || "";
}

function sourceFreshness(positions = [], referenceDate = "") {
  const bySource = new Map();
  positions.forEach((position) => {
    const source = String(position.source || "manual");
    const current = bySource.get(source) || {
      source,
      sourceLabel: PORTFOLIO_SOURCE_LABELS[source] || position.provider || source,
      valuationDate: "",
      oldestValuationDate: "",
      missingDateCount: 0,
      positionCount: 0,
      currentValue: 0
    };
    current.positionCount += 1;
    current.currentValue += number(position.currentValue);
    const date = sourceDate(position);
    if (!date) current.missingDateCount += 1;
    if (date && (!current.valuationDate || String(date) > String(current.valuationDate))) current.valuationDate = date;
    if (date && (!current.oldestValuationDate || String(date) < String(current.oldestValuationDate))) current.oldestValuationDate = date;
    bySource.set(source, current);
  });

  return [...bySource.values()].map((item) => {
    const latestAgeDays = ageDays(referenceDate, item.valuationDate);
    const oldestAgeDays = ageDays(referenceDate, item.oldestValuationDate || item.valuationDate);
    let freshnessStatus = "fresh";
    if (item.missingDateCount > 0 || oldestAgeDays === null) freshnessStatus = "missing";
    else if (oldestAgeDays > PORTFOLIO_RECONCILIATION_THRESHOLDS.CRITICAL_STALE_DAYS) freshnessStatus = "critical";
    else if (oldestAgeDays > PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS) freshnessStatus = "stale";
    else if (oldestAgeDays > PORTFOLIO_RECONCILIATION_THRESHOLDS.FRESH_DAYS) freshnessStatus = "aging";
    return {
      ...item,
      currentValue: round(item.currentValue),
      ageDays: oldestAgeDays,
      latestAgeDays,
      oldestAgeDays,
      freshnessStatus
    };
  });
}

function transactionFlow(transaction = {}) {
  const flow = String(transaction.cashFlowType || "").toLowerCase();
  const type = String(transaction.transactionType || transaction.type || "").toLowerCase();
  const amount = Math.abs(number(transaction.amount));

  if (flow === "new_money") return { type: "new_money", amount };
  if (flow === "withdrawal") return { type: "withdrawal", amount };
  if (flow === "internal") return { type: "internal", amount };
  if (flow && !["review", "internal_or_withdrawal_review"].includes(flow)) return { type: flow, amount };

  if (/switch\s*in|switch\s*out/.test(type)) return { type: "internal", amount };
  if (/redemption|redeem|withdraw/.test(type)) return { type: "withdrawal", amount };
  if (/sip|purchase|lump\s*sum|investment|deposit|fresh\s*buy/.test(type)) return { type: "new_money", amount };
  if (/delivery\s*sale|\bsell\b|dividend|maturity|transfer/.test(type)) return { type: "review", amount };
  return amount > 0 ? { type: "review", amount } : { type: "none", amount: 0 };
}

function transactionMatchesPosition(transaction = {}, position = {}) {
  if (transaction.positionId && positionId(position) && String(transaction.positionId) === positionId(position)) return true;
  if (transaction.isin && position.isin && normalizedToken(transaction.isin) === normalizedToken(position.isin)) {
    if (!transaction.folioNo || !position.folioNo) return true;
    return normalizedToken(transaction.folioNo) === normalizedToken(position.folioNo);
  }
  if (transaction.folioNo && position.folioNo && normalizedToken(transaction.folioNo) === normalizedToken(position.folioNo)) {
    return normalizedToken(transaction.instrumentName || transaction.schemeName) === normalizedToken(positionName(position));
  }
  if (transaction.symbol && position.symbol && normalizedToken(transaction.symbol) === normalizedToken(position.symbol)) return true;
  return normalizedToken(transaction.instrumentName || transaction.schemeName || transaction.stockName) === normalizedToken(positionName(position));
}

function hasReductionTransaction(position, transactions = []) {
  return transactions.some((transaction) => {
    if (!transactionMatchesPosition(transaction, position)) return false;
    const type = String(transaction.transactionType || transaction.type || "").toLowerCase();
    return /redemption|withdraw|switch\s*out|sell|delivery\s*sale/.test(type)
      || String(transaction.cashFlowType || "").toLowerCase() === "withdrawal";
  });
}

function valuationMismatch(position = {}) {
  const quantity = positionQuantity(position);
  const rate = positionRate(position);
  const currentValue = number(position.currentValue);
  if (quantity <= 0 || rate <= 0 || currentValue <= 0) return null;

  const eligible = [
    PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND,
    PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY,
    PORTFOLIO_PRODUCT_TYPES.ULIP
  ].includes(position.productType) || Boolean(position.currentRate || position.currentNav);
  if (!eligible) return null;

  const expectedValue = quantity * rate;
  const difference = currentValue - expectedValue;
  const absoluteDifference = Math.abs(difference);
  const percentageDifference = expectedValue > 0 ? absoluteDifference / expectedValue * 100 : 0;
  if (absoluteDifference < PORTFOLIO_RECONCILIATION_THRESHOLDS.VALUE_TOLERANCE_RUPEES) return null;
  if (percentageDifference < PORTFOLIO_RECONCILIATION_THRESHOLDS.VALUE_TOLERANCE_PERCENT) return null;

  return {
    positionId: positionId(position),
    instrumentName: positionName(position),
    source: position.source || "",
    currentValue: round(currentValue),
    expectedValue: round(expectedValue),
    difference: round(difference),
    differencePercentage: round(percentageDifference)
  };
}

function concentrationSummary(positions = [], totalValue = 0) {
  const total = number(totalValue) || positions.reduce((sum, item) => sum + number(item.currentValue), 0);
  const byAsset = new Map();
  const byGoal = new Map();
  let largestHolding = null;
  let generalWealthValue = 0;

  positions.forEach((position) => {
    const value = number(position.currentValue);
    const asset = assetClass(position);
    byAsset.set(asset, number(byAsset.get(asset)) + value);
    const linkedGoal = goalName(position);
    if (linkedGoal && linkedGoal !== GENERAL_WEALTH_BUCKET_NAME) byGoal.set(linkedGoal, number(byGoal.get(linkedGoal)) + value);
    else generalWealthValue += value;
    if (!largestHolding || value > largestHolding.currentValue) {
      largestHolding = {
        positionId: positionId(position),
        instrumentName: positionName(position),
        currentValue: value,
        source: position.source || ""
      };
    }
  });

  const largestEntry = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0] || ["", 0];
  const [largestAssetClass, largestAssetValue] = largestEntry(byAsset);
  const [largestGoalName, largestGoalValue] = largestEntry(byGoal);
  const holdingValue = number(largestHolding?.currentValue);

  return {
    largestHolding: largestHolding ? {
      ...largestHolding,
      currentValue: round(holdingValue),
      percentage: total > 0 ? round(holdingValue / total * 100, 1) : 0
    } : null,
    largestAssetClass: largestAssetClass ? {
      name: largestAssetClass,
      currentValue: round(largestAssetValue),
      percentage: total > 0 ? round(largestAssetValue / total * 100, 1) : 0
    } : null,
    largestGoal: largestGoalName ? {
      name: largestGoalName,
      currentValue: round(largestGoalValue),
      percentage: total > 0 ? round(largestGoalValue / total * 100, 1) : 0
    } : null,
    generalWealthValue: round(generalWealthValue),
    generalWealthPercentage: total > 0 ? round(generalWealthValue / total * 100, 1) : 0,
    // Legacy keys remain during the UI/API transition, but General Wealth is a valid default bucket, not an unassigned error.
    unassignedValue: 0,
    unassignedPercentage: 0,
    assetClasses: Object.fromEntries([...byAsset.entries()].map(([key, value]) => [key, round(value)]))
  };
}

function priceMovement(current = {}, previous = {}) {
  const currentRate = positionRate(current);
  const previousRate = positionRate(previous);
  if (currentRate <= 0 || previousRate <= 0 || currentRate === previousRate) return null;
  return {
    positionId: positionId(current),
    instrumentName: positionName(current),
    source: current.source || "",
    productType: current.productType || PORTFOLIO_PRODUCT_TYPES.OTHER,
    previousRate: round(previousRate, 6),
    currentRate: round(currentRate, 6),
    change: round(currentRate - previousRate, 6),
    changePercentage: round((currentRate - previousRate) / previousRate * 100, 2),
    previousDate: sourceDate(previous),
    currentDate: sourceDate(current)
  };
}

function issue(code, severity, title, description, extra = {}) {
  return { code, severity, title, description, ...extra };
}

export function buildPortfolioIntelligence({
  currentPositions = [],
  previousPositions = [],
  transactions = [],
  currentSummary = {},
  previousSummary = {},
  snapshotDate = "",
  previousSnapshotDate = ""
} = {}) {
  const current = currentPositions.filter(activePosition);
  const previous = previousPositions.filter(activePosition);
  const currentById = new Map(current.map((item) => [positionId(item), item]).filter(([id]) => id));
  const previousById = new Map(previous.map((item) => [positionId(item), item]).filter(([id]) => id));

  const newHoldings = current
    .filter((item) => !previousById.has(positionId(item)))
    .map((item) => ({
      positionId: positionId(item),
      instrumentName: positionName(item),
      source: item.source || "",
      productType: item.productType || PORTFOLIO_PRODUCT_TYPES.OTHER,
      currentValue: round(item.currentValue),
      goalName: goalName(item),
      goalAssigned: goalPercentage(item) > 0,
      bucketAssigned: bucketPercentage(item) >= 99.9999
    }));

  const exitedHoldings = previous
    .filter((item) => !currentById.has(positionId(item)))
    .map((item) => ({
      positionId: positionId(item),
      instrumentName: positionName(item),
      source: item.source || "",
      productType: item.productType || PORTFOLIO_PRODUCT_TYPES.OTHER,
      previousValue: round(item.currentValue),
      previousQuantity: round(positionQuantity(item), 6),
      previousGoalName: goalName(item)
    }));

  const partialExits = [];
  const unexplainedQuantityChanges = [];
  const priceMovements = [];
  current.forEach((item) => {
    const previousItem = previousById.get(positionId(item));
    if (!previousItem) return;
    const currentQty = positionQuantity(item);
    const previousQty = positionQuantity(previousItem);
    if (previousQty > currentQty + QUANTITY_EPSILON && currentQty > QUANTITY_EPSILON) {
      const row = {
        positionId: positionId(item),
        instrumentName: positionName(item),
        source: item.source || "",
        previousQuantity: round(previousQty, 6),
        currentQuantity: round(currentQty, 6),
        quantityReduced: round(previousQty - currentQty, 6),
        transactionFound: hasReductionTransaction(item, transactions)
      };
      partialExits.push(row);
      if (!row.transactionFound) unexplainedQuantityChanges.push(row);
    }
    const movement = priceMovement(item, previousItem);
    if (movement) priceMovements.push(movement);
  });
  priceMovements.sort((a, b) => Math.abs(b.changePercentage) - Math.abs(a.changePercentage));

  const duplicateGroups = new Map();
  current.forEach((position) => {
    const key = identityKey(position);
    if (!key || key.endsWith("||")) return;
    const rows = duplicateGroups.get(key) || [];
    rows.push(position);
    duplicateGroups.set(key, rows);
  });
  const duplicates = [...duplicateGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      identityKey: key,
      count: rows.length,
      positions: rows.map((item) => ({ positionId: positionId(item), instrumentName: positionName(item), currentValue: round(item.currentValue) }))
    }));

  const valuationMismatches = current.map(valuationMismatch).filter(Boolean);
  const freshness = sourceFreshness(current, snapshotDate);
  const missingSources = freshness.filter((item) => item.freshnessStatus === "missing");
  const staleSources = freshness.filter((item) => ["stale", "critical"].includes(item.freshnessStatus));
  const agingSources = freshness.filter((item) => item.freshnessStatus === "aging");

  const generalWealthHoldings = current
    .filter((item) => goalPercentage(item) <= 0)
    .map((item) => ({
      positionId: positionId(item),
      instrumentName: positionName(item),
      currentValue: round(item.currentValue),
      source: item.source || "",
      bucketName: GENERAL_WEALTH_BUCKET_NAME
    }));
  const newGeneralWealthHoldings = newHoldings.filter((item) => !item.goalAssigned);

  const flows = transactions.reduce((totals, transaction) => {
    const result = transactionFlow(transaction);
    if (result.type === "new_money") totals.newMoney += result.amount;
    else if (result.type === "withdrawal") totals.withdrawals += result.amount;
    else if (result.type === "internal") totals.internalTransfers += result.amount;
    else if (result.type === "review") {
      totals.reviewAmount += result.amount;
      totals.reviewCount += 1;
    }
    totals.realisedPnl += number(transaction.realisedPnl ?? transaction.realizedPnl);
    return totals;
  }, { newMoney: 0, withdrawals: 0, internalTransfers: 0, reviewAmount: 0, reviewCount: 0, realisedPnl: 0 });

  const openingValue = number(previousSummary.currentValue);
  const closingValue = number(currentSummary.currentValue);
  const portfolioChange = closingValue - openingValue;
  const marketMovement = previousSnapshotDate
    ? portfolioChange - flows.newMoney + flows.withdrawals
    : 0;

  const concentration = concentrationSummary(current, closingValue);
  const issues = [];

  if (duplicates.length) {
    issues.push(issue(
      "duplicate_holdings",
      "block",
      "Possible duplicate holdings",
      `${duplicates.length} holding identit${duplicates.length === 1 ? "y" : "ies"} appears more than once in the active portfolio. Review before relying on totals.`,
      { count: duplicates.length }
    ));
  }
  if (valuationMismatches.length) {
    issues.push(issue(
      "valuation_mismatch",
      "block",
      "Valuation mismatch",
      `${valuationMismatches.length} holding${valuationMismatches.length === 1 ? " does" : "s do"} not reconcile to units/quantity × current NAV/rate within tolerance.`,
      { count: valuationMismatches.length }
    ));
  }
  if (missingSources.length) {
    issues.push(issue(
      "missing_source_date",
      "warn",
      "Source valuation date missing",
      `${missingSources.length} portfolio source${missingSources.length === 1 ? " has" : "s have"} no usable NAV/valuation date.`,
      { count: missingSources.length }
    ));
  }
  if (staleSources.length) {
    const oldest = Math.max(...staleSources.map((item) => number(item.ageDays)));
    issues.push(issue(
      "stale_source",
      oldest > PORTFOLIO_RECONCILIATION_THRESHOLDS.CRITICAL_STALE_DAYS ? "block" : "warn",
      "Portfolio source is stale",
      `${staleSources.length} source${staleSources.length === 1 ? " is" : "s are"} older than ${PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS} days. Oldest source is ${oldest} days old.`,
      { count: staleSources.length, oldestAgeDays: oldest }
    ));
  } else if (agingSources.length) {
    issues.push(issue(
      "aging_source",
      "info",
      "Source freshness attention",
      `${agingSources.length} source${agingSources.length === 1 ? " is" : "s are"} more than ${PORTFOLIO_RECONCILIATION_THRESHOLDS.FRESH_DAYS} days old.`,
      { count: agingSources.length }
    ));
  }
  if (unexplainedQuantityChanges.length) {
    issues.push(issue(
      "unexplained_quantity_change",
      "warn",
      "Quantity reduction needs reconciliation",
      `${unexplainedQuantityChanges.length} holding${unexplainedQuantityChanges.length === 1 ? " has" : "s have"} fewer units/quantity than the previous snapshot without a matching redemption/sale transaction in the period.`,
      { count: unexplainedQuantityChanges.length }
    ));
  }
  if (flows.reviewCount) {
    issues.push(issue(
      "cash_flow_review",
      "warn",
      "Cash flow classification needs review",
      `${flows.reviewCount} transaction${flows.reviewCount === 1 ? " has" : "s have"} cash flow that cannot safely be classified as fresh investment, withdrawal or internal transfer.`,
      { count: flows.reviewCount, amount: round(flows.reviewAmount) }
    ));
  }
  if (newGeneralWealthHoldings.length) {
    issues.push(issue(
      "new_general_wealth_holdings",
      "info",
      "New holdings assigned to General Wealth",
      `${newGeneralWealthHoldings.length} new holding${newGeneralWealthHoldings.length === 1 ? " is" : "s are"} mapped to the default General Wealth bucket until staff links them to a specific Bucket List goal.`,
      { count: newGeneralWealthHoldings.length }
    ));
  }

  let status = PORTFOLIO_RECONCILIATION_STATUS.VERIFIED;
  if (duplicates.length || valuationMismatches.length) status = PORTFOLIO_RECONCILIATION_STATUS.MISMATCH;
  else if (missingSources.length) status = PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE;
  else if (staleSources.length) status = PORTFOLIO_RECONCILIATION_STATUS.STALE;
  else if (unexplainedQuantityChanges.length || flows.reviewCount) status = PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW;

  return {
    version: 1,
    status,
    snapshotDate,
    comparisonSnapshotDate: previousSnapshotDate || "",
    generatedAt: new Date().toISOString(),
    counts: {
      activeHoldings: current.length,
      newHoldings: previousSnapshotDate ? newHoldings.length : 0,
      exitedHoldings: previousSnapshotDate ? exitedHoldings.length : 0,
      partialExits: previousSnapshotDate ? partialExits.length : 0,
      generalWealthHoldings: generalWealthHoldings.length,
      newGeneralWealthHoldings: previousSnapshotDate ? newGeneralWealthHoldings.length : 0,
      unassignedHoldings: 0,
      newUnassignedHoldings: 0,
      duplicateGroups: duplicates.length,
      valuationMismatches: valuationMismatches.length,
      unexplainedQuantityChanges: unexplainedQuantityChanges.length,
      sourceCount: freshness.length,
      staleSources: staleSources.length,
      missingSourceDates: missingSources.length
    },
    movement: {
      available: Boolean(previousSnapshotDate),
      fromDate: previousSnapshotDate || "",
      toDate: snapshotDate || "",
      openingValue: round(openingValue),
      closingValue: round(closingValue),
      portfolioChange: round(portfolioChange),
      newMoney: round(flows.newMoney),
      withdrawals: round(flows.withdrawals),
      internalTransfers: round(flows.internalTransfers),
      realisedPnl: round(flows.realisedPnl),
      reviewCashFlowAmount: round(flows.reviewAmount),
      reviewCashFlowCount: flows.reviewCount,
      marketMovement: round(marketMovement)
    },
    concentration,
    sourceFreshness: freshness,
    newHoldings: previousSnapshotDate ? newHoldings : [],
    exitedHoldings: previousSnapshotDate ? exitedHoldings : [],
    partialExits: previousSnapshotDate ? partialExits : [],
    unexplainedQuantityChanges: previousSnapshotDate ? unexplainedQuantityChanges : [],
    generalWealthHoldings,
    unassignedHoldings: [],
    valuationMismatches,
    duplicates,
    priceMovements: previousSnapshotDate ? priceMovements.slice(0, 20) : [],
    issues
  };
}
