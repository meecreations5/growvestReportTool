import assert from "node:assert/strict";
import { monthlyReviewBalanceSummary } from "../../src/lib/reportFinancialPresentation.js";

let checks = 0;
function test(description, fn) { fn(); checks++; console.log(`PASS ${description}`); }

const screenshot = {
  totalCorpus: 47954.24,
  openingValue: 48517.07,
  newMoneyAdded: 50001,
  totalWithdrawals: 0,
  investmentGain: -50563.83
};
const result = monthlyReviewBalanceSummary(screenshot);

test("balance movement excludes the contribution-adjusted gain", () => {
  assert.equal(Number(result.balanceChange.toFixed(2)), -562.83);
  assert.notEqual(Number(result.balanceChange.toFixed(2)), screenshot.investmentGain);
});
test("balance percent uses the matching opening snapshot basis", () => {
  assert.equal(Number(result.balanceChangePercent.toFixed(2)), -1.16);
});
test("closing reconciles with all confirmed flows and gain", () => {
  assert.equal(Number(result.expectedClosing.toFixed(2)), 47954.24);
  assert.equal(result.reconciled, true);
});
test("large negative investment result triggers nonblocking staff review", () => {
  assert.equal(result.cashFlowReviewSuggested, true);
});
test("missing opening basis does not silently use an unrelated previous report", () => {
  const incomplete = monthlyReviewBalanceSummary({ totalCorpus: 47954.24 });
  assert.equal(incomplete.openingAvailable, false);
  assert.equal(incomplete.balanceChange, null);
  assert.equal(incomplete.balanceChangePercent, null);
  assert.equal(incomplete.reconciled, null);
});
test("zero opening basis reports no percent change", () => {
  assert.equal(monthlyReviewBalanceSummary({ ...screenshot, openingValue: 0 }).balanceChangePercent, null);
});
test("unreconciled stored financial values are exposed for review", () => {
  const bad = monthlyReviewBalanceSummary({ ...screenshot, totalCorpus: 60000 });
  assert.equal(bad.reconciled, false);
  assert.equal(Number(bad.reconciliationDifference.toFixed(2)), 12045.76);
});
test("withdrawals are subtracted from net external flow", () => {
  const data = monthlyReviewBalanceSummary({ totalCorpus: 85, openingValue: 100, newMoneyAdded: 0, totalWithdrawals: 10, investmentGain: -5 });
  assert.equal(data.netExternalFlow, -10);
  assert.equal(data.balanceChange, -15);
  assert.equal(data.reconciled, true);
});
console.log(`\n${checks} financial presentation checks passed.`);
