/**
 * Presentation-only values for a Monthly Wealth Review.
 * Never substitute a previous report's closing value for the month-specific
 * opening value supplied by Portfolio Master. The two may use different dates
 * or snapshot revisions.
 *
 * Value change and investment gain/loss are separate concepts:
 *   closing - opening = net external flow + investment gain/loss.
 */
export function monthlyReviewBalanceSummary(summary = {}) {
  const hasNumber = (key) => Object.prototype.hasOwnProperty.call(summary, key)
    && summary[key] !== null
    && summary[key] !== ""
    && Number.isFinite(Number(summary[key]));
  const required = ["totalCorpus", "openingValue", "newMoneyAdded", "totalWithdrawals", "investmentGain"];
  const factsAvailable = required.every(hasNumber);
  const openingAvailable = hasNumber("openingValue");
  const closingAvailable = hasNumber("totalCorpus");
  const openingValue = openingAvailable ? Number(summary.openingValue) : null;
  const closingValue = closingAvailable ? Number(summary.totalCorpus) : null;
  const moneyAdded = hasNumber("newMoneyAdded") ? Number(summary.newMoneyAdded) : 0;
  const moneyWithdrawn = hasNumber("totalWithdrawals") ? Number(summary.totalWithdrawals) : 0;
  const investmentGain = hasNumber("investmentGain") ? Number(summary.investmentGain) : null;
  const balanceChange = openingAvailable && closingAvailable ? closingValue - openingValue : null;
  const balanceChangePercent = balanceChange !== null && openingValue > 0
    ? balanceChange / openingValue * 100
    : null;
  const netExternalFlow = moneyAdded - moneyWithdrawn;
  const expectedClosing = factsAvailable
    ? openingValue + netExternalFlow + investmentGain
    : null;
  const reconciliationDifference = expectedClosing === null ? null : closingValue - expectedClosing;

  return {
    factsAvailable,
    openingAvailable,
    closingAvailable,
    openingValue,
    closingValue,
    balanceChange,
    balanceChangePercent,
    moneyAdded,
    moneyWithdrawn,
    netExternalFlow,
    investmentGain,
    expectedClosing,
    reconciliationDifference,
    reconciled: factsAvailable ? Math.abs(reconciliationDifference) <= 0.10 : null,
    // Advisory only. A large loss relative to opening capital is possible
    // after cash inflows, so do not rewrite figures or block publication here.
    cashFlowReviewSuggested: Boolean(factsAvailable
      && openingValue > 0
      && moneyAdded > 0
      && investmentGain < -openingValue)
  };
}
