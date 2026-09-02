# v0.33.3 Insurance & Protection - Code Manifest

## New files

- `src/lib/constants/insurance.js` - policy types, statuses, reminder cadence, due-date logic and protection summaries.
- `src/lib/server/insuranceServer.js` - access control, normalisation, workbook parser, event helpers and report snapshot builder.
- `src/app/api/insurance/route.js` - authenticated policy read/create/update/status/renew API.
- `src/app/api/insurance/import/route.js` - staff-only preview/commit Excel import.
- `src/app/api/cron/insurance-reminders/route.js` - idempotent premium/renewal/motor reminder job.
- `src/services/insuranceService.js` - authenticated client API wrapper.
- `src/components/insurance/InsurancePolicyForm.js` - manual type-aware policy form.
- `src/components/insurance/InsuranceProtectionPanel.js` - Investor protection KPIs, policy list, renewal/document actions and history.
- `src/components/insurance/InsuranceProtectionCentre.js` - central staff workspace and Excel upload/download flow.
- `src/app/(portal)/insurance/page.js` - staff Insurance & Protection page.
- `src/app/investor/insurance/page.js` - read-only Investor Portal Insurance & Protection page.
- `public/templates/GrowVest_Insurance_Policy_Template_v0.33.3.xlsx` - blank production upload workbook.
- `public/templates/GrowVest_Insurance_Policy_Filled_Sample_v0.33.3.xlsx` - illustrative filled workbook.
- `public/guides/GrowVest_Manual_Investment_and_Insurance_Guide_v0.33.3.docx` - explanatory field/process guide.
- `docs/INVESTOR_INSURANCE_PROTECTION_v0.33.3.md` - workflow/security/UAT documentation.

## Updated files

- `package.json` and `package-lock.json` - release version `0.33.3`.
- `firestore.rules` - server-only insurance collections.
- `src/lib/constants/navigation.js` - staff Portfolio Management link.
- `src/lib/constants/investorNavigation.js` - Investor Portal link.
- `src/lib/constants/permissions.js` - Insurance permission family.
- `src/components/auth/ProtectedRoute.js` - `/insurance` route permission.
- `src/components/investors/InvestorDetailClient.js` - Insurance & Protection tab.
- `src/services/documentService.js` - optional insurance linkage metadata on policy documents.
- `src/services/notificationService.js` - insurance push category preference.
- `src/app/investor/notifications/page.js` - Insurance & renewals preference UI/icon.
- `functions/index.js` - insurance notification category/copy mapping.
- `src/components/portfolio/ManualPortfolioExcelPanel.js` - filled manual-investment sample and explanatory guide downloads.
- `src/lib/constants/report.js` - default Protection Snapshot seed.
- `src/services/reportService.js` - Protection Snapshot normalisation/persistence/render fingerprint input.
- `src/components/reports/ReportForm.js` - draft report Protection Snapshot fetch at cutoff date.
- `src/components/reports/MonthlyWealthReport.js` - web Protection Snapshot section.
- `src/components/reports/MonthlyReportPrintDocument.js` - print Protection Snapshot page.
- `src/lib/server/reportPdf.js` - generated PDF Protection Snapshot page.
- `scripts/qa/release-audit.mjs` - v0.33.3 release assertions.
- `README.md` - v0.33.3 release summary.

## Firestore collections

- `insurancePolicies` - current and historical policy records.
- `insurancePolicyEvents` - immutable operational policy events.
- `insuranceReminderEvents` - idempotency/audit records for scheduled reminders.

All three are server-managed; browser access is denied by Firestore rules.

## No portfolio-corpus mutation

The module does not write Insurance cover into Portfolio Master positions, portfolio transactions, Bucket List allocations or portfolio valuation fields. Monthly Reports receive a separate `protectionSnapshot` object.

## Profile + Portfolio integration additions

- `src/components/insurance/InvestorProtectionSnapshotCard.js` - reusable protection summary shown in Investor Profile and Investor Portfolio surfaces.
- `src/lib/server/insuranceServer.js` - staff-scoped consolidated Insurance Portfolio Overview builder.
- `src/app/api/insurance/route.js` - `scope=portfolio` read mode for consolidated protection analytics.
- `src/services/insuranceService.js` - consolidated Portfolio protection API client.
- `src/components/portfolio/PortfolioOverview.js` - aggregate protection KPIs, attention items and investor coverage table.
- `src/components/investors/InvestorDetailClient.js` - compact Profile Overview protection card and Portfolio-tab protection card.
- `src/app/(portal)/investors/[investorId]/page.js` - direct `?tab=` navigation support.
- `src/app/investor/portfolio/page.js` - Investor Portal protection snapshot alongside the investment portfolio.
- `docs/INSURANCE_PROFILE_AND_PORTFOLIO_INTEGRATION_v0.33.3.md` - integration and UAT notes.
