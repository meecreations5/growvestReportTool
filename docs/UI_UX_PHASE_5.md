# GrowVest Investor Report Tool — UI/UX Phase 5

UI/UX Phase 5 redesigns the staff-side Monthly Report workflow and strengthens the mobile report review and publication experience.

## Design foundation

- League Spartan for headings and financial display values
- Open Sauce One for body copy, fields, filters and tables
- GrowVest Royal Trust Blue, Deep Premium Black, Strategic Red, Insight Yellow, Soft Gray, Medium Gray and White
- Mobile record cards instead of forced wide tables
- Clear separation between report preparation, completion, PDF generation, publication and Investor acknowledgement
- Existing dynamic GrowVest branding, watermark and shared PDF shell retained

## Monthly Reports workspace

### Report list

- Responsive KPI summary for all reports, drafts, completed reports, published reports and reported corpus
- Current-month preparation indicator
- All, Draft, Completed and Published segmented views
- Search by Investor, client code, report code or Advisor
- Year filter
- Mobile report cards with portfolio value, statement date, Advisor and publication status
- Desktop operational table retained
- Quick copy-to-next-month and open actions
- Improved empty, loading and Firestore-index error states

## Guided Monthly Report Editor

The report editor now behaves as a guided preparation workspace with nine sections:

1. Context
2. Summary
3. Composition
4. Insights
5. Bucket List
6. Allocation
7. Holdings
8. Actions
9. Compliance

### Editor enhancements

- Desktop sticky progress navigator
- Mobile horizontal section navigator
- Active-section tracking while scrolling
- Section-completion checks
- Live Investor, reporting-period, corpus, goal and fund summary
- Overall readiness percentage
- Direct jump to any report section
- Existing copy-previous-month workflow retained
- Existing calculations, validation and Firestore data model retained
- Mobile safe-area-aware Save Draft and Complete Report controls

## Report review and publication

- Cleaner Monthly Report Review header
- Staff report section navigator
- Publication-readiness panel showing:
  - report completion
  - secure PDF generation
  - Investor Portal publication
  - Investor email status
  - Investor acknowledgement
- Improved working-version, published-version and revision indicators
- Mobile sticky Edit / Publish / Download actions
- Existing secure PDF, version history, Brevo email and WhatsApp workflows retained

## Investor-facing report experience

UI/UX Phase 2 mobile report behaviour remains active:

- Sticky mobile section navigation
- Mobile allocation cards
- Mobile fund-holding cards
- Mobile Download PDF and Discuss actions
- Published-version navigation and acknowledgement

## PDF consistency

The shared PDF system from UI/UX Phase 1 remains the source of truth:

- GrowVest document header
- legal footer
- configurable wordmark and icon
- dynamic watermark
- report reference and page numbering
- League Spartan / Open Sauce hierarchy where available

No PDF data model or Firebase migration is introduced in this phase.

## New files

```text
src/components/reports/ReportEditorSummary.js
src/components/reports/ReportPublicationPanel.js
```

## Updated files

```text
src/components/reports/ReportsTable.js
src/components/reports/ReportForm.js
src/components/reports/ReportDetailClient.js
package.json
```

## Backend impact

This is a presentation and workflow phase.

- No new Firestore collections
- No new Firestore indexes
- No new Storage rules
- No new environment variables
- Existing report services, publishing APIs and PDF generation remain compatible

## Test routes

```text
/reports
/reports/create
/reports/[reportId]
/reports/[reportId]/edit
/investor/reports
/investor/reports/[reportId]
/report-print/[reportId]
```

## Recommended test journey

```text
Monthly Reports
→ Search and filter
→ Create Report
→ Copy Previous Month
→ Move through every editor section
→ Confirm completion percentage
→ Save Draft
→ Reopen and Complete Report
→ Review publication readiness
→ Generate Secure PDF
→ Publish and Email
→ Open Investor Portal
→ Download and Acknowledge Report
```

## Build

```powershell
npm install
npm run build
npm run dev
```

The Fontsource dependencies from UI/UX Phase 1 remain required.
