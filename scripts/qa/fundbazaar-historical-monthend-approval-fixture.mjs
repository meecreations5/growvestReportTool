import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessFundbazaarHistoricalMonthEnd } from "../../src/lib/portfolioHistoricalMonthEnd.js";
import { latestVerifiedPortfolioSnapshot } from "../../src/lib/portfolioSnapshotSelection.js";
import { unrepresentedExternalCashFlows, postValuationInvestmentActivity } from "../../src/lib/portfolioPeriodCoverage.js";
import { assessInvestorMonthEnd } from "../../src/lib/portfolioSystemWideAudit.js";

let passed = 0;
function check(label, fn) { fn(); passed += 1; process.stdout.write(`PASS ${label}\n`); }
const monthKey = "2026-10";
const holdings = Array.from({ length: 10 }, (_, i) => ({
  instrumentName: `Scheme ${i + 1}`, isin: `FUND${i}`, folioNo: `F${i}`,
  navDate: "2026-10-29", totalUnits: 100, totalInvested: i === 9 ? 9999 : 10000,
  currentValue: i === 9 ? 15543.64 : 9000, currentNav: 90
}));
const currentValue = holdings.reduce((total, h) => total + h.currentValue, 0);
const totalInvested = holdings.reduce((total, h) => total + h.totalInvested, 0);
const archiveTransactions = Array.from({ length: 10 }, (_, i) => ({ transactionDate: `2026-10-${String(i + 9).padStart(2, "0")}`, transactionType: "SIP Purchase", amount: i === 9 ? 5001 : 5000 }));
const ledgerTransactions = archiveTransactions.map((item) => ({ ...item, source: "fundbazaar", cashFlowType: "new_money" }));
const archive = {
  id: "a123", source: "fundbazaar", status: "available", valuationDate: "2026-10-29",
  historyReady: true, uniformNavDate: true, postValuationTransactionCount: 0,
  summary: { holdingCount: 10, currentValue, totalInvested, transactionCount: 20 }
};
const base = {
  archive, holdings, archiveTransactions, ledgerTransactions,
  currentPositions: holdings.map((item) => ({ source: "fundbazaar", isin: item.isin, folioNo: item.folioNo })),
  historicalPositions: holdings.map((item) => ({ source: "fundbazaar", isin: item.isin, folioNo: item.folioNo })),
  monthKey,
  snapshots: [{ snapshotDate: "2026-10-05", verificationStatus: "verified", summary: { currentValue: 47954.24 } }],
  laterCashFlows: { count: 0, newMoney: 0, withdrawals: 0 }
};
const a = (patch) => assessFundbazaarHistoricalMonthEnd({ ...base, ...patch });
check("approvable historical NAV 29 Oct is accepted for 31 Oct cutoff with disclosure", () => {
  const assessment = a({});
  assert.equal(assessment.ready, true);
  assert.equal(assessment.cutoffDate, "2026-10-31");
  assert.equal(assessment.valuationDate, "2026-10-29");
  assert.equal(assessment.ageDays, 2);
  assert.equal(assessment.sourceCashFlows.newMoney, 50001);
  assert.equal(assessment.ledgerCashFlows.newMoney, 50001);
  assert.equal(assessment.sourceValue, 96543.64);
  assert.ok(assessment.notes.some((item) => item.includes("Never label")));
});
check("newer Oct 30 archival evidence blocks a premature Oct 29 close", () => {
  const source = { ...archive, investorId: "jitendra-051" };
  const result = a({ archive: source, otherMonthArchives: [
    { ...source, id: "newer-oct30", valuationDate: "2026-10-30" }
  ] });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("newer Fundbazaar source") && reason.includes("2026-10-30")));
});
check("newer October archive for same investor blocks older valuation", () => {
  const existing = { ...archive, investorId: "jitendra-051", id: "old" };
  const result = a({ archive: existing, otherMonthArchives: [
    { id: "new", investorId: "jitendra-051", source: "fundbazaar", status: "available", valuationDate: "2026-10-31" }
  ] });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("2026-10-31")));
});
check("a later November archive is not a replacement for October closing", () => {
  const existing = { ...archive, investorId: "jitendra-051", id: "old" };
  const result = a({ archive: existing, otherMonthArchives: [
    { id: "nov", investorId: "jitendra-051", source: "fundbazaar", status: "available", valuationDate: "2026-11-04" }
  ] });
  assert.equal(result.ready, true);
});
check("voided newer archive cannot block older valid evidence", () => {
  const existing = { ...archive, investorId: "jitendra-051", id: "old" };
  const result = a({ archive: existing, otherMonthArchives: [
    { id: "bad", investorId: "jitendra-051", source: "fundbazaar", status: "voided", valuationDate: "2026-10-31" }
  ] });
  assert.equal(result.ready, true);
});
check("an unrelated investor newer archive cannot block this investor", () => {
  const existing = { ...archive, investorId: "jitendra-051", id: "old" };
  const result = a({ archive: existing, otherMonthArchives: [
    { id: "other", investorId: "other-investor", source: "fundbazaar", status: "available", valuationDate: "2026-10-31" }
  ] });
  assert.equal(result.ready, true);
});
check("unrepresented post-NAV contributions must block", () => assert.equal(a({ laterCashFlows: { count: 1, newMoney: 5000 } }).ready, false));
check("later non-cash investment switches block even without an external deposit", () => assert.equal(a({ ledgerTransactions: [...ledgerTransactions, { source: "fundbazaar", transactionDate: "2026-10-30", transactionType: "Switch In", cashFlowType: "internal", amount: 1000 }] }).ready, false));
check("unknown source ownership cannot be automatically certified", () => assert.equal(a({ currentPositions: [{ isin: "A" }] }).ready, false));
check("no corroborating portfolio master holdings blocks unattended approval", () => assert.equal(a({ currentPositions: [], historicalPositions: [] }).ready, false));
check("non Fundbazaar holdings block single-source approval", () => assert.equal(a({ currentPositions: [{ source: "manual" }] }).ready, false));
check("historical other-source holdings also block", () => assert.equal(a({ historicalPositions: [{ source: "ulip" }] }).ready, false));
check("incomplete archived holdings count blocks", () => assert.equal(a({ holdings: holdings.slice(0, 9) }).ready, false));
check("duplicate scheme and folio blocks", () => assert.equal(a({ holdings: [...holdings.slice(0, 9), { ...holdings[0] }] }).ready, false));
check("mismatched portfolio value blocks", () => assert.equal(a({ archive: { ...archive, summary: { ...archive.summary, currentValue: 47954 } } }).ready, false));
check("mismatched invested capital blocks", () => assert.equal(a({ archive: { ...archive, summary: { ...archive.summary, totalInvested: 50000 } } }).ready, false));
check("ledger omitting an October SIP blocks", () => assert.equal(a({ ledgerTransactions: ledgerTransactions.slice(1) }).ready, false));
check("no historical transactions with existing ledger blocks", () => assert.equal(a({ archiveTransactions: [] }).ready, false));
check("post NAV source transactions block", () => assert.equal(a({ archive: { ...archive, historyReady: false, postValuationTransactionCount: 1 } }).ready, false));
check("valid mixed weekday NAV dates permit cautious review with underlying dates preserved", () => {
  const result = a({ holdings: [{ ...holdings[0], navDate: "2026-10-28" }, ...holdings.slice(1)], archive: { ...archive, uniformNavDate: false, historyReady: false } });
  assert.equal(result.ready, true);
  assert.deepEqual(result.navDates, ["2026-10-28", "2026-10-29"]);
  assert.ok(result.notes.some((note) => note.includes("Different actual NAV dates")));
});
const october31Saturday = () => holdings.map((item, index) => index === 9
  ? { ...item, navDate: "2026-10-31", totalUnits: 235.366, currentNav: 41.1637, currentValue: 9688.54 }
  : { ...item, navDate: "2026-10-30" });
