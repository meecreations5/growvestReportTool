import assert from "node:assert/strict";
import fs from "node:fs";
import {
  inspectFrozenSourceSet
} from "../../src/lib/portfolioMonthlyIntegrity.js";
import {
  isExpectedMonthlySourceError,
  isMonthlyCloseRecoveryCandidate,
  loadMonthlyReportSourceWithRecovery
} from "../../src/lib/portfolioMonthlySourceRecovery.js";

let passed = 0;
async function check(label, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${label}`);
}
const oct = { investorId: "staging-jc", monthKey: "2026-10", reportType: "monthly" };
const oldSnapshot = { id: "old_2026_10_05", snapshotDate: "2026-10-05", verificationStatus: "verified" };
const originalPositions = [{ positionId: "p1", source: "fundbazaar", navDate: "2026-10-05", currentValue: 50000 }];
const archive = { id: "fbv_oct31", source: "fundbazaar", status: "available", valuationDate: "2026-10-31", summary: { currentValue: 95801, totalInvested: 100002, holdingCount: 10 } };
const err = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });

await check("old October 5 snapshot is blocked by real October 31 Fundbazaar archive", () => {
  const result = inspectFrozenSourceSet({ snapshot: oldSnapshot, positions: originalPositions, archives: [archive], cutoffDate: "2026-10-31" });
  assert.equal(result.ready, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, "newer_source");
  assert.equal(result.issues[0].archiveId, archive.id);
  assert.equal(result.issues[0].valuationDate, "2026-10-31");
});

await check("expected 409 financial coverage is not a Next.js exception", () => {
  const coverage = err("portfolio_source_coverage_incomplete", "Newer original October archive exists");
  assert.equal(isExpectedMonthlySourceError(coverage), true);
  assert.equal(isMonthlyCloseRecoveryCandidate({ ...oct, error: coverage }), true);
});

await check("every known financial coverage and recovery error stays in the report UI", () => {
  for (const code of [
    "portfolio_closing_snapshot_missing_cash_flow", "portfolio_historical_snapshot_outdated",
    "portfolio_monthly_invalid_source_dates", "post_cutoff_capture_not_approved",
    "portfolio_source_coverage_incomplete", "monthly_close_requires_review", "monthly_close_previous_approval_stale",
    "monthly_close_official_nav_unavailable", "historical_source_invalid"
  ]) assert.equal(isExpectedMonthlySourceError(err(code, "blocked")), true, code);
  assert.equal(isExpectedMonthlySourceError(err("monthly_close_forbidden", "Administrator required", 403)), true);
});

await check("unexpected permission, HTTP 500 and unrelated failures still log normally", () => {
  assert.equal(isExpectedMonthlySourceError(err("portfolio_access_denied", "Access denied", 403)), false);
  assert.equal(isExpectedMonthlySourceError(err("portfolio_source_coverage_incomplete", "Database down", 500)), false);
  assert.equal(isExpectedMonthlySourceError(err("network_timeout", "Network unavailable", 500)), false);
});

await check("complete October archive can be approved once and selected instead of October 5", async () => {
  let reads = 0, closes = 0;
  const upgraded = { snapshot: { id: "approved_oct31", snapshotDate: "2026-10-31", verificationStatus: "verified", reportSnapshotMode: "approved_historical_source", sourceValuationDates: { fundbazaar: "2026-10-31" } }, positions: [{ source: "fundbazaar", navDate: "2026-10-31" }] };
  const result = await loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { reads += 1; if (reads === 1) throw err("portfolio_source_coverage_incomplete", "Newer source"); return upgraded; },
    closeMonth: async () => { closes += 1; return { approved: true, snapshotId: "approved_oct31", valuationDate: "2026-10-31" }; }
  });
  assert.equal(result.autoClosed, true);
  assert.equal(result.source.snapshot.id, "approved_oct31");
  assert.equal(reads, 2);
  assert.equal(closes, 1);
  const coverage = inspectFrozenSourceSet({ snapshot: result.source.snapshot, positions: result.source.positions, archives: [archive], cutoffDate: "2026-10-31" });
  assert.equal(coverage.ready, true);
});

await check("a blocked October approval reports its real eligibility reason, not a false success", async () => {
  let closes = 0;
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { throw err("portfolio_source_coverage_incomplete", "Newer source exists"); },
    closeMonth: async () => { closes += 1; throw err("monthly_close_requires_review", "Fundbazaar original source transaction ledger is incomplete"); }
  }), (error) => error.code === "monthly_close_requires_review" && /transaction ledger is incomplete/.test(error.message));
  assert.equal(closes, 1);
});

await check("recovery cannot replace old Oct 5 with a newer snapshot that was not actually selected", async () => {
  let reads = 0;
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => (++reads === 1 ? Promise.reject(err("portfolio_source_coverage_incomplete", "Newer source")) : ({ snapshot: oldSnapshot })),
    closeMonth: async () => ({ approved: true, snapshotId: "approved_oct31", valuationDate: "2026-10-31" })
  }), (error) => error.code === "monthly_close_snapshot_not_selected");
});

await check("voided and post-cutoff archives cannot displace an October snapshot", () => {
  const invalidArchives = [
    { ...archive, status: "voided" },
    { ...archive, id: "nov", valuationDate: "2026-11-01" }
  ];
  const assessment = inspectFrozenSourceSet({ snapshot: oldSnapshot, positions: originalPositions, archives: invalidArchives, cutoffDate: "2026-10-31" });
  assert.equal(assessment.ready, true);
});

await check("the ReportForm uses unified validation classification, not legacy incomplete list", () => {
  const ui = fs.readFileSync("src/components/reports/ReportForm.js", "utf8");
  const server = fs.readFileSync("src/app/api/portfolio/report-source/route.js", "utf8");
  const service = fs.readFileSync("src/services/portfolioService.js", "utf8");
  const approval = fs.readFileSync("src/app/api/portfolio/valuation-history/approve-month-end/route.js", "utf8");
  assert.ok(approval.includes("if (status >= 500) console.error"));
  assert.ok(ui.includes("const financialCoveragePending = isExpectedMonthlySourceError(nextError);"));
  assert.ok(ui.includes("Check reporting eligibility"));
  assert.ok(server.includes('"portfolio_source_coverage_incomplete"'));
  assert.ok(server.includes("selectedSnapshot: { id: snapshot.id"));
  assert.ok(server.includes("sourceIssues: sourceSet.issues.map"));
  assert.ok(service.includes("error.details = payload.details"));
});

console.log(`\n${passed} focused October source coverage / UI recovery checks passed.`);
