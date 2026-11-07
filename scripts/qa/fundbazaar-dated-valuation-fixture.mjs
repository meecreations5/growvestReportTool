import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planFundbazaarDatedValuation } from "../../src/lib/portfolioDatedValuationPlan.js";

const file = {
  source: "fundbazaar",
  reportType: "fundbazaar_client_valuation",
  summary: { currentValue: 96543.64 },
  holdings: Array.from({ length: 10 }, (_, i) => ({
    isin: `FUND${i}`,
    folioNo: String(i + 10),
    schemeName: `FUND ${i}`,
    navDate: "2026-10-29",
    totalInvested: i === 9 ? 9999 : 10000,
    totalUnits: 10,
    currentNav: 96.5,
    currentValue: i === 9 ? 9693.64 : 9650,
    monthlySip: 5000
  })),
  transactions: [
    ...Array.from({ length: 10 }, (_, i) => ({ transactionDate: "2026-09-15", transactionType: "eSIP", amount: i === 9 ? 4998 : 5000 })),
    ...Array.from({ length: 10 }, (_, i) => ({ transactionDate: "2026-10-15", transactionType: "eSIP", amount: i === 9 ? 5001 : 5000 }))
  ]
};

const plan = planFundbazaarDatedValuation(file);
assert.equal(plan.valuationDate, "2026-10-29");
assert.equal(plan.summary.currentValue, 96543.64);
assert.equal(plan.summary.totalInvested, 99999);
assert.equal(plan.summary.holdingCount, 10);
assert.equal(plan.summary.transactionCount, 20);
assert.equal(plan.uniformNavDate, true);
assert.equal(plan.historyReady, true);
assert.equal(plan.postValuationTransactionCount, 0);
assert.equal(plan.transactions.filter((x) => x.transactionDate.startsWith("2026-09")).reduce((n, t) => n + t.amount, 0), 49998);
assert.equal(plan.transactions.filter((x) => x.transactionDate.startsWith("2026-10")).reduce((n, t) => n + t.amount, 0), 50001);
assert.equal(plan.valuationDate, "2026-10-29", "30 Oct file export must not relabel the 29 Oct NAV");
assert.equal(Number((96543.64 - 48517.07 - 50001).toFixed(2)), -1974.43);

const withLateTransaction = structuredClone(file);
withLateTransaction.transactions[0].transactionDate = "2026-10-30";
assert.equal(planFundbazaarDatedValuation(withLateTransaction).historyReady, false);
assert.equal(planFundbazaarDatedValuation(withLateTransaction).postValuationTransactionCount, 1);
const withMixedNavDates = structuredClone(file);
withMixedNavDates.holdings[2].navDate = "2026-10-28";
assert.equal(planFundbazaarDatedValuation(withMixedNavDates).uniformNavDate, false);
assert.equal(planFundbazaarDatedValuation(withMixedNavDates).historyReady, false);
const invalid = structuredClone(file);
invalid.holdings[2].navDate = "";
assert.throws(() => planFundbazaarDatedValuation(invalid), /valid NAV date/);
const mismatched = structuredClone(file);
mismatched.summary.currentValue = 99500;
assert.throws(() => planFundbazaarDatedValuation(mismatched), /does not match/);

const archiveRoute = readFileSync("src/app/api/portfolio/valuation-history/route.js", "utf8");
const importer = readFileSync("src/app/api/portfolio/imports/fundbazaar/commit/route.js", "utf8");
const store = readFileSync("src/lib/server/portfolioDatedValuationStore.js", "utf8");
const rollback = readFileSync("src/app/api/portfolio/imports/[batchId]/recovery/route.js", "utf8");
assert.match(archiveRoute, /verifyStaffRequest/);
assert.match(archiveRoute, /getAccessibleInvestor/);
assert.match(store, /portfolioDatedValuationHoldings/);
assert.match(store, /portfolioDatedValuationTransactions/);
assert.match(store, /fingerprint\}\|\$\{file\.id\}/);
assert.match(store, /monthlyReportEligible: false/);
assert.match(importer, /newerLiveValuationExists/);
assert.match(importer, /historical_valuation_archived_only/);
assert.match(rollback, /voidDatedValuationForImport/);
assert.match(readFileSync("src/lib/server/portfolioReset.js", "utf8"), /portfolioDatedValuationTransactions/);
assert.match(readFileSync("src/components/portfolio/PortfolioImportRecoveryDialog.js", "utf8"), /Save dated valuation \(no reprocess\)/);
assert.match(readFileSync("src/components/portfolio/InvestorPortfolioPanel.js", "utf8"), /InvestorDatedValuationHistory/);
console.log("Fundbazaar dated valuation archive fixture: 20 positive and safety checks passed");
