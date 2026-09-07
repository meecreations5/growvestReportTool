# v0.33.5 Investor Mobile App Experience & Design System - Code Manifest

## New secure Investor App surfaces

- `src/app/api/investor/app-data/route.js`
  - Server-side Investor Home/profile/goals/reports/meetings/documents data
  - Live Portfolio Master dashboard summary
  - Published report detail and acknowledgement context
- `src/app/api/notifications/route.js`
  - Investor/staff notification read, mark-read and preference API
- `src/services/investorAppService.js`
  - Authenticated client for Investor App data and report detail
- `src/components/investor/MobileInvestorDashboard.js`
  - Phone-only live wealth dashboard

## Permission-hardening changes

- `src/services/notificationService.js`
- `src/app/investor/dashboard/page.js`
- `src/app/investor/goals/page.js`
- `src/app/investor/profile/page.js`
- `src/app/investor/insurance/page.js`
- `src/app/investor/reports/page.js`
- `src/app/investor/meetings/page.js`
- `src/app/investor/documents/page.js`
- `src/app/investor/change-password/page.js`
- `src/components/reports/InvestorReportDetailClient.js`
- `src/components/reports/ReportPrintClient.js`
- `src/app/api/actions/route.js`
- `src/app/api/actions/[actionId]/route.js`
- `src/services/actionService.js`
- `src/components/actions/InvestorActionsPanel.js`
- `src/components/actions/ActionTimeline.js`
- `src/components/actions/WithdrawalCashNeedsPanel.js`

These changes move Investor read paths away from protected browser Firestore list queries while preserving staff-side workflows where appropriate.

## Mobile-only design-system changes

- `src/components/investor/InvestorShell.js`
  - Phone app bar
  - Native-style phone More sheet
  - existing tablet/desktop shell retained
- `src/components/investor/InvestorPageHeader.js`
  - hides website-style page header on phones
- `src/components/reports/InvestorReportDetailClient.js`
  - compact phone report summary
- `src/app/globals.css`
  - phone-only design tokens, safe-area and form-control rules scoped below 768px

## Release metadata

- `public/sw.js` - Investor PWA cache `v0.33.5`
- `package.json` - version `0.33.5`
- `package-lock.json` - version `0.33.5`
- `README.md` - release notes
- `scripts/qa/release-audit.mjs` - v0.33.5 regression assertions
- `docs/INVESTOR_MOBILE_APP_EXPERIENCE_DESIGN_SYSTEM_v0.33.5.md`
- `docs/INVESTOR_MOBILE_APP_EXPERIENCE_DESIGN_SYSTEM_CODE_MANIFEST_v0.33.5.md`

## Explicit non-scope

No desktop Admin/Advisor screen is redesigned by v0.33.5. The release shares existing APIs/calculation rules but applies the new visual design only to phone-size Investor Portal surfaces.
