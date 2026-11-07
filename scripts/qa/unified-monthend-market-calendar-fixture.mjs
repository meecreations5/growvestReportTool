import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lastExchangeSessionOnOrBefore, marketSessionOn, portfolioValuationCalendar } from "../../src/lib/portfolioMarketCalendar.js";
import { inspectFrozenMonthlyActivity, inspectFrozenSourceSet } from "../../src/lib/portfolioMonthlyIntegrity.js";
import { assessManualPmsMonthlyArchive } from "../../src/lib/portfolioManualMonthEnd.js";
import { assessInvestorMonthEnd } from "../../src/lib/portfolioSystemWideAudit.js";
import { assessFundbazaarHistoricalMonthEnd, equivalentFundbazaarDatedArchives } from "../../src/lib/portfolioHistoricalMonthEnd.js";
import { buildMonthlyReportingLedger } from "../../src/lib/portfolioMonthlyLedger.js";
import { selectVerifiedMonthEndClosingSnapshot } from "../../src/lib/portfolioSnapshotSelection.js";
let passed = 0;
const check = (label, fn) => { fn(); passed++; console.log(`PASS ${label}`); };
const october = "2026-10-31";
const mf = { positionId: "mf1", source: "fundbazaar", isin: "INF000000001", folioNo: "MF100", instrumentName: "Fund 1", productType: "mutual_fund", navDate: "2026-10-30", currentValue: 95000 };
const pms = { positionId: "pms1", source: "manual", manualPortfolioManaged: true, manualPortfolioAccountCode: "PMS-01", productType: "pms", valuationDate: "2026-10-31", currentValue: 598000 };
const mixed = { snapshotDate: "2026-10-31", reportSnapshotMode: "approved_historical_multi_source", sourceValuationDates: { fundbazaar: "2026-10-30", manual: "2026-10-31" } };
const txn = (patch = {}) => ({ source: "fundbazaar", isin: mf.isin, folioNo: mf.folioNo, transactionDate: "2026-10-21", transactionType: "SIP Purchase", cashFlowType: "new_money", amount: 5000, transactionStatus: "confirmed", ...patch });
const integrity = (txs = [], patch = {}) => inspectFrozenMonthlyActivity({ snapshot: mixed, positions: [mf, pms], transactions: txs, cutoffDate: october, startDate: "2026-10-01", ...patch });

