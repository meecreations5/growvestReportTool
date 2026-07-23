# PDF Consistency Pass - Version 0.23.0

## Objective

Version 0.23.0 aligns the responsive HTML report, browser A4 print document and secure server-generated PDF so the same report version produces the same section order, visibility, data, branding and pagination intent across every delivery surface.

## Consistency rules

All report outputs now resolve from the same sources:

- Saved report-template snapshot for section order and visibility.
- Saved branding snapshot for historical versions.
- Shared report-presentation utilities for performance trends, highlights, portfolio health, goals, transactions and Advisor insights.
- The report's full allocation, fund, action and disclaimer data without arbitrary truncation.

A historical published report therefore continues to display the branding and template that were active when that version was generated, even after the live Branding Settings are changed.

## Completed changes

### Shared branding and theme resolution

`src/lib/utils/reportBranding.js` provides a single resolver for:

- Live branding with report-level snapshot precedence.
- Template primary, secondary and dark colours.
- Supporting success, warning, danger, muted and surface colours.

The interactive report, browser A4 document and server PDF use these resolved values.

### Browser A4 report

`MonthlyReportPrintDocument` now follows the saved template section order and produces dedicated, page-bounded A4 sections for:

1. Cover
2. Executive summary
3. Portfolio performance and historical trend
4. Bucket List progress
5. Allocation summary and allocation details
6. Detailed holdings
7. Transactions
8. Advisor commentary
9. Recommended actions and next review
10. Report information and disclaimer

Large data sets are split into labelled continuation pages. Table rows are wrapped and kept within page boundaries.

### Secure server PDF

The `pdf-lib` renderer now includes the same content model as the browser A4 report:

- Template-aware colours and document controls.
- Full historical performance trend.
- Month-on-month movement.
- Full allocation, holdings and transactions pages.
- Advisor narrative and insight cards.
- Paginated actions and long disclaimer text.
- Report metadata, version, template and statement date.
- Improved A4 header, footer, watermark and image fitting.

The renderer writes `pdfRendererVersion: 2.0.0` to the report/version record.

### Transactions

The shared transaction resolver now prefers an explicit `report.transactions` array when it exists. Older reports remain compatible because investments and withdrawals are still derived from fund rows when no explicit transaction array is present.

### Branding snapshot

PDF generation stores the published branding values in `brandingSnapshot`. The same snapshot is included in immutable report-version data, preventing historical logo, colour and footer changes after publication.

### Historical trend

Before secure PDF generation, the server loads up to the latest 12 prior monthly reports for the Investor. The same trend derivation is used in HTML, browser print and secure PDF output.

## Pagination and layout safeguards

- A4 dimensions are fixed at 210 x 297 mm for browser printing and 595.28 x 841.89 points for server PDF output.
- Repeating headers and legal footers are reserved outside the content region.
- Allocation and holding rows calculate their height from wrapped cell content.
- Long instrument names, goal names, notes and legal text wrap instead of clipping.
- Continuation pages repeat the section title and table header.
- `Rs.` is used by the server PDF's standard Helvetica fonts to avoid broken rupee glyphs.
- Uploaded logos, footer symbols, watermarks and cover backgrounds preserve their original proportions.

## Main updated files

```text
src/app/globals.css
src/components/pdf/PdfDocumentShell.js
src/components/reports/MonthlyReportPrintDocument.js
src/components/reports/MonthlyWealthReport.js
src/lib/server/pdfDocumentShell.js
src/lib/server/reportPdf.js
src/lib/server/reportServer.js
src/lib/utils/reportBranding.js
src/lib/utils/reportPresentation.js
```

## Verification completed

- All 241 JavaScript and JSX source files parsed successfully with zero syntax errors.
- The server renderer completed a high-volume runtime smoke test with long names, 13 goals, 22 allocation rows, 25 holdings, 19 transactions, 14 actions and a multi-page disclaimer.
- The test produced 20 A4 pages and 1,559 drawing operations without invalid coordinates.
- The resulting QA PDF was rendered at 150 DPI and visually reviewed for clipping, overlap, table boundaries, continuation pages and footer safety.
- PDF inspection confirmed 20 A4 portrait pages and successful opening in PyMuPDF/Poppler.

The QA PDF is an internal renderer-emulation artifact and is not included in the application package.

## Local UAT checklist

1. Run `npm install` and `npm run dev`.
2. Open a completed report using each active report template.
3. Compare the HTML report, `/report-print/[reportId]` and secure downloaded PDF.
4. Test a report with more than 10 allocation rows and more than 8 fund rows.
5. Test explicit transactions and legacy fund-derived transactions.
6. Test long goal, fund, action and disclaimer text.
7. Publish the report, change live Branding Settings, then confirm the published version still uses its saved branding snapshot.
8. Verify Gmail/Outlook email attachments open and match the active published version.
9. Run `npm run lint` and `npm run build` in the deployment environment.

## Deployment

No new Firestore composite index is required for the PDF history query. Deploy the application and the existing security configuration normally:

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,storage
```
