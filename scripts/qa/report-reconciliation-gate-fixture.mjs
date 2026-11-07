import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { comparePortfolioSnapshots, latestVerifiedPortfolioSnapshot } from "../../src/lib/portfolioSnapshotSelection.js";

const snapshots = [
  {
    id: "investor_2026-10-31",
    investorId: "investor",
    snapshotDate: "2026-10-31",
    snapshotVersion: 1,
    verificationStatus: "verified",
    updatedAt: "2026-11-01T08:00:00.000Z",
    summary: { currentValue: 47954 }
  },
  {
    id: "investor_2026-10-31",
    investorId: "investor",
    snapshotDate: "2026-10-31",
    snapshotVersion: 2,
    verificationStatus: "verified",
    updatedAt: "2026-11-03T09:00:00.000Z",
    summary: { currentValue: 95801 }
  }
];

assert(comparePortfolioSnapshots(snapshots[1], snapshots[0]) > 0);
assert.equal(latestVerifiedPortfolioSnapshot(snapshots)?.snapshotVersion, 2);
assert.equal(latestVerifiedPortfolioSnapshot(snapshots)?.summary?.currentValue, 95801);

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const reportForm = read("src/components/reports/ReportForm.js");
const gate = read("src/lib/server/reportPortfolioReconciliation.js");
const pdfRoute = read("src/app/api/reports/[reportId]/generate-pdf/route.js");
const publishRoute = read("src/app/api/reports/[reportId]/publish/route.js");

assert(reportForm.includes("financialSummaryDiffers"));
assert(reportForm.includes("Refresh Financial Data"));
assert(reportForm.includes("getPortfolioReportSource(form.investorId, asOfDate, profile)"));
assert(reportForm.includes("reopened the report for financial review"));
assert(gate.includes("source_snapshot_revision_advanced"));
assert(gate.includes("newer_month_end_snapshot_available"));
assert(pdfRoute.includes("assertReportPortfolioCurrent(report"));
assert(publishRoute.includes("assertReportPortfolioCurrent(report"));

console.log("Monthly Review reconciliation gate fixture passed");
console.log(JSON.stringify({
  scenario: "Completed October review used revision 1 (~47,954); Portfolio Master later rebuilt 31 Oct as revision 2 (~95,801)",
  expected: "Internal report reopens for review; stale PDF and Publish are blocked until refreshed and completed again"
}, null, 2));
