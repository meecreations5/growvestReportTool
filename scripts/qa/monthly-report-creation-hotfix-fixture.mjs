import assert from "node:assert/strict";
import fs from "node:fs";
import { selectVerifiedReportSnapshot } from "../../src/lib/portfolioSnapshotSelection.js";

const verified = (id, date) => ({ id, snapshotDate: date, verificationStatus: "verified" });
const source = [verified("oct", "2026-10-31"), verified("nov", "2026-11-04"), { ...verified("invalid", "2026-11-05"), verificationStatus: "pending" }];
const options = { todayDate: "2026-11-05" };

assert.equal(selectVerifiedReportSnapshot(source, "2026-10-31", { ...options, reportType: "monthly" })?.id, "oct", "Monthly must not use a later snapshot");
assert.equal(selectVerifiedReportSnapshot(source, "2026-10-31", { ...options, reportType: "opening" })?.id, "oct", "Opening respects an available previous-month snapshot");
assert.equal(selectVerifiedReportSnapshot(source.slice(1), "2026-10-31", { ...options, reportType: "monthly" }), null, "Monthly cannot silently move cutoff forward");
assert.equal(selectVerifiedReportSnapshot(source.slice(1), "2026-10-31", { ...options, reportType: "opening" })?.id, "nov", "Opening may use verified launch baseline after prior-month cutoff");
assert.equal(selectVerifiedReportSnapshot(source.slice(1), "2026-10-31", { reportType: "opening", todayDate: "2026-11-01" }), null, "Do not use future snapshots");

const read = (file) => fs.readFileSync(file, "utf8");
const form = read("src/components/reports/ReportForm.js");
const reportSource = read("src/app/api/portfolio/report-source/route.js");
const portfolioService = read("src/services/portfolioService.js");
const schema = read("src/lib/validation/reportSchema.js");
const gate = read("src/lib/server/reportPortfolioReconciliation.js");
const reconciliationClient = read("src/services/reportReconciliationService.js");
const reconciliationApi = read("src/app/api/reports/reconcile-portfolio/route.js");

assert.match(form, /form\.reportYear, form\.reportType, form\.statementDate/, "report type must invalidate the source request");
assert.match(form, /const portfolioSourceKey = `\$\{form\.reportType/, "snapshot refresh key must include type");
assert.match(form, /getPortfolioReportSource\(form\.investorId, asOfDate, profile, \{ reportType: form\.reportType \}\)/, "portfolio fetch must supply the report type");
assert.match(portfolioService, /params\.set\("reportType", "opening"\)/, "service must forward opening type");
assert.match(reportSource, /!snapshot && reportType === "opening"/, "opening-only fallback must be conditional");
assert.match(reportSource, /safeDateKey\(snapshot\.snapshotDate\) > asOfDate/, "opening fallback must use actual snapshot effective date");
assert.match(schema, /export function isVerifiedZeroClosingPortfolio/, "zero-closing evidence must have one shared validator");
assert.match(form, /isVerifiedZeroClosingPortfolio\(form\)/, "workflow must allow verified fully-exited month");
assert.match(schema, /isVerifiedZeroClosingPortfolio\(payload\)/, "completion must share the same fully-exited rule");
assert.match(form, /portfolioSourceLoading \|\| !canSaveDraft/, "autosave must wait for portfolio hydration");

assert.match(gate, /source_snapshot_investor_mismatch/, "snapshot must belong to report investor");
assert.match(gate, /financial_summary_mismatch/, "source valuation must match report closing value");
assert.match(reconciliationClient, /summary: \{ totalCorpus:/, "client completion sends closing valuation");
assert.match(reconciliationApi, /summary: body.summary/, "API relays closing valuation to reconciliation gate");
console.log("PASS 19 Monthly Review creation and reconciliation hotfix checks");
