import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMonthlyPortfolioProgress } from "../../src/lib/portfolioMonthlyProgress.js";
import { externalPortfolioCashFlow, unrepresentedExternalCashFlows } from "../../src/lib/portfolioPeriodCoverage.js";

// Reproduction based on the observed October 05 closing figure and the
// confirmed October SIP contributions, which became visible in November.
const transactions = [
  { source: "fundbazaar", transactionDate: "2026-10-18", transactionType: "eSIP", cashFlowType: "new_money", amount: 49998 },
  { source: "fundbazaar", transactionDate: "2026-10-19", transactionType: "Purchase", cashFlowType: "new_money", amount: 3 },
  { source: "fundbazaar", transactionDate: "2026-10-21", transactionType: "Switch In", cashFlowType: "internal", amount: 80000 },
  { source: "fundbazaar", transactionDate: "2026-10-22", transactionType: "Purchase", cashFlowType: "new_money", financialImpactStatus: "pending", amount: 12000 }
];
const snapshots = [
  { id: "september", snapshotDate: "2026-09-30", verificationStatus: "verified", summary: { currentValue: 48517.07 } },
  { id: "october-early", snapshotDate: "2026-10-05", verificationStatus: "verified", summary: { currentValue: 47954.24 } },
  { id: "november", snapshotDate: "2026-11-04", verificationStatus: "verified", summary: { currentValue: 99479 } }
];
const OctoberGap = unrepresentedExternalCashFlows({ snapshotDate: "2026-10-05", cutoffDate: "2026-10-31", transactions });
assert.equal(OctoberGap.newMoney, 50001);
assert.equal(OctoberGap.withdrawals, 0);
assert.equal(OctoberGap.count, 2);
assert.deepEqual(OctoberGap.sources, ["fundbazaar"]);
assert.equal(externalPortfolioCashFlow(transactions[2]).newMoney, 0);
assert.equal(externalPortfolioCashFlow(transactions[3]).newMoney, 0);

const progress = buildMonthlyPortfolioProgress(snapshots, transactions, { currentMonthKey: "2026-11", todayDate: "2026-11-05" });
const october = progress.find((row) => row.monthKey === "2026-10");
assert.equal(october.openingValue, 48517.07);
assert.equal(october.closingValue, 47954.24); // known early snapshot, NOT an October closing fact
assert.equal(october.newMoney, 50001);         // correct attribution to October
assert.equal(october.needsClosingSnapshotRefresh, true);
assert.equal(october.status, "needs_snapshot_refresh");
assert.equal(october.investmentGain, null);     // never print the bogus -50563.83 loss
assert.equal(october.monthlyReturn, null);      // never print the bogus -104.22% return

// 04 November NAV contains the late October subscription, but the previous
// portfolio snapshot is still October 05. November performance is also pending.
const november = progress.find((row) => row.monthKey === "2026-11");
assert.equal(november.closingValue, 99479);
assert.equal(november.newMoney, 0);
assert.equal(november.needsOpeningSnapshotRefresh, true);
assert.equal(november.investmentGain, null);

// Once verified month-end valuation is present, October gain/loss is computed
// using the October flows, without changing the flow date or backdating NAVs.
const reconciled = buildMonthlyPortfolioProgress([
  snapshots[0],
  { id: "october-month-end", snapshotDate: "2026-10-31", verificationStatus: "verified", summary: { currentValue: 98350 } },
  snapshots[2]
], transactions, { currentMonthKey: "2026-11", todayDate: "2026-11-05" });
const correctOctober = reconciled.find((row) => row.monthKey === "2026-10");
assert.equal(correctOctober.newMoney, 50001);
assert.equal(correctOctober.needsSnapshotRefresh, false);
assert.equal(correctOctober.investmentGain, Number((98350 - 48517.07 - 50001).toFixed(2)));
assert.equal(unrepresentedExternalCashFlows({ snapshotDate: "2026-10-31", cutoffDate: "2026-10-31", transactions }).count, 0);

// Server gate must reject incomplete historical financials on report creation
// AND on report reconciliation before completing/PDF/publish.
const sourceRoute = readFileSync("src/app/api/portfolio/report-source/route.js", "utf8");
const reconciler = readFileSync("src/lib/server/reportPortfolioReconciliation.js", "utf8");
assert.match(sourceRoute, /inspectFrozenMonthlyActivity\(/);
assert.match(sourceRoute, /inspectFrozenSourceSet\(/);
assert.match(sourceRoute, /portfolio_closing_snapshot_missing_cash_flow/);
assert.match(reconciler, /checkReportCashFlowCoverage/);
assert.match(reconciler, /cash_flows_after_closing_snapshot/);

const portfolioPanel = readFileSync("src/components/portfolio/InvestorPortfolioPanel.js", "utf8");
const investorDetail = readFileSync("src/components/investors/InvestorDetailClient.js", "utf8");
assert.match(portfolioPanel, /Closing valuation pending/);
assert.match(portfolioPanel, /snapshotBehindLiveValuation\s*\?\s*null\s*:\s*snapshotMovement/);
assert.match(portfolioPanel, /reconciliationStatus=\{displayReconciliationStatus\}/);
assert.match(investorDetail, /latestReportNeedsReconciliation\s*\?\s*"Pending"/);
console.log("fundbazaar October snapshot coverage: cash-flow, report gate, investor UI assertions passed");
