# UI/UX — HTML Report Preview

## Routes

- Staff report preview: `/reports/[reportId]`
- Investor report view: `/investor/reports/[reportId]`
- Print/PDF preview: `/report-print/[reportId]`

## Updated experience

### Staff preview

- Compact report identity header with report month, Investor, working version and publication state.
- Primary actions reduced to Edit, Preview PDF, Download PDF and Publish.
- Secondary actions moved into a More menu.
- Publication readiness is collapsed by default and expands only when needed.
- Email, secure PDF and Investor-response states are shown as compact metadata.
- Version history is collapsed below the report canvas.
- Internal controls remain outside the Investor-facing HTML report.

### Investor preview

- Simplified monthly report header.
- Previous and next report navigation.
- Download PDF and Discuss actions.
- Report acknowledgement shown without internal workflow information.
- Sticky mobile Download and Discuss actions.
- No internal approval, delivery-log, validation or staff-role information is shown.

### Shared report navigation

The sticky section navigation now uses the following order:

1. Overview
2. Performance
3. Goals
4. Allocation
5. Holdings
6. Commentary
7. Actions
8. Disclaimer

The active section changes automatically while scrolling.

### Report canvas

- Consistent section IDs for staff and Investor views.
- Mobile allocation and holding cards retained.
- CSV export actions are available to staff only.
- Investor Goal controls are simplified to a clean report reading experience.
- Empty states are provided for missing goals, allocation, holdings and actions.
- Advisor commentary appears after holdings to match the navigation and PDF order.
- Dark-section logo and text contrast remain protected.

### PDF alignment

The print/PDF document now follows the same terminology and sequence:

1. Cover
2. Executive Summary and Portfolio Performance
3. Bucket List Progress
4. Portfolio Allocation
5. Detailed Holdings
6. Advisor Commentary
7. Recommended Actions, Next Review and Disclaimer

## Updated files

- `src/components/reports/ReportDetailClient.js`
- `src/components/reports/InvestorReportDetailClient.js`
- `src/components/reports/MonthlyWealthReport.js`
- `src/components/reports/MonthlyReportPrintDocument.js`
- `src/components/reports/ReportPublicationPanel.js`
- `src/components/investor/InvestorReportSectionNav.js`

The complete package also includes the previously approved Investor Documents visibility and permission fixes.

## Testing

Run:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

Test the staff and Investor routes at:

- 390px
- 768px
- 1280px
- 1440px

Verify:

- Active section navigation
- Edit, preview, PDF, publish and More actions
- Collapsed publication-readiness details
- Investor acknowledgement and discussion request
- Mobile sticky actions
- Allocation and holding cards
- Empty report sections
- PDF section order and terminology

No Firestore rule, index, environment-variable or database migration change is required.
