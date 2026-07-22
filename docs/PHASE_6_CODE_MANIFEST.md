# Phase 6 Code Manifest

## New files

```text
src/components/reports/MonthlyWealthReport.js
src/components/reports/MonthlyReportPrintDocument.js
src/components/reports/ReportTrendChart.js
src/components/reports/ReportDonutChart.js
src/components/reports/ReportPrintClient.js
src/components/reports/InvestorReportDetailClient.js
src/lib/utils/reportPresentation.js
src/app/report-print/[reportId]/page.js
src/app/investor/reports/[reportId]/page.js
src/app/api/communications/report/route.js
docs/PHASE_6_BRANDED_REPORT_AND_PDF.md
docs/PHASE_6_CODE_MANIFEST.md
```

## Updated files

```text
src/components/reports/ReportDetailClient.js
src/components/reports/ReportForm.js
src/app/investor/reports/page.js
src/services/reportService.js
src/services/communicationService.js
src/lib/constants/report.js
src/lib/server/emailTemplates.js
src/app/globals.css
firestore.indexes.json
.env.example
package.json
README.md
```

## Key behaviours

- Staff preview and publication workflow
- Investor report detail workflow
- A4 print / Save-as-PDF route
- Historical trend query for staff and secure published-only trend query for Investors
- Brevo report-publication email API
- Investor in-app report notification
- Manual WhatsApp report sharing
- Dynamic report insights and custom highlight fields
- CSV export and `.ics` review calendar download