check("A multi-source approved Oct 31 close outranks a high-revision operational Oct 31 capture", () => {
  const snapshots = [
    { id: "operational", snapshotDate: "2026-10-31", verificationStatus: "verified", snapshotVersion: 9 },
    { id: "combined", snapshotDate: "2026-10-31", verificationStatus: "verified", snapshotVersion: 1,
      reportSnapshotMode: "approved_historical_multi_source", reportCutoffDate: october }
  ];
  assert.equal(selectVerifiedMonthEndClosingSnapshot(snapshots, october).id, "combined");
});
check("A verified multi-source close outranks a same-date Fundbazaar-only approval", () => {
  const snapshots = [
    { id: "fb-only", snapshotDate: "2026-10-31", verificationStatus: "verified", snapshotVersion: 9,
      reportSnapshotMode: "approved_historical_source", reportCutoffDate: october },
    { id: "combined", snapshotDate: "2026-10-31", verificationStatus: "verified", snapshotVersion: 1,
      reportSnapshotMode: "approved_historical_multi_source", reportCutoffDate: october }
  ];
  assert.equal(selectVerifiedMonthEndClosingSnapshot(snapshots, october).id, "combined");
});
check("A genuinely newer verified date still outranks an older approved historical source", () => {
  const snapshots = [
    { id: "live-31", snapshotDate: "2026-10-31", verificationStatus: "verified" },
    { id: "approved-29", snapshotDate: "2026-10-29", verificationStatus: "verified",
      reportSnapshotMode: "approved_historical_source", reportCutoffDate: october }
  ];
  assert.equal(selectVerifiedMonthEndClosingSnapshot(snapshots, october).id, "live-31");
});
check("A November approved close cannot be used for October", () => {
  const snapshots = [
    { id: "old", snapshotDate: "2026-10-30", verificationStatus: "verified" },
    { id: "nov", snapshotDate: "2026-11-08", verificationStatus: "verified",
      reportSnapshotMode: "approved_historical_source", reportCutoffDate: "2026-11-30" }
  ];
  assert.equal(selectVerifiedMonthEndClosingSnapshot(snapshots, october).id, "old");
});
check("Sunday 8 Nov 2026 is an official NSE equity Muhurat trading day", () => {
  const s = marketSessionOn("2026-11-08", "nse_cash");
  assert.equal(s.trading, true); assert.equal(s.definitive, true); assert.equal(s.reason, "official_special_session");
});
check("Sunday 8 Nov 2026 is an official NSE derivatives session", () => assert.equal(marketSessionOn("2026-11-08", "nse_derivatives").trading, true));
check("Sunday 8 Nov 2026 is an official BSE cash session", () => assert.equal(marketSessionOn("2026-11-08", "bse_cash").trading, true));
check("A Sunday equity session does not fabricate a Sunday mutual fund NAV", () => {
  const s = marketSessionOn("2026-11-08", "mutual_fund_nav");
  assert.equal(s.trading, null); assert.equal(s.reason, "requires_actual_amc_nav_publication");
});
check("An ordinary Sunday without special trading is closed for NSE cash", () => assert.equal(marketSessionOn("2026-11-15").trading, false));
check("The 10 Nov 2026 NSE holiday is closed", () => assert.equal(marketSessionOn("2026-11-10").trading, false));
check("The 9 Nov trading day is the latest session through the 10 Nov holiday", () => assert.equal(lastExchangeSessionOnOrBefore("2026-11-10").date, "2026-11-09"));
check("The 8 Nov Sunday Muhurat session is the last exchange day on 8 Nov", () => assert.equal(lastExchangeSessionOnOrBefore("2026-11-08").date, "2026-11-08"));
check("31 Oct Saturday equity has no exchange session", () => assert.equal(lastExchangeSessionOnOrBefore("2026-10-31").date, "2026-10-30"));
check("A Saturday mutual fund NAV remains a source fact, not a mandatory weekday shift", () => assert.equal(marketSessionOn("2026-10-31", "mutual_fund_nav").trading, null));
check("Outside official year exchange calendar is marked provisional", () => assert.equal(marketSessionOn("2027-11-08").definitive, false));
check("Fundbazaar uses an AMC NAV calendar", () => assert.equal(portfolioValuationCalendar(mf), "mutual_fund_nav"));
check("Managed PMS uses actual source statements, not fictional NSE NAVs", () => assert.equal(portfolioValuationCalendar(pms), "source_reported"));
check("Stock delivery uses the official cash-market calendar", () => assert.equal(portfolioValuationCalendar({ productType: "stock_delivery" }), "nse_cash"));

