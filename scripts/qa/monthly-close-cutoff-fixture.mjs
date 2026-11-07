import assert from "node:assert/strict";
import fs from "node:fs";
import { monthlyReportingWindow, transactionBelongsToMonth, inspectPostCutoffCapture, inspectMonthEndValuationDates, lastWeekdayOnOrBefore } from "../../src/lib/portfolioMonthlyClose.js";
import { assessInvestorMonthEnd } from "../../src/lib/portfolioSystemWideAudit.js";

let assertions = 0;
function check(label, condition) { assert.ok(condition, label); assertions += 1; }
const october = monthlyReportingWindow("2026-10");
check("October starts 1 October", october.startDate === "2026-10-01");
check("October closes 31 October, not upload date", october.cutoffDate === "2026-10-31");
check("November 1 starts reporting window", october.generationOpens === "2026-11-01");
check("November 7 is the target report window end", october.generationTargetEnd === "2026-11-07");
check("October 1 contribution is in October", transactionBelongsToMonth({ transactionDate: "2026-10-01" }, "2026-10"));
check("October 31 effective transaction remains October", transactionBelongsToMonth({ transactionDate: "2026-10-31" }, "2026-10"));
check("November 1 SIP is never October", !transactionBelongsToMonth({ transactionDate: "2026-11-01" }, "2026-10"));
check("November 4 withdrawal is never October", !transactionBelongsToMonth({ transactionDate: "2026-11-04" }, "2026-10"));
check("November investor-action confirmed date is excluded", !transactionBelongsToMonth({ actualFinancialDate: "2026-11-01" }, "2026-10"));
check("Actual effective date takes priority over an earlier order date", !transactionBelongsToMonth({ transactionDate: "2026-10-31", actualFinancialDate: "2026-11-01" }, "2026-10"));
check("invalid month rejected", (() => { try { monthlyReportingWindow("2026-13"); return false; } catch { return true; } })());
check("October 30 is the last regular weekday for Saturday Oct 31", lastWeekdayOnOrBefore("2026-10-31") === "2026-10-30");

const frozen = { id: "capture_nov2", verificationStatus: "verified", snapshotDate: "2026-11-02", summary: { currentValue: 110000, positionCount: 1 } };
const oldNav = [{ source: "fundbazaar", navDate: "2026-10-30", currentValue: 110000 }];
const confirmed = inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate });
check("postcutoff capture allowed for historical review", confirmed.eligible && confirmed.requiresStaffApproval);
check("source financial effective date remains Oct 30", confirmed.effectiveDate === "2026-10-30");
check("postcutoff capture retains actual November capture date", confirmed.capturedDate === "2026-11-02");
check("November SIP makes postcutoff snapshot unsafe", !inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate, postCutoffActivity: [{ transactionDate: "2026-11-01", transactionType: "SIP" }] }).eligible);
check("internal November switch also makes capture unsafe", !inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate, postCutoffActivity: [{ transactionDate: "2026-11-02", transactionType: "Switch in" }] }).eligible);
check("November PMS fee invalidates captured October cash value", !inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate, postCutoffActivity: [{ chargeDate: "2026-11-01", amount: 300 }] }).eligible);
check("November SIP stop instruction does not invalidate otherwise frozen October capture", inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate, postCutoffActivity: [{ transactionDate: "2026-11-02", transactionType: "SIP Stopped", amount: 5000, financialImpactStatus: "confirmed" }] }).eligible);
check("pending November order is not assumed financially effective", inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate, postCutoffActivity: [{ actualFinancialDate: "2026-11-01", financialImpactStatus: "pending" }] }).eligible);
check("an October purchase does not automatically disqualify a November capture", inspectPostCutoffCapture({ snapshot: frozen, positions: oldNav, cutoffDate: october.cutoffDate, postCutoffActivity: [{ transactionDate: "2026-10-25", transactionType: "SIP" }] }).eligible);
check("post-cutoff Nov NAV never masquerades as October", !inspectPostCutoffCapture({ snapshot: frozen, positions: [{ navDate: "2026-11-02", currentValue: 110000 }], cutoffDate: october.cutoffDate }).eligible);
check("undated manual holding not considered verified October", !inspectPostCutoffCapture({ snapshot: frozen, positions: [{ source: "manual", currentValue: 110000 }], cutoffDate: october.cutoffDate }).eligible);
check("holding/snapshot summary mismatch rejects captured history", !inspectPostCutoffCapture({ snapshot: frozen, positions: [{ navDate: "2026-10-30", currentValue: 9999 }], cutoffDate: october.cutoffDate }).eligible);

