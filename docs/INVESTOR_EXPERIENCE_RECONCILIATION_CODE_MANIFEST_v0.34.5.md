# v0.34.5 Investor Experience Reconciliation — Code Manifest

## Core release metadata

- `package.json`
- `package-lock.json`
- `public/sw.js`
- `README.md`
- `scripts/qa/release-audit.mjs`
- `RELEASE_VALIDATION_v0.34.5.md`

## Investor shell, navigation and Home

- `src/lib/constants/investorNavigation.js`
  - persistent phone tabs now include Reports instead of Profile.
- `src/components/investor/InvestorShell.js`
  - structural full-width Home shell; Profile remains in Home avatar / GrowVest action sheet.
- `src/components/investor/MobileInvestorDashboard.js`
  - SIP error visibility and Bucket List needs-input attention.
- `src/app/investor/dashboard/page.js`
  - loads SIP reminder and Bucket List request intelligence for Home.
- `src/app/globals.css`
  - full-width Home hero with normal content gutters below.

## SIP intelligence

- `src/lib/server/portfolioImportParser.js`
  - retains latest SIP date / inferred debit day.
- `src/lib/server/portfolioServer.js`
  - automatically creates/updates inferred SIP schedules when suitable while preserving manually managed schedule values.
- `src/app/api/sip-funding/route.js`
  - authenticated fallback schedule inference from Portfolio Master and transaction history.

## Daily verified portfolio notification

- `functions/index.js`
  - `notifyInvestorPortfolioVerified` watches verified + reconciled snapshots.
  - push category handling now includes portfolio, SIP and Bucket List.
- `package.json`
  - push-function deployment script includes the new portfolio verification function.

## Notification preferences

- `src/app/api/notifications/route.js`
- `src/services/notificationService.js`
- `src/app/investor/notifications/page.js`
  - Portfolio, SIP and Bucket List categories are user-configurable and use GrowVest semantic icon/color treatment.

## Investor Add Bucket List and GrowVest confirmation

- `src/app/api/bucket-list-requests/route.js`
  - secure server-managed request lifecycle.
  - Investor create action.
  - Advisor/Admin review action.
  - active goal creation only after confirmation.
  - notifications/activity logging.
- `src/services/bucketListRequestService.js`
  - authenticated client service.
- `src/components/investor/InvestorBucketListRequestPanel.js`
  - Investor Add to My Bucket List composer and pending request state.
- `src/components/investors/BucketListRequestReviewPanel.js`
  - GrowVest staff review/refinement/confirmation panel.
- `src/app/investor/goals/page.js`
  - integrates investor request composer with active Bucket List.
- `src/components/investors/InvestorDetailClient.js`
  - integrates staff request review into Goals & Bucket List.

## Profile completion

- `src/app/api/investor/app-data/route.js`
  - exposes masked KYC identifiers and non-sensitive current portfolio context.
- `src/app/investor/profile/page.js`
  - Personal Details and Your Wealth Profile sections expanded.

## Security model

`bucketListRequests` is accessed through authenticated server APIs using Firebase Admin. Browser clients receive no new direct Firestore permission. Investor-submitted requests remain separate from active goals until staff confirmation.