check("All-investor scanner requires linked Fundbazaar and PMS original approvals", () => {
  const s = { id: "combined-close", snapshotDate: "2026-10-30", verificationStatus: "verified",
    reportSnapshotMode: "approved_historical_multi_source", reportCutoffDate: october,
    sourceDatedValuationId: "fb-source", sourceDatedValuationIds: { fundbazaar: "fb-source", manual: "pms-source" },
    sourceValuationDates: { fundbazaar: "2026-10-29", manual: "2026-10-30" }, summary: { currentValue: 693000, positionCount: 2 } };
  const docs = ["fundbazaar", "manual"].map((source) => ({ id: source === "manual" ? "pms-source" : "fb-source",
    source, status: "available", valuationDate: source === "manual" ? "2026-10-30" : "2026-10-29",
    monthlyReportEligible: true, reportSnapshotId: "combined-close" }));
  const originalPositions = [{ ...mf, navDate: "2026-10-29" }, { ...pms, valuationDate: "2026-10-30" }];
  const ready = assessInvestorMonthEnd({ monthKey: "2026-10", snapshots: [s], valuations: docs, snapshotPositions: originalPositions });
  assert.equal(ready.status, "ready"); assert.equal(ready.code, "approved_last_available_nav");
  const voided = assessInvestorMonthEnd({ monthKey: "2026-10", snapshots: [s], valuations: [{ ...docs[0] }, { ...docs[1], status: "voided" }], snapshotPositions: originalPositions });
  assert.equal(voided.status, "blocked"); assert.equal(voided.code, "historical_multi_source_provenance_incomplete");
});
check("A verified October MF and PMS pair with earlier October capital is eligible", () => {
  const r = integrity([txn(), { source: "manual", manualPortfolioAccountCode: "PMS-01", transactionDate: "2026-10-18", transactionType: "PMS Capital Addition", cashFlowType: "new_money", amount: 100000 }]);
  assert.equal(r.ready, true); assert.equal(r.postValuationCash.count, 0);
});
check("An Oct 31 MF SIP after Oct 30 fund NAV is blocked even if PMS snapshot is Oct 31", () => {
  const r = integrity([txn({ transactionDate: "2026-10-31" })]);
  assert.equal(r.ready, false); assert.equal(r.postValuationCash.count, 1); assert.equal(r.postValuationCash.newMoney, 5000);
});
check("A cancelled Oct 31 SIP is never counted", () => assert.equal(integrity([txn({ transactionDate: "2026-10-31", transactionStatus: "cancelled" })]).ready, true));
check("An internal switch after the matching MF NAV blocks with zero external cash", () => {
  const r = integrity([txn({ transactionDate: "2026-10-31", transactionType: "Switch In", cashFlowType: "internal" })]);
  assert.equal(r.ready, false); assert.equal(r.postValuationCash.count, 0); assert.equal(r.postValuationActivity.count, 1);
});
check("New PMS money after the PMS account's NAV is blocked", () => {
  const r = integrity([{ source: "manual", manualPortfolioAccountCode: "PMS-01", transactionDate: "2026-10-31", cashFlowType: "new_money", amount: 900 }], { positions: [{ ...pms, valuationDate: "2026-10-30" }] });
  assert.equal(r.ready, false); assert.equal(r.postValuationCash.newMoney, 900);
});
check("An unresolved external action is conservatively checked against frozen position dates", () => {
  const r = integrity([{ source: "investor_action_confirmation", transactionDate: "2026-10-31", cashFlowType: "withdrawal", amount: 1000 }]);
  assert.equal(r.postValuationCash.withdrawals, 1000);
});
check("Nov 8 Sunday trade belongs to November, never October", () => {
  const nov = txn({ transactionDate: "2026-11-08", cashFlowType: "new_money" });
  assert.equal(integrity([nov]).ready, true);
  const novReport = inspectFrozenMonthlyActivity({ snapshot: { snapshotDate: "2026-11-07" }, positions: [{ ...mf, navDate: "2026-11-07" }], transactions: [nov], startDate: "2026-11-01", cutoffDate: "2026-11-30" });
  assert.equal(novReport.postValuationActivity.count, 1);
});
check("November equity trade date is preserved; upload date is ignored", () => {
  const report = inspectFrozenMonthlyActivity({ snapshot: { snapshotDate: "2026-11-07" }, positions: [{ ...mf, navDate: "2026-11-07" }], transactions: [{ ...txn(), transactionDate: "2026-11-08", uploadDate: "2026-11-09" }], startDate: "2026-11-01", cutoffDate: "2026-11-30" });
  assert.equal(report.movements[0].date, "2026-11-08");
});
check("Postcutoff NAV dates fail closed", () => assert.equal(integrity([], { positions: [{ ...mf, navDate: "2026-11-02" }] }).invalidPositionDates, 1));

