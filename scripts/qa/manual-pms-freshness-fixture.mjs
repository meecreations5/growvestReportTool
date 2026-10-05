import {
  buildPortfolioSourceFreshness,
  dateKeyFromManualBulkImportId,
  manualPortfolioRefreshDate,
  portfolioPositionFreshnessDate
} from "../../src/lib/server/portfolioFreshness.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS  ${message}`);
}

const importMillis = Date.parse("2026-09-30T04:30:00Z");
const batchId = `manual_pms_${importMillis}_fixture`;
assert(dateKeyFromManualBulkImportId(batchId) === "2026-09-30", "manual PMS batch ID resolves to the India import date");

const blankValuationRecentImport = {
  source: "manual",
  manualPortfolioManaged: true,
  manualImportDate: "2026-09-30",
  valuationDate: "",
  currentValue: 500000
};
assert(manualPortfolioRefreshDate(blankValuationRecentImport) === "2026-09-30", "manual PMS explicit import date is the freshness date");
assert(portfolioPositionFreshnessDate(blankValuationRecentImport) === "2026-09-30", "blank PMS valuation date does not create a missing freshness date after import");

const legacyRecentImport = {
  source: "manual",
  manualPortfolioManaged: true,
  manualBulkImportId: batchId,
  valuationDate: "2026-08-26",
  currentValue: 750000
};
assert(manualPortfolioRefreshDate(legacyRecentImport) === "2026-09-30", "legacy PMS rows recover freshness from the import batch ID");

const recent = buildPortfolioSourceFreshness(
  [blankValuationRecentImport, legacyRecentImport],
  "2026-10-01",
  { FRESH_DAYS: 3, STALE_DAYS: 7, CRITICAL_STALE_DAYS: 31 }
)[0];
assert(recent.freshnessBasis === "manual_import", "manual PMS freshness is explicitly based on workbook import");
assert(recent.missingDateCount === 0, "recent manual PMS import has no missing source date");
assert(recent.ageDays === 1 && recent.freshnessStatus === "fresh", "recent manual PMS import remains fresh even when underlying valuation date is older or blank");

const oldImportMillis = Date.parse("2026-08-26T04:30:00Z");
const old = buildPortfolioSourceFreshness([{
  source: "manual",
  manualPortfolioManaged: true,
  manualBulkImportId: `manual_pms_${oldImportMillis}_fixture`,
  valuationDate: "",
  currentValue: 100000
}], "2026-10-01", { FRESH_DAYS: 3, STALE_DAYS: 7, CRITICAL_STALE_DAYS: 31 })[0];
assert(old.ageDays === 36 && old.freshnessStatus === "critical", "genuinely old manual PMS import still blocks after 31 days");

const provider = buildPortfolioSourceFreshness([{
  source: "fundbazaar",
  valuationDate: "2026-09-20",
  currentValue: 100000
}], "2026-10-01", { FRESH_DAYS: 3, STALE_DAYS: 7, CRITICAL_STALE_DAYS: 31 })[0];
assert(provider.ageDays === 11 && provider.freshnessStatus === "stale", "provider sources continue to use their valuation date freshness rule");

console.log("Manual PMS freshness fixture passed.");
