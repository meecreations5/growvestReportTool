import assert from "node:assert/strict";
import { externalPortfolioCashFlow, isConfirmedInvestmentActivity, postValuationInvestmentActivity, unrepresentedExternalCashFlows } from "../../src/lib/portfolioPeriodCoverage.js";
import { transactionBelongsToMonth, inspectPostCutoffCapture } from "../../src/lib/portfolioMonthlyClose.js";

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log("PASS", name); };
const sip = { source: "fundbazaar", transactionDate: "2026-10-05", transactionType: "SIP Purchase", transactionStatus: "confirmed", amount: 5000 };
check("confirmed October SIP contributes actual 5000", () => assert.equal(externalPortfolioCashFlow(sip).newMoney, 5000));
check("a SIP stop on October 15 is not another purchase", () => assert.deepEqual(externalPortfolioCashFlow({ ...sip, transactionDate: "2026-10-15", transactionType: "SIP Stopped" }), { newMoney: 0, withdrawals: 0 }));
check("a cancelled October 20 SIP is not purchased", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionDate: "2026-10-20", transactionStatus: "cancelled" }).newMoney, 0));
check("a skipped SIP is not purchased", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionType: "SIP Skipped" }).newMoney, 0));
check("SIP Purchase Failed without a status is not counted", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionType: "SIP Purchase Failed", transactionStatus: undefined }).newMoney, 0));
check("SIP terminated is not a purchase", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionType: "SIP Terminated" }).newMoney, 0));
check("a paused SIP is not purchased", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionType: "SIP Pause" }).newMoney, 0));
check("a resume instruction is not purchased", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionType: "Resume SIP" }).newMoney, 0));
check("a stopped SIP does not create a withdrawal", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionType: "SIP Stop", cashFlowType: "withdrawal" }).withdrawals, 0));
check("one cancelled status wins even when another status says confirmed", () => assert.equal(externalPortfolioCashFlow({ ...sip, transactionStatus: "cancelled", financialImpactStatus: "confirmed" }).newMoney, 0));
check("confirmed SIP purchase with a stop instruction as metadata still counts", () => assert.equal(externalPortfolioCashFlow({ ...sip, sipInstruction: "stop" }).newMoney, 5000));
check("confirmed redemption with SIP stopped as metadata still withdraws", () => assert.equal(externalPortfolioCashFlow({ transactionDate: "2026-10-15", transactionType: "Full Redemption", cashFlowType: "withdrawal", amount: 3000, sipInstruction: "stop" }).withdrawals, 3000));
check("post valuation SIP stop does not create fictitious quantity change", () => assert.equal(postValuationInvestmentActivity({ snapshotDate: "2026-10-05", cutoffDate: "2026-10-31", transactions: [{ transactionDate: "2026-10-15", transactionType: "SIP Stopped", amount: 5000 }] }).count, 0));
check("post valuation confirmed SIP investment is still detected", () => assert.equal(postValuationInvestmentActivity({ snapshotDate: "2026-10-05", cutoffDate: "2026-10-31", transactions: [sip, { ...sip, transactionDate: "2026-10-19" }] }).count, 1));
check("unrepresented cash flows exclude only stop and cancelled, not actual purchases", () => {
  const rows = [sip, { ...sip, transactionDate: "2026-10-15", transactionType: "SIP Stopped" }, { ...sip, transactionDate: "2026-10-20", transactionStatus: "cancelled" }, { ...sip, transactionDate: "2026-10-12", amount: 2000 }];
  const result = unrepresentedExternalCashFlows({ snapshotDate: "2026-10-01", cutoffDate: "2026-10-31", transactions: rows });
  assert.equal(result.newMoney, 7000); assert.equal(result.count, 2);
});
check("November purchase is not an October purchase", () => assert.equal(transactionBelongsToMonth({ transactionDate: "2026-11-01", transactionType: "SIP Purchase", amount: 5000 }, "2026-10"), false));
check("October closing snapshot is insulated from November SIP stop", () => {
  const result = inspectPostCutoffCapture({ snapshot: { verificationStatus: "verified", snapshotDate: "2026-11-02", summary: { currentValue: 100000, positionCount: 1 } }, positions: [{ navDate: "2026-10-30", currentValue: 100000 }], cutoffDate: "2026-10-31", postCutoffActivity: [{ transactionDate: "2026-11-01", transactionType: "SIP Stop", amount: 5000 }] });
  assert.equal(result.eligible, true);
});
console.log(`${passed} mid-month SIP financial integrity checks passed.`);
