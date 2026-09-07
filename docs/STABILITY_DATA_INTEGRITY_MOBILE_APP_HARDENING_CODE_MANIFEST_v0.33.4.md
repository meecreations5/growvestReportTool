# v0.33.4 Stability, Data Integrity & Mobile App Hardening - Code Manifest

This manifest identifies the principal files changed or materially involved in the v0.33.4 hardening release.

## Monthly Reports

- `src/services/reportService.js` - stale-version guard, canonical report-period migration orchestration.
- `src/app/api/reports/[reportId]/migrate-period/route.js` - authenticated canonical Investor/month ID migration and linked-reference repair.
- `src/app/api/reports/[reportId]/delete/route.js` - report deletion journal and retry-safe secure Storage cleanup.
- `src/app/api/reports/[reportId]/publish/route.js` - publication claim/idempotency protection.
- `src/app/api/reports/[reportId]/pdf/route.js` - atomic download counter.
- `src/lib/validation/reportSchema.js` - verified fully-exited zero-closing-balance completion rules.
- `src/components/reports/ReportForm.js` - report lifecycle/month-change integration.
- `src/lib/constants/report.js` - report period/verification supporting constants.

## India business date

- `src/lib/utils/date.js` - `businessDateKey()` using Asia/Kolkata.
- `src/services/actionService.js`
- `src/components/assessment/AssessmentPageClient.js`
- `src/components/investors/InvestorEditClient.js`
- `src/components/leads/FollowUpForm.js`
- `src/components/leads/LeadForm.js`
- `src/components/portfolio/InvestorPortfolioPanel.js`
- `src/app/api/cron/insurance-reminders/route.js`
- `src/app/api/insurance/route.js`

## Insurance & Investor lifecycle

- `src/app/api/cron/insurance-reminders/route.js` - overdue/catch-up reminders and lifecycle pause recognition.
- `src/app/api/investors/[investorId]/lifecycle/route.js` - lifecycle pause/resume for Insurance, Meetings and scheduled deliveries.
- `src/components/investors/InvestorLifecycleCard.js` - lifecycle impact UI.
- `src/app/api/cron/meeting-reminders/route.js` - lifecycle-pause handling.
- `src/app/api/cron/report-deliveries/route.js` - lifecycle/scheduled-delivery handling.
- `src/app/api/insurance/route.js` - duplicate/status validation and ULIP linkage.
- `src/app/api/insurance/import/route.js` - journalled import batches.
- `src/lib/server/insuranceServer.js` - stable policy identity, duplicate detection and linked ULIP fields.
- `src/lib/constants/insurance.js` - approved policy/status/reminder masters.
- `firestore.rules` - supporting server-managed collection rules.

## Investor Mobile App / PWA

- `src/lib/constants/investorNavigation.js` - four primary mobile destinations; More is the fifth shell slot.
- `src/components/investor/InvestorShell.js` - fixed five-slot app navigation, More sheet, safe-area and breakpoint behaviour.
- `src/app/investor/dashboard/page.js` - mobile dashboard/Protection quick access integration.
- `src/app/investor/portfolio/page.js` - Investments/Protection mobile portfolio surfaces.
- `public/sw.js` - v0.33.4 cache identity and app-shell refresh.

## QA / release metadata

- `package.json`
- `package-lock.json`
- `scripts/qa/release-audit.mjs`
- `README.md`
- `docs/STABILITY_DATA_INTEGRITY_MOBILE_APP_HARDENING_v0.33.4.md`
- `docs/STABILITY_DATA_INTEGRITY_MOBILE_APP_HARDENING_CODE_MANIFEST_v0.33.4.md`