const unchanging = assessInvestorMonthEnd({ monthKey: "2026-10", snapshots: [{ id: "lastday", verificationStatus: "verified", snapshotDate: "2026-10-30", summary: { positionCount: 1, currentValue: 100000 } }], snapshotPositions: [{ navDate: "2026-10-30", currentValue: 100000, source: "fundbazaar" }] });
check("unchanged October 30 NAV can be ready for Oct 31 Saturday cutoff", unchanging.status === "ready");
const stale = inspectMonthEndValuationDates([{ source: "manual", valuationDate: "2026-10-15", manualImportDate: "2026-10-30" }], "2026-10-31");
check("manual NAV dated Oct 15 remains distinct from Oct 30 import", stale.rows[0].valuationDate === "2026-10-15" && stale.rows[0].confirmationDate === "2026-10-30");
check("manual 16-day NAV gap gets staff attention", stale.stale === 1);
const zeroChangeLastNav = assessInvestorMonthEnd({ monthKey: "2026-10", snapshots: [{ id: "manualclose", verificationStatus: "verified", snapshotDate: "2026-10-31", summary: { positionCount: 1, currentValue: 100000 } }], snapshotPositions: [{ source: "manual", valuationDate: "2026-10-15", manualImportDate: "2026-10-30", currentValue: 100000 }] });
check("last-known old NAV requires review, not invented zero performance", zeroChangeLastNav.status === "review" && zeroChangeLastNav.code === "old_nav_requires_source_confirmation");
const reviewedCapture = assessInvestorMonthEnd({ monthKey: "2026-10", snapshots: [frozen], closingOverride: { ...frozen, snapshotDate: "2026-10-30", capturedSnapshotDate: "2026-11-02", reportSnapshotMode: "post_cutoff_capture" }, snapshotPositions: oldNav });
check("scanner labels November capture review instead of auto publication", reviewedCapture.code === "eligible_post_cutoff_capture_review");
const laterImport = inspectPostCutoffCapture({ snapshot: { ...frozen, snapshotDate: "2026-11-09" }, positions: oldNav, cutoffDate: october.cutoffDate });
check("capture after 7th November cannot be auto selected", !laterImport.eligible);

const file = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
check("report source validates calendar month cutoff", /invalid_monthly_cutoff/.test(file("../../src/app/api/portfolio/report-source/route.js")));
check("pdf completion revalidates later captures", /post_cutoff_capture_invalid/.test(file("../../src/lib/server/reportPortfolioReconciliation.js")));
check("manual importer archives before Replace deletes", /await archiveManualLedgerBeforeReplace/.test(file("../../src/lib/server/manualPortfolioWorkbook.js")));
check("manual importer stores dated immutable history", /await archiveManualPortfolioValuation/.test(file("../../src/lib/server/manualPortfolioWorkbook.js")));
check("manual importer does not invent NAV date from upload", !/valuationDate: excelDate\(cell\(row, columns, "valuationDate"\)\) \|\| indiaDateKey\(\)/.test(file("../../src/lib/server/manualPortfolioWorkbook.js")));
check("report reads historical PMS cash/transactions", /loadInvestorPortfolioLedger/.test(file("../../src/app/api/portfolio/report-source/route.js")));
check("monthly statements close on calendar day while preserving source valuation dates", /statementDate: reportType === REPORT_TYPE.OPENING \? \(snapshot.snapshotDate \|\| base.statementDate\) : reportAsOfDate/.test(file("../../src/lib/constants/report.js")));
check("unapproved next-month capture cannot be used by the report", /post_cutoff_capture_not_approved/.test(file("../../src/app/api/portfolio/report-source/route.js")));
check("pdf and publish recheck late-October investment movements", /post_cutoff_capture_late_october_movements/.test(file("../../src/lib/server/reportPortfolioReconciliation.js")));
check("administrator capture approval endpoint exists with explicit acknowledgement", /APPROVE VERIFIED MONTH END CAPTURE/.test(file("../../src/app/api/portfolio/month-end-capture-approval/route.js")));
check("administrator approval ties to frozen positions by fingerprint", /sourceSnapshotFingerprint === fingerprint/.test(file("../../src/lib/server/portfolioMonthEndCaptureApproval.js")));
check("complete portfolio reset includes manual ledger archive", /investorRows\("manualPortfolioLedgerHistory"/.test(file("../../src/lib/server/portfolioReset.js")));
check("complete portfolio reset includes monthend approvals", /investorRows\("portfolioMonthEndCaptureApprovals"/.test(file("../../src/lib/server/portfolioReset.js")));
check("manual income and charges are retained before replace", /"manualPortfolioIncome", "manualPortfolioCharges"/.test(file("../../src/lib/server/portfolioHistoricalManualLedger.js")));
check("scanner and report share same selector", /resolveMonthEndSnapshot/.test(file("../../src/app/api/portfolio/system-integrity/route.js")));

console.log(`GrowVest month-end cutoffs, unchanged NAV, post-cutoff safety and PMS history: ${assertions} checks passed.`);
