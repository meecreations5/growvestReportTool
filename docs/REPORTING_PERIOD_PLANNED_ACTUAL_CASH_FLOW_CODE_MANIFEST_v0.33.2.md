# Reporting Period & Planned/Actual Cash Flow — Code Manifest v0.33.2

Baseline: `growvestReportTool_portfolio_reporting_v0.33.2_bucket_report_action_workflow`

## Changed / new files

1. `README.md`
2. `docs/REPORTING_PERIOD_PLANNED_ACTUAL_CASH_FLOW_v0.33.2.md`
3. `docs/REPORTING_PERIOD_PLANNED_ACTUAL_CASH_FLOW_CODE_MANIFEST_v0.33.2.md`
4. `scripts/qa/release-audit.mjs`
5. `src/app/api/actions/[actionId]/route.js`
6. `src/app/api/actions/sync-report/route.js`
7. `src/components/actions/ActionCentre.js`
8. `src/components/actions/ActionRequestDialog.js`
9. `src/components/actions/InvestorActionsPanel.js`
10. `src/components/reports/MonthlyReportPrintDocument.js`
11. `src/components/reports/MonthlyWealthReport.js`
12. `src/components/reports/ReportForm.js`
13. `src/components/reports/create/ReportingPeriodStep.js`
14. `src/lib/constants/actions.js`
15. `src/lib/constants/report.js`
16. `src/lib/server/actionServer.js`
17. `src/lib/server/reportPdf.js`
18. `src/lib/validation/reportSchema.js`
19. `src/services/actionService.js`
20. `src/services/portfolioService.js`
21. `src/services/reportService.js`

## Main behaviour

- New reports default to the previous completed calendar month.
- Month/year are explicit report-period controls; month-end is the automatic cutoff for completed months.
- Opening Value, Money Added, Money Withdrawn, Portfolio Gain/Loss and Monthly SIP are automatic.
- Planned Investor Actions remain non-financial until actual execution.
- Manual PMS external contributions/withdrawals feed monthly report cash flows.
- Staff may explicitly confirm an external action cash movement only when no provider transaction is already stored.
- Trading Account Deposit / Withdrawal are explicit action types.
- SIP stop/pause/reduction are changes to future contributions, not withdrawals.
- Delivery sale proceeds are not automatically classified as external withdrawal.
- Report/PDF surfaces Upcoming / Planned Actions separately from actual monthly portfolio changes.
