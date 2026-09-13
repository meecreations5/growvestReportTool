# GrowVest v0.34.19 - Responsive Exact Report Viewer

## Goal
Keep the locked GrowVest Signature Wealth Review design visually identical while making the report preview practical on both desktop and mobile.

## Principle
The A4 report does **not** reflow or switch to a different mobile template. The same locked A4 pages are rendered everywhere. Only the viewer scale changes, so typography, icons, numeric alignment, charts, cards, spacing, cover composition and page breaks stay faithful to the approved reference.

## Desktop
- Exact A4 page size at 100% when space permits.
- Fit-to-window for narrower desktop/tablet layouts.
- Zoom controls preserve the fixed A4 design.
- Print resets the viewer to 100% and keeps the secure/print page geometry unchanged.

## Mobile
- Exact A4 pages auto-fit to the available phone width.
- User can zoom in/out without changing report layout.
- Horizontal scrolling is enabled only when the user zooms beyond the fitted width.
- Investor report detail exposes **View exact report design** on phone.
- Existing one-minute mobile review remains available as the interactive summary; the designed A4 report is the canonical visual document.

## Design lock
No report financial calculations, Goal/Corpus logic, SIP values, Opening Review rules, reconciliation logic, PDF generation rules or publishing rules were changed.

## Files
- `src/components/reports/ResponsiveReportPreview.js`
- `src/components/reports/ReportPrintClient.js`
- `src/components/reports/InvestorReportDetailClient.js`
- `src/app/globals.css`
- `public/sw.js`

## QA
Confirm on a real report at:
- 390px phone width
- 768px tablet width
- 1366px desktop width
- Browser print / Save as PDF

The rendered page design must remain the same at every viewport size; only the preview scale may change.