const archives = [
  { id: "fb", source: "fundbazaar", status: "available", valuationDate: "2026-10-30" },
  { id: "pm", source: "manual", status: "available", valuationDate: "2026-10-31" }
];
check("A Fundbazaar-only snapshot cannot hide a current-month PMS archive", () => {
  const r = inspectFrozenSourceSet({ snapshot: { snapshotDate: "2026-10-30" }, positions: [mf], archives, cutoffDate: october });
  assert.equal(r.ready, false); assert.equal(r.issues[0].source, "manual");
});
check("The combined frozen snapshot covers both imported sources", () => {
  const r = inspectFrozenSourceSet({ snapshot: mixed, positions: [mf, pms], archives, cutoffDate: october });
  assert.equal(r.ready, true); assert.deepEqual(r.frozenSources, ["fundbazaar", "manual"]);
});
check("An updated PMS archive newer than the report's PMS valuation invalidates it", () => {
  const r = inspectFrozenSourceSet({ snapshot: { ...mixed, sourceValuationDates: { fundbazaar: "2026-10-30", manual: "2026-10-28" } }, positions: [mf, pms], archives, cutoffDate: october });
  assert.equal(r.ready, false); assert.equal(r.issues[0].code, "newer_source");
});
check("A genuine November archive does not alter October source membership", () => {
  const r = inspectFrozenSourceSet({ snapshot: mixed, positions: [mf, pms], archives: [...archives, { ...archives[1], id: "nov", valuationDate: "2026-11-08" }], cutoffDate: october });
  assert.equal(r.ready, true);
});
check("Repeated identical-NAV daily uploads do not create artificial source conflicts", () => {
  const copies = [archives[0], { ...archives[0], id: "fb-upload-2", sourceFileFingerprint: "different-import", summary: { currentValue: 95000, totalInvested: 90000, holdingCount: 1 } }, { ...archives[0], id: "fb-upload-1", summary: { currentValue: 95000, totalInvested: 90000, holdingCount: 1 } }];
  const r = inspectFrozenSourceSet({ snapshot: { ...mixed, sourceValuationDates: { fundbazaar: "2026-10-30" } }, positions: [mf], archives: copies.slice(1), cutoffDate: october });
  assert.equal(r.ready, true);
});
check("Different archived financial totals on the same source/date require review", () => {
  const a = { ...archives[0], summary: { currentValue: 95000, totalInvested: 90000, holdingCount: 1 } };
  const b = { ...a, id: "conflict", summary: { ...a.summary, currentValue: 85000 } };
  const r = inspectFrozenSourceSet({ snapshot: { ...mixed, sourceValuationDates: { fundbazaar: "2026-10-30" } }, positions: [mf], archives: [a, b], cutoffDate: october });
  assert.equal(r.ready, false); assert.equal(r.issues[0].code, "conflicting_archive_versions");
});
check("A voided PMS archive is never treated as eligible evidence", () => {
  const r = inspectFrozenSourceSet({ snapshot: { snapshotDate: "2026-10-30" }, positions: [mf], archives: [archives[0], { ...archives[1], status: "voided" }], cutoffDate: october });
  assert.equal(r.ready, true);
});

