# v0.34.27 Code Manifest — Manual PMS Report Freshness

- `src/lib/server/portfolioFreshness.js`
  - shared source-freshness date rules
  - Manual PMS import-date recovery from `manualBulkImportId`
  - source freshness aggregation and age/status calculation
- `src/lib/server/portfolioIntelligence.js`
  - uses the shared freshness model so Manual PMS does not depend on per-holding valuation dates
- `src/lib/server/portfolioServer.js`
  - snapshots preserve Manual freshness metadata for future reports
- `src/lib/server/manualPortfolioWorkbook.js`
  - writes `manualImportDate`, `manualSourceRefreshDate` and `freshnessDateBasis` on Manual PMS imports
- `src/app/api/portfolio/report-source/route.js`
  - legacy snapshot overlay from live Manual metadata / Manual account snapshots
  - dynamically rebuilds source-freshness reconciliation issues without changing financial values
- `scripts/qa/manual-pms-freshness-fixture.mjs`
  - validates blank/old holding valuation dates, legacy batch recovery, genuine stale imports and provider-source behaviour
- `public/sw.js`
  - PWA cache refresh for v0.34.27
