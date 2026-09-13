# GrowVest v0.34.12 - Report Asset Allocation Chart Hotfix

## Issue observed

The Premium Monthly Wealth Review sample showed the Asset Allocation section with the total portfolio value, legend and allocation table, but the circular allocation graphic itself was blank.

The underlying allocation data was present. This was a presentation/rendering defect.

## Root cause

The browser report donut used a CSS `conic-gradient`. Although this works reliably in normal browser UI, print/PDF rendering engines can omit or inconsistently rasterise CSS conic-gradient backgrounds. The result can be a blank white circle area even though the legend and values still render.

## Fix

### Browser / A4 Preview

`src/components/reports/ReportDonutChart.js`

- Replaced the CSS conic-gradient ring with an inline SVG ring built from explicit stroked circle segments.
- Normalises small percentage rounding differences so the ring always closes cleanly.
- Keeps the existing asset-class colours, legend values and total portfolio value.
- Retains print-mode sizing and the existing template `chartStyle` behaviour.
- Uses normal DOM text for the centre value in the live React component, avoiding SVG text/font differences in browsers.

### Allocation page

`src/components/reports/MonthlyReportPrintDocument.js`

- The Portfolio Allocation page now explicitly includes the Asset Allocation donut before the Current vs Target comparison.
- If `report.holdings` is unavailable, the chart safely falls back to `report.allocation` using `currentPercentage` and `currentValue`.
- Detailed allocation tables remain unchanged.

### Secure server PDF

`src/lib/server/reportPdf.js`

- Added a native PDF asset-allocation ring for the secure PDF renderer using `pdf-lib` vector drawing primitives rather than browser CSS.
- The secure Portfolio Allocation summary now shows:
  - Asset Allocation ring
  - total portfolio value
  - colour legend
  - current values
  - allocation percentages
  - Current vs Target comparison
  - existing portfolio-health observation
- Uses existing GrowVest asset-class colours.

Secure PDF renderer version is now `2.2.1`.

## Data and workflow impact

No changes were made to:

- Portfolio Master calculations
- allocation percentages or source data
- report hydration
- completion rules
- Generate / Regenerate PDF workflow
- report version history
- publication rules
- Investor permissions
- document storage paths
- report delivery rules

This is a report-rendering hotfix only.

## UAT

1. Open a Monthly Report with at least two asset classes.
2. Open **Preview PDF**.
3. Confirm the Asset Allocation ring is visible and the colours match the legend.
4. Confirm the total portfolio value appears in the centre.
5. Confirm allocation percentages in the legend match the Allocation Details table.
6. Generate / Regenerate the secure PDF.
7. Download the secure PDF and verify that the Asset Allocation visual is visible there as well.
8. Test a report whose allocation percentages sum to 99.9% or 100.1%; the visual should still form a complete ring without changing displayed source percentages.
9. Publish only after Preview and secure PDF agree.
