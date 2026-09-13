# v0.34.15 Code Manifest

Changed files:

- `src/lib/constants/reportTemplates.js` - visual lock constants/helpers.
- `src/lib/constants/report.js` - new reports carry the locked visual version.
- `src/components/reports/ReportForm.js` - migrate new/unpublished reports to Signature, constrain template selection, and self-heal stale/migrated report edit URLs.
- `src/components/reports/create/ReportTemplateSelectionStep.js` - launch visual lock notice.
- `src/components/reports/MonthlyReportPrintDocument.js` - browser render dispatch uses visual lock helper.
- `src/components/pdf/PdfDocumentShell.js` - Signature pages always get Signature chrome/theme.
- `src/components/reports/GrowVestSignatureReportDocument.js` - exact palette and packaged assets are locked; cover artwork is rendered proportionally without full-page stretching.
- `src/lib/server/reportPdf.js` - secure PDF uses same visual lock and packaged assets, including proportional cover-image rendering.
- `src/services/reportService.js` - persists visual design version and resolves migrated/legacy report IDs before returning not-found.
- `src/lib/server/reportServer.js` - renderer version `2.4.3`.
- `package.json`, `package-lock.json`, `public/sw.js` - release metadata/cache refresh.