const manualArchive = {
  id: "pmv1", investorId: "inv1", status: "available", source: "manual", sourceReportType: "manual_pms_workbook", sourceImportId: "batch1",
  sourceCaptureDate: "2026-11-02", valuationDate: "2026-10-31", historyReady: true, missingValuationDateCount: 0,
  summary: { currentValue: 598000, totalInvested: 580000, holdingCount: 1, accountCount: 1 }
};
const manualHolding = { ...pms, id: "pms1", sourceImportId: "batch1", totalInvested: 580000 };
const accounts = [{ accountCode: "PMS-01", manualBulkImportId: "batch1", snapshotDate: "2026-11-02" }];
const manual = (patch = {}) => assessManualPmsMonthlyArchive({ archive: manualArchive, holdings: [manualHolding], accountSnapshots: accounts, transactions: [], monthKey: "2026-10", cutoffDate: october, ...patch });
check("Dated Manual PMS October workbook imported on Nov 2 is eligible", () => assert.equal(manual().ready, true));
check("PMS 598000-500000-100000+20000 correctly yields INR 18000 net gain", () => assert.equal(598000 - 500000 - 100000 + 20000, 18000));
check("Manual PMS with no original valuation date blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, valuationDate: "" }] }).ready, false));
check("Manual PMS with postcutoff November NAV blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, valuationDate: "2026-11-02" }] }).ready, false));
check("Manual PMS with older than 15 day NAV blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, valuationDate: "2026-10-01" }] }).ready, false));
check("Manual PMS with a synthetic upload-date valuation blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, valuationDateBasis: "manual_import_date" }] }).ready, false));
check("Manual PMS missing account receipt blocks", () => assert.equal(manual({ accountSnapshots: [] }).ready, false));
check("Manual PMS holding not tied to account code blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, manualPortfolioAccountCode: "DIFFERENT" }] }).ready, false));
check("Manual PMS source import batch mismatch blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, sourceImportId: "other-batch" }] }).ready, false));
check("Manual PMS unverified source archive blocks", () => assert.equal(manual({ archive: { ...manualArchive, historyReady: false } }).ready, false));
check("Manual PMS late capture on November 10 blocks automatic closing", () => assert.equal(manual({ archive: { ...manualArchive, sourceCaptureDate: "2026-11-10" } }).ready, false));
check("Manual PMS contradictory total blocks", () => assert.equal(manual({ archive: { ...manualArchive, summary: { ...manualArchive.summary, currentValue: 500000 } } }).ready, false));
check("Manual PMS later actual capital movement blocks", () => assert.equal(manual({ holdings: [{ ...manualHolding, valuationDate: "2026-10-30" }], transactions: [{ source: "manual", manualPortfolioAccountCode: "PMS-01", transactionDate: "2026-10-31", transactionType: "PMS Capital Addition", cashFlowType: "new_money", amount: 1000 }] }).ready, false));
check("Manual PMS missing invested capital cannot be auto-verified", () => assert.equal(manual({ holdings: [{ ...manualHolding, totalInvested: 0, costBasisAvailable: false }] }).ready, false));
check("Manual PMS archive from future December cannot be backdated", () => assert.equal(manual({ archive: { ...manualArchive, sourceCaptureDate: "2026-12-01" } }).ready, false));
check("Manual PMS requires batch receipt matching source version", () => assert.equal(manual({ accountSnapshots: [{ accountCode: "PMS-01", manualBulkImportId: "other-batch" }] }).ready, false));

check("SIP cancellation remains excluded from unified cash ledger", () => {
  const ledger = buildMonthlyReportingLedger({ investorId: "inv1", ledger: { transactions: [txn({ transactionStatus: "failed" }), txn({ transactionDate: "2026-10-20", transactionStatus: "confirmed" })] }, startDate: "2026-10-01", cutoffDate: october });
  assert.equal(ledger.length, 1);
});
const identicalSource = {
  valuationDate: "2026-10-30", summary: { currentValue: 95000, totalInvested: 90000, holdingCount: 1 }
};
const identicalHolding = {
  ...mf, totalUnits: 2000, currentNav: 47.5, currentValue: 95000, totalInvested: 90000, monthlySip: 5000
};
check("Daily Fundbazaar files with different fingerprints but identical holding facts are equivalent", () => {
  assert.equal(equivalentFundbazaarDatedArchives(
    { ...identicalSource, sourceFileFingerprint: "file-morning" },
    { ...identicalSource, sourceFileFingerprint: "file-afternoon" },
    [identicalHolding], [{ ...identicalHolding, id: "another-archived-document" }]
  ), true);
});
check("Same total but different underlying units is a real Fundbazaar source conflict", () => {
  assert.equal(equivalentFundbazaarDatedArchives(identicalSource, identicalSource,
    [identicalHolding], [{ ...identicalHolding, totalUnits: 1000, currentNav: 95 }]), false);
});
check("Same total but different scheme identity is a real source conflict", () => {
  assert.equal(equivalentFundbazaarDatedArchives(identicalSource, identicalSource,
    [identicalHolding], [{ ...identicalHolding, isin: "INF111111111" }]), false);
});
check("Different cost basis must not be ignored when same NAV day totals match", () => {
  assert.equal(equivalentFundbazaarDatedArchives(identicalSource, identicalSource,
    [identicalHolding], [{ ...identicalHolding, totalInvested: 89000 }]), false);
});
check("Automatic approval compares same-date archived holdings rather than only file fingerprints", () => {
  const src = readFileSync(new URL("../../src/app/api/portfolio/valuation-history/approve-month-end/route.js", import.meta.url), "utf8");
  assert.match(src, /equivalentFundbazaarDatedArchives/);
  assert.match(src, /different scheme\/folio units, values or cost basis/);
});
check("Approval route includes both sources and an atomic original-source recheck", () => {
  const src = readFileSync(new URL("../../src/app/api/portfolio/valuation-history/approve-month-end/route.js", import.meta.url), "utf8");
  assert.match(src, /assessManualPmsMonthlyArchive/);
  assert.match(src, /sourceDatedValuationIds/);
  assert.match(src, /historical_source_changed|manual_historical_source_changed/);
  assert.match(src, /runTransaction/);
});
check("Eligibility and all-investor audits use the same dated source-integrity rules", () => {
  const route = readFileSync(new URL("../../src/app/api/portfolio/report-source/route.js", import.meta.url), "utf8");
  const publish = readFileSync(new URL("../../src/lib/server/reportPortfolioReconciliation.js", import.meta.url), "utf8");
  const scan = readFileSync(new URL("../../src/app/api/portfolio/system-integrity/route.js", import.meta.url), "utf8");
  for (const source of [route, publish, scan]) assert.match(source, /inspectFrozenSourceSet|inspectStoredMonthlySourceCoverage/);
});
console.log(`\n${passed} unified market calendar and multi-source monthly close checks passed.`);
