# v0.34.14 Changed Code Manifest

## Report design and renderer parity

- `src/components/reports/GrowVestSignatureReportDocument.js`
  - New GrowVest Signature browser/A4 report renderer.
  - Approved cover, executive summary, allocation, goals, holdings, performance, protection, GrowVest View and next-step pages.
  - Uses official GrowVest brand colors.
  - Opening Wealth Review receives a dedicated starting-position presentation.

- `src/components/reports/MonthlyReportPrintDocument.js`
  - Routes frozen `growvest-signature` template snapshots to the Signature renderer.
  - Preserves the existing renderer for legacy template snapshots.

- `src/components/pdf/PdfDocumentShell.js`
  - Signature header/footer support for browser/A4 preview.

- `src/lib/server/reportPdf.js`
  - Native secure-PDF implementation of the GrowVest Signature layout.
  - Local/public branding-image fallback for the secure renderer.
  - Signature asset-color mapping and vector allocation chart support.

- `src/lib/server/pdfDocumentShell.js`
  - Signature document chrome for secure PDFs.

- `src/app/globals.css`
  - GrowVest Signature A4 design system.
  - Official brand colors, layouts, tables, callouts, cover and report components.

- `public/brand/growvest-logo-dark.png`
  - Raster fallback used only by the native secure PDF renderer when an SVG/local logo cannot be embedded directly.

- `public/brand/growvest-wealth-review-cover.jpg`
  - Packaged lifestyle cover fallback used by both Signature renderers to match the locked launch reference.

- `docs/reference/growvest_signature_locked_reference_v0.34.14.png`
  - Approved visual reference frozen with the release for future regression review.

## Template and branding

- `src/lib/constants/reportTemplates.js`
  - Adds `growvest-signature` as the system default template.
  - Preserves historical system-template snapshots by resolving their own base template.
  - Investor-facing labels use **GrowVest View** and **Your Next Steps**.

- `src/lib/utils/reportBranding.js`
  - Default secondary brand color aligned to Electric Sky-Blue `#0CC0DF`.

## First-report workflow fix

- `src/components/reports/ReportForm.js`
  - Adds resolved-period context gating before save/autosave.
  - Prevents the first-report Opening/Monthly resolver race.
  - Does not mark Opening detection complete until the selected investor profile is available.

## Navigation and report workspace

- `src/lib/constants/navigation.js`
  - Restores staff navigation label to **Monthly Reports**.

- `src/components/reports/ReportsTable.js`
  - Dashboard heading is **Monthly Reports & Wealth Reviews**.
  - Explains automatic Opening Wealth Review selection.

- `src/components/reports/create/ReportWorkflowShell.js`
- `src/components/reports/ReportDetailClient.js`
  - Familiar **Back to Monthly Reports** navigation.

## Release metadata

- `package.json`
- `package-lock.json`
- `public/sw.js`
- `src/lib/server/reportServer.js`
- `scripts/qa/release-audit.mjs`
- `README.md`
- `RELEASE_VALIDATION_v0.34.14.md`
