# GrowVest v0.34.12 - Report Asset Allocation Chart Code Manifest

## Modified files

### `src/components/reports/ReportDonutChart.js`

- Replaced CSS `conic-gradient` allocation ring with inline SVG circle segments.
- Added percentage normalisation for visual closure only.
- Preserved original displayed percentages and asset-class colour mapping.

### `src/components/reports/MonthlyReportPrintDocument.js`

- Added `allocationChartHoldings` fallback mapping.
- Portfolio Allocation summary now renders the Asset Allocation chart explicitly.
- Current-vs-target comparison remains in the allocation summary.
- Detailed allocation table remains unchanged.

### `src/lib/server/reportPdf.js`

- Imports `holdingColor` for secure PDF allocation colours.
- Adds `drawAllocationDonut(...)` using native PDF vector primitives.
- Reworks the Portfolio Allocation summary to include the donut, legend and current-vs-target comparison.

### `src/lib/server/reportServer.js`

- Secure PDF renderer version: `2.2.1`.

### Release metadata

- `package.json` -> `0.34.12`
- `package-lock.json` -> `0.34.12`
- `public/sw.js` -> `v0.34.12-report-asset1`
- `scripts/qa/release-audit.mjs` -> current metadata/cache checks and v0.34.12 renderer assertions
- `README.md` -> v0.34.12 release note
- `RELEASE_VALIDATION_v0.34.12.md`

## Intentionally unchanged

- report data schema
- Portfolio Master math
- report generation lifecycle
- report publication/history lifecycle
- Investor report access
- Firebase rules
- storage paths
- report templates and section visibility rules
