# GrowVest v0.33.2 - Profile Withdrawal / Report Delete Code Manifest

This manifest describes the final delta on top of the v0.33.2 Reporting Period & Cash Flow build. The exact changed-file ZIP is generated from a file-content comparison against that baseline.

## Withdrawal and Profile workflow

- `src/components/actions/WithdrawalCashNeedsPanel.js` - Profile withdrawal planning, Bucket List selection, multiple Mutual Funds and fund-level SIP instruction.
- `src/components/actions/WithdrawalActionSummary.js` - investor/staff read-only withdrawal summary and completed impact.
- `src/components/actions/WithdrawalCompletionPanel.js` - controlled execution confirmation and Portfolio Master update UI.
- `src/components/actions/InvestorActionsPanel.js` - Investor Portal integration.
- `src/components/actions/ActionCentre.js` - Advisor completion workflow integration.
- `src/components/investors/InvestorDetailClient.js` - Profile tab for Withdrawals & Planned Cash Needs.
- `src/app/api/actions/route.js` - structured withdrawal creation validation.
- `src/app/api/actions/[actionId]/route.js` - prevents generic Completed status from bypassing portfolio adjustment.
- `src/app/api/actions/[actionId]/complete-withdrawal/route.js` - atomic holding/SIP/transaction update and snapshot rebuild.
- `src/lib/server/actionServer.js` - Bucket List/fund validation and request normalization.
- `src/lib/constants/actions.js` - structured withdrawal/action definitions.
- `src/services/actionService.js` - Profile actions-for-report query and completion API client.
- `src/lib/portfolioCashFlow.js` - provider-versus-provisional withdrawal reconciliation.
- `src/services/portfolioService.js` - uses withdrawal reconciliation in report portfolio source.

## Monthly Report integration

- `src/components/reports/ReportForm.js` - Profile actions are auto-fetched/read-only and kept separate from Advisor next steps.
- `src/components/reports/MonthlyWealthReport.js` - Profile Actions presentation.
- `src/components/reports/MonthlyReportPrintDocument.js` - print presentation.
- `src/lib/server/reportPdf.js` - generated PDF Profile Action section.
- `src/services/reportService.js` - persists normalized Profile Action snapshots.
- `src/lib/constants/report.js` - report payload defaults.
- `src/lib/validation/reportSchema.js` - Profile Action report schema field.

## Controlled Delete Report

- `src/app/api/reports/[reportId]/delete/route.js` - permission, reason/confirmation, PDF/version/portal cleanup, action preservation, latest-report repair and audit.
- `src/services/communicationService.js` - authenticated Delete Report client.
- `src/components/reports/ReportDetailClient.js` - Delete Report controls and confirmation dialog.
- `firestore.rules` - direct browser deletion of `monthlyReports` disabled.

## Release assurance

- `scripts/qa/release-audit.mjs` - regression assertions for Profile withdrawals, report auto-fetch, reconciliation and controlled deletion.
- `docs/PROFILE_WITHDRAWAL_REPORT_DELETE_WORKFLOW_v0.33.2.md` - functional/UAT specification.
- `docs/PROFILE_WITHDRAWAL_REPORT_DELETE_CODE_MANIFEST_v0.33.2.md` - this manifest.
