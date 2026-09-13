# GrowVest v0.34.11 - Report PDF Design Code Manifest

## Core report presentation

- `src/components/reports/MonthlyReportPrintDocument.js`
  - premium A4 composition
  - cover style/pattern classes
  - resolved report theme
  - print-safe chart props
  - content-aware table widths

- `src/components/reports/ReportTrendChart.js`
  - template primary colour
  - chart-style variants
  - compact print mode
  - optional analytical grid/value treatment

- `src/components/reports/ReportDonutChart.js`
  - dedicated A4 print layout
  - reduced print footprint
  - retained asset-colour semantics

- `src/components/reports/MonthlyWealthReport.js`
  - interactive chart colour/style aligned to the applied report template

- `src/components/pdf/PdfDocumentShell.js`
  - report appearance classes for heading/header/footer/table/chart variants

- `src/app/globals.css`
  - premium A4 statement system
  - editorial cover variants
  - actual cover patterns
  - section-title/KPI/card hierarchy
  - print table styling and table-density modes
  - print chart sizing

## Secure PDF renderer

- `src/lib/server/reportPdf.js`
  - premium cover composition
  - cover style and pattern primitives
  - refined section hierarchy and metrics
  - template-primary performance chart
  - chart-style variants
  - lighter table treatment
  - disclaimer-style pagination/density
  - retained General Wealth Corpus no-goals logic

- `src/lib/server/reportServer.js`
  - secure PDF renderer version `2.2.0`

## Release / PWA metadata

- `package.json` / `package-lock.json`
  - application version `0.34.11`

- `public/sw.js`
  - Investor PWA cache `v0.34.11-report-design1`

- `scripts/qa/release-audit.mjs`
  - current version/cache expectations
  - v0.34.11 report-renderer parity assertions

- `README.md`
  - v0.34.11 release notes

## Documentation

- `docs/REPORT_MODULE_REVIEW_AND_PDF_DESIGN_v0.34.11.md`
- `docs/REPORT_PDF_DESIGN_CODE_MANIFEST_v0.34.11.md`
- `RELEASE_VALIDATION_v0.34.11.md`

## Explicit non-scope

No report financial calculations, Portfolio Master logic, report permission rules, publication rules, history behavior, storage path logic, or Investor delivery permissions are intentionally changed by this release.
