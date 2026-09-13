# v0.34.13 Code Manifest

## Opening Wealth Review / report lifecycle

- `src/lib/constants/report.js`
  - report types, canonical IDs, display titles, central report-code/version naming
  - Opening report creation and Portfolio Master hydration
- `src/services/reportService.js`
  - automatic Opening/Monthly persistence rules
  - first-report and post-opening sequencing guard
  - standard report code generation
- `src/components/reports/ReportForm.js`
  - first-time Opening Wealth Review selection
  - Opening period locking, Portfolio Master goal/SIP hydration and launch guidance
- `src/components/reports/create/ReportingPeriodStep.js`
  - Opening baseline copy and locked snapshot period
- `src/app/api/reports/[reportId]/publish/route.js`
  - server-side first-report sequencing and reconciliation publication gate
  - padded immutable version IDs
- `src/app/api/reports/[reportId]/migrate-period/route.js`
  - blocks Opening baseline migration and preserves Monthly report code convention
- `src/app/api/reports/[reportId]/acknowledge/route.js`
  - Wealth Review Discussion naming with legacy discussion compatibility

## Goal / Bucket List reconciliation

- `src/lib/portfolioGoalAllocation.js`
  - General Wealth aliases
  - Portfolio Master-derived current corpus, Active SIP, progress and status
  - canonical goal matching
- `src/lib/reportReconciliation.js`
  - pre-publish report reconciliation checks
- `src/app/api/investor/app-data/route.js`
  - Investor App live goal reconciliation and canonical investment-goal links
- `src/components/investors/InvestorDetailClient.js`
  - staff Investor Profile uses live Portfolio Master goal/current portfolio facts
- `src/app/api/portfolio/positions/[positionId]/route.js`
  - goal allocation effective-from date and immediate verified snapshot
- `src/lib/server/portfolioServer.js`
  - carries goal allocation effective date into snapshot positions
- `src/services/portfolioService.js`
  - supports effective date on goal allocation updates

## Report presentation / investor experience

- `src/components/reports/MonthlyWealthReport.js`
- `src/components/reports/MonthlyReportPrintDocument.js`
- `src/lib/server/reportPdf.js`
- `src/components/reports/InvestorReportDetailClient.js`
- `src/components/reports/InvestorReportsPanel.js`
- `src/app/investor/reports/page.js`
- `src/lib/utils/reportPresentation.js`
  - Opening baseline presentation and Wealth Review terminology

## Naming, delivery and storage

- `src/lib/server/reportServer.js`
  - PDF filename tokens, opening/monthly storage folders, renderer `2.3.0`
- `src/lib/server/settingsServer.js`
- `src/services/settingsService.js`
- `src/components/settings/BrandingSettingsWorkspace.js`
  - default configurable filename convention
- `src/lib/constants/navigation.js`
- `src/lib/constants/permissions.js`
  - display label `Wealth Reviews` while permission key `reports` is retained
- `src/lib/server/reportDelivery.js`
  - Wealth Review delivery wording; verified Investor recipient security unchanged
- `src/lib/constants/emailTemplates.js`
  - example report-reference convention updated to `GV-MWR`

## QA / release

- `scripts/qa/report-opening-review-fixture.mjs`
  - launch fixture for INR 24,298 corpus / INR 3,000 SIP / General Wealth alias reconciliation
- `scripts/qa/release-audit.mjs`
  - v0.34.13 regression checks
- `package.json`
- `package-lock.json`
- `public/sw.js`
- `README.md`
- `RELEASE_VALIDATION_v0.34.13.md`
