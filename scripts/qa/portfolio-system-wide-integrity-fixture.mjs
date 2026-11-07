import assert from "node:assert/strict";
import fs from "node:fs";
import { assessInvestorMonthEnd, portfolioMonthCutoff } from "../../src/lib/portfolioSystemWideAudit.js";

const monthKey = "2026-10";
assert.equal(portfolioMonthCutoff(monthKey), "2026-10-31");
assert.throws(() => portfolioMonthCutoff("2026-13"), /valid reporting month/);

const olderSnapshot = { id: "oct_early", snapshotDate: "2026-10-05", verificationStatus: "verified", summary: { currentValue: 47954.24, positionCount: 10 } };
const laterSnapshot = { id: "nov", snapshotDate: "2026-11-04", verificationStatus: "verified", summary: { currentValue: 99478.48, positionCount: 10 } };
const datedArchive = { id: "oct_hist", status: "available", valuationDate: "2026-10-29", verificationStatus: "pending_review", summary: { currentValue: 96543.64 } };
const covered = { count: 10, newMoney: 50001, withdrawals: 0, latestDate: "2026-10-19" };

const flagged = assessInvestorMonthEnd({ monthKey, snapshots: [olderSnapshot, laterSnapshot], valuations: [datedArchive], uncoveredCashFlows: covered });
assert.equal(flagged.status, "blocked");
assert.equal(flagged.code, "cash_flow_after_snapshot");
assert.equal(flagged.snapshotValue, 47954.24);
assert.equal(flagged.archivedValuationValue, 96543.64);
assert.equal(flagged.uncoveredCashFlows.newMoney, 50001);

const missing = assessInvestorMonthEnd({ monthKey, snapshots: [laterSnapshot], valuations: [datedArchive] });
assert.equal(missing.code, "verified_month_end_missing");
assert.match(missing.message, /not a verified complete/);
const review = assessInvestorMonthEnd({ monthKey, snapshots: [olderSnapshot], valuations: [datedArchive], uncoveredCashFlows: { count: 0 } });
assert.equal(review.status, "review");
assert.equal(review.code, "historical_valuation_not_promoted");

const exact = { id: "monthend", verificationStatus: "verified", snapshotDate: "2026-10-31", snapshotVersion: 2, summary: { currentValue: 96543.64, positionCount: 1 } };
const good = assessInvestorMonthEnd({ monthKey, snapshots: [exact], snapshotPositions: [{ navDate: "2026-10-31", currentValue: 96543.64, source: "fundbazaar" }], uncoveredCashFlows: { count: 0 } });
assert.equal(good.status, "ready");
assert.equal(good.code, "verified_complete_snapshot");
const tooLate = assessInvestorMonthEnd({ monthKey, snapshots: [exact], snapshotPositions: [{ navDate: "2026-11-04", currentValue: 96543.64 }], uncoveredCashFlows: { count: 0 } });
assert.equal(tooLate.code, "post_cutoff_valuations");
assert.equal(tooLate.status, "blocked");
const earlier = assessInvestorMonthEnd({ monthKey, snapshots: [exact], snapshotPositions: [{ navDate: "2026-10-29" }], uncoveredCashFlows: { count: 0 } });
assert.equal(earlier.code, "earlier_source_nav_dates");
assert.equal(earlier.status, "review");
const empty = assessInvestorMonthEnd({ monthKey, snapshots: [exact], snapshotPositions: [], uncoveredCashFlows: { count: 0 } });
assert.equal(empty.code, "snapshot_positions_missing");
const undated = assessInvestorMonthEnd({ monthKey, snapshots: [exact], snapshotPositions: [{ source: "manual" }], uncoveredCashFlows: { count: 0 } });
assert.equal(undated.code, "position_value_dates_missing");

const backfill = fs.readFileSync(new URL("../../src/app/api/portfolio/valuation-history/backfill/route.js", import.meta.url), "utf8");
const component = fs.readFileSync(new URL("../../src/components/portfolio/PortfolioSystemIntegrityPanel.js", import.meta.url), "utf8");
assert.match(backfill, /verifyStaffRequest/);
assert.match(backfill, /\["admin", "super_admin"\]/);
assert.match(backfill, /archiveImportedFundbazaarValuation/);
assert.match(backfill, /ARCHIVE HISTORY ONLY/);
assert.doesNotMatch(backfill, /createPortfolioSnapshot|portfolioPositions.+\.set\(/);
assert.match(component, /Scan all investors/);
assert.match(component, /Archive past valuations/);
console.log("System-wide monthly integrity: 18 conservative assessment, security and UI checks passed.");
