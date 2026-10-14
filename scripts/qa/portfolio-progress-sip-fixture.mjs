import assert from "node:assert/strict";
import { deriveFundbazaarMonthlySip } from "../../src/lib/fundbazaarSip.js";
import { buildMonthlyPortfolioProgress } from "../../src/lib/portfolioMonthlyProgress.js";

const nikhilHdfcFocused = [
  { transactionDate: "2026-08-18", purchaseAmount: 2000 },
  { transactionDate: "2026-08-20", purchaseAmount: 5000 },
  { transactionDate: "2026-09-18", purchaseAmount: 2000 },
  { transactionDate: "2026-09-21", purchaseAmount: 5000 }
];
const hdfcSip = deriveFundbazaarMonthlySip(nikhilHdfcFocused, "2026-10-09");
assert.equal(hdfcSip.amount, 7000);
assert.equal(hdfcSip.monthKey, "2026-09");

const nikhilAll = [
  [{ transactionDate: "2026-09-21", purchaseAmount: 5000 }],
  [{ transactionDate: "2026-09-21", purchaseAmount: 2000 }],
  nikhilHdfcFocused,
  [{ transactionDate: "2026-09-21", purchaseAmount: 2000 }],
  [{ transactionDate: "2026-09-17", purchaseAmount: 2000 }],
  [{ transactionDate: "2026-09-21", purchaseAmount: 5000 }]
];
const totalSip = nikhilAll.reduce((sum, rows) => sum + deriveFundbazaarMonthlySip(rows, "2026-10-09").amount, 0);
assert.equal(totalSip, 23000);

const progress = buildMonthlyPortfolioProgress([
  { id: "aug", snapshotDate: "2026-08-31", summary: { currentValue: 30000 } },
  { id: "sep", snapshotDate: "2026-09-30", summary: { currentValue: 42893 } },
  { id: "oct", snapshotDate: "2026-10-07", summary: { currentValue: 47956 } }
], [
  { transactionDate: "2026-09-18", transactionType: "eSIP", cashFlowType: "new_money", amount: 23000 },
  { transactionDate: "2026-10-05", transactionType: "Purchase", cashFlowType: "new_money", amount: 4900 }
], { currentMonthKey: "2026-10" });

assert.equal(progress[0].monthKey, "2026-10");
assert.equal(progress[0].isCurrentMonth, true);
assert.equal(progress[0].openingValue, 42893);
assert.equal(progress[0].closingValue, 47956);
assert.equal(progress[0].newMoney, 4900);
assert.equal(progress[0].investmentGain, 163);
assert.equal(progress[1].monthKey, "2026-09");
assert.equal(progress[1].openingValue, 30000);
assert.equal(progress[1].newMoney, 23000);
assert.equal(progress[1].investmentGain, -10107);

console.log("portfolio-progress-sip fixture passed");