const october31Source = (mixed) => ({ ...archive, valuationDate: "2026-10-31", uniformNavDate: false, historyReady: false, summary: {
  ...archive.summary, currentValue: mixed.reduce((sum, h) => sum + h.currentValue, 0),
  totalInvested: mixed.reduce((sum, h) => sum + h.totalInvested, 0)
} });
check("Saturday 31 Oct source NAV accepted without separate AMFI verification when holdings reconcile", () => {
  const mixed = october31Saturday();
  const result = a({ holdings: mixed, archive: october31Source(mixed) });
  assert.equal(result.ready, true, result.blockers.join("; "));
  assert.deepEqual(result.navDates, ["2026-10-30", "2026-10-31"]);
  assert.equal(result.acceptedSaturdayNavs.length, 1);
  assert.equal(result.acceptedSaturdayNavs[0].sourceNav, 41.1637);
  assert.equal(result.acceptedSaturdayNavs[0].navDate, "2026-10-31");
  assert.equal(result.weekendNavsPendingVerification, 0);
  assert.ok(result.notes.some((text) => text.includes("Saturday NAV")));
});
check("Saturday source NAV does not excuse a quantity x NAV mismatch", () => {
  const mixed = october31Saturday();
  mixed[9].currentValue = 4000;
  const result = a({ holdings: mixed, archive: october31Source(mixed) });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("Saturday NAV holding")));
});
check("Saturday source NAV does not excuse a missing October SIP", () => {
  const mixed = october31Saturday();
  const result = a({ holdings: mixed, archive: october31Source(mixed), ledgerTransactions: ledgerTransactions.slice(1) });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("transactions do not reconcile")));
});
check("Sunday unverified exceptional NAV still blocks", () => {
  const mixed = holdings.map((item, index) => ({ ...item, navDate: index === 9 ? "2026-10-25" : "2026-10-30" }));
  const result = a({ holdings: mixed, archive: { ...archive, valuationDate: "2026-10-30", uniformNavDate: false, historyReady: false } });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("Unverified Sunday")));
});
check("official Sunday NAV may pass without forging a weekday date", () => {
  const mixed = holdings.map((item, index) => ({ ...item, navDate: index === 9 ? "2026-10-25" : "2026-10-30" }));
  const proof = { isin: mixed[9].isin, folioNo: mixed[9].folioNo, navDate: "2026-10-25", publishedNav: mixed[9].currentNav, referenceUrl: "https://www.amfiindia.com/net-asset-value/nav-history" };
  const result = a({ holdings: mixed, archive: { ...archive, valuationDate: "2026-10-30", uniformNavDate: false, historyReady: false }, weekendNavEvidence: [proof] });
  assert.equal(result.ready, true, result.blockers.join("; "));
  assert.equal(result.verifiedWeekendNavs.length, 1);
  assert.equal(result.verifiedWeekendNavs[0].navDate, "2026-10-25");
  assert.ok(result.notes.some((text) => text.includes("Exceptional Sunday NAV")));
});
check("Sunday evidence with mismatched NAV amount is rejected", () => {
  const mixed = holdings.map((item, index) => ({ ...item, navDate: index === 9 ? "2026-10-25" : "2026-10-30" }));
  const result = a({ holdings: mixed, archive: { ...archive, valuationDate: "2026-10-30", uniformNavDate: false, historyReady: false }, weekendNavEvidence: [{ isin: mixed[9].isin, folioNo: mixed[9].folioNo, navDate: "2026-10-25", publishedNav: 41.4308, referenceUrl: "https://www.amfiindia.com/net-asset-value/nav-history" }] });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((msg) => msg.includes("Unverified Sunday")));
});
check("untrusted website cannot verify a Sunday NAV", () => {
  const mixed = holdings.map((item, index) => ({ ...item, navDate: index === 9 ? "2026-10-25" : "2026-10-30" }));
  const result = a({ holdings: mixed, archive: { ...archive, valuationDate: "2026-10-30", uniformNavDate: false, historyReady: false }, weekendNavEvidence: [{ isin: mixed[9].isin, folioNo: mixed[9].folioNo, navDate: "2026-10-25", publishedNav: 90, referenceUrl: "https://notamfi.example.com/" }] });
  assert.equal(result.ready, false);
});
check("Sunday proof cannot override missing or mismatched investor transactions", () => {
  const mixed = holdings.map((item, index) => ({ ...item, navDate: index === 9 ? "2026-10-25" : "2026-10-30" }));
  const proof = { isin: mixed[9].isin, folioNo: mixed[9].folioNo, navDate: "2026-10-25", publishedNav: 90, referenceUrl: "https://www.amfiindia.com/net-asset-value/nav-history" };
  const result = a({ holdings: mixed, archive: { ...archive, valuationDate: "2026-10-30", uniformNavDate: false, historyReady: false }, weekendNavEvidence: [proof], ledgerTransactions: ledgerTransactions.slice(1) });
  assert.equal(result.ready, false);
});
check("SIP stop instruction does not count as a purchase or post-valuation position movement", () => {
  const stop = { source: "fundbazaar", isin: holdings[1].isin, folioNo: holdings[1].folioNo, transactionDate: "2026-10-30", transactionType: "SIP Stopped", amount: 5000, financialImpactStatus: "confirmed" };
  const result = a({ archiveTransactions: [...archiveTransactions, stop], ledgerTransactions: [...ledgerTransactions, stop] });
  assert.equal(result.ready, true, result.blockers.join("; "));
  assert.equal(result.sourceCashFlows.newMoney, 50001);
});
check("after correcting underlying NAV to Oct 30, regular Friday holdings are eligible", () => {
  const corrected = holdings.map((item) => ({ ...item, navDate: "2026-10-30" }));
  const result = a({ holdings: corrected, archive: { ...archive, valuationDate: "2026-10-30" } });
  assert.equal(result.ready, true);
});
check("transaction later than an individual older fund NAV blocks approval", () => {
  const dated = [{ ...holdings[0], navDate: "2026-10-28" }, ...holdings.slice(1)];
  const switchTx = { source: "fundbazaar", transactionDate: "2026-10-29", transactionType: "Switch In", cashFlowType: "internal", isin: holdings[0].isin, folioNo: holdings[0].folioNo, amount: 500 };
  const result = a({ holdings: dated, archive: { ...archive, uniformNavDate: false, historyReady: false }, ledgerTransactions: [...ledgerTransactions, switchTx] });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("holding's own NAV")));
});
check("future-November NAV is not eligible for October reporting even with a valid dated archive", () => {
  const late = [{ ...holdings[0], navDate: "2026-11-04" }, ...holdings.slice(1)];
  const result = a({ holdings: late, archive: { ...archive, valuationDate: "2026-11-04", uniformNavDate: false, historyReady: false } });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("reporting-month NAV")));
});
check("15-day-old fund NAV is flagged for review rather than declared unchanged", () => {
  const old = [{ ...holdings[0], navDate: "2026-10-15" }, ...holdings.slice(1)];
  const result = a({ holdings: old, archive: { ...archive, uniformNavDate: false, historyReady: false } });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((reason) => reason.includes("reporting-month NAV")));
});
check("prior month valuation is not valid for this cutoff", () => assert.equal(a({ archive: { ...archive, valuationDate: "2026-09-30" } }).ready, false));
check("a later month-end source is not quietly backdated", () => assert.equal(a({ archive: { ...archive, valuationDate: "2026-11-04" } }).ready, false));
check("snapshot dated after archived NAV within month blocks older approval", () => assert.equal(a({ snapshots: [{ snapshotDate: "2026-10-30", verificationStatus: "verified" }] }).ready, false));
check("unavailable source cannot be approved", () => assert.equal(a({ archive: { ...archive, status: "voided" } }).ready, false));
check("stale NAV beyond 7 days needs more evidence", () => assert.equal(a({ archive: { ...archive, valuationDate: "2026-10-12" } }).ready, false));
check("missing source date is not invented from upload date", () => assert.equal(a({ archive: { ...archive, valuationDate: "" } }).ready, false));
check("unknown month is rejected", () => assert.equal(a({ monthKey: "2026-13" }).ready, false));
check("approved archive is selected over early October operational snapshot", () => {
  const selected = latestVerifiedPortfolioSnapshot([
    { id: "old", snapshotDate: "2026-10-05", verificationStatus: "verified", summary: { currentValue: 47954.24 } },
    { id: "new", snapshotDate: "2026-10-29", verificationStatus: "verified", summary: { currentValue: 96543.64 } }
  ], (snap) => snap.snapshotDate <= "2026-10-31");
  assert.equal(selected.id, "new");
  assert.equal(unrepresentedExternalCashFlows({ snapshotDate: selected.snapshotDate, cutoffDate: "2026-10-31", transactions: ledgerTransactions }).count, 0);
  assert.equal(Number((selected.summary.currentValue - 48517.07 - 50001).toFixed(2)), -1974.43);
});
check("system audit recognizes approved source yet still preserves actual NAV date", () => {
  const s = { id: "new", snapshotDate: "2026-10-29", verificationStatus: "verified", snapshotVersion: 1, summary: { currentValue: 96543.64, positionCount: 10 }, reportSnapshotMode: "approved_historical_source", sourceValuationDate: "2026-10-29", sourceDatedValuationId: "a123", reportCutoffDate: "2026-10-31" };
  const result = assessInvestorMonthEnd({ monthKey, snapshots: [s], snapshotPositions: holdings.map((h) => ({ source: "fundbazaar", navDate: h.navDate })), valuations: [{ id: "a123", status: "available", valuationDate: "2026-10-29", monthlyReportEligible: true, reportSnapshotId: "new" }], uncoveredCashFlows: { count: 0 } });
  assert.equal(result.status, "ready");
  assert.equal(result.snapshotDate, "2026-10-29");
});
check("a switch after a verified historical NAV invalidates the reporting snapshot", () => {
  const activity = postValuationInvestmentActivity({ snapshotDate: "2026-10-29", cutoffDate: "2026-10-31", transactions: [{ transactionDate: "2026-10-30", transactionType: "Switch In", cashFlowType: "internal", amount: 100 }] });
  assert.equal(activity.count, 1);
  const s = { id: "new", snapshotDate: "2026-10-29", verificationStatus: "verified", summary: { currentValue: 96543.64 }, reportSnapshotMode: "approved_historical_source", sourceDatedValuationId: "a123", sourceValuationDate: "2026-10-29", reportCutoffDate: "2026-10-31" };
  const audit = assessInvestorMonthEnd({ monthKey, snapshots: [s], snapshotPositions: [{ source: "fundbazaar", navDate: "2026-10-29" }], valuations: [{ id: "a123", status: "available", valuationDate: "2026-10-29", reportSnapshotId: "new", monthlyReportEligible: true }], uncoveredCashFlows: { count: 0 }, laterInvestmentActivity: activity });
  assert.equal(audit.status, "blocked");
});
check("approved snapshots retain per-fund real NAV dates rather than the latest archive date", () => {
  const route = readFileSync("src/app/api/portfolio/valuation-history/approve-month-end/route.js", "utf8");
  assert.match(route, /navDate:\s*holding\.navDate/);
  assert.match(route, /valuationDate:\s*holding\.navDate/);
  assert.match(route, /sourceNavDates:/);
});
console.log(`${passed} historical month-end promotion fixture checks passed`);
