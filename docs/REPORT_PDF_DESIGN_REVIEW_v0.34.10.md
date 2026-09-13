# GrowVest v0.34.10 - Report PDF Design Review

## Review scope

Reviewed the existing GrowVest Monthly Report implementation with emphasis on the report presentation and secure PDF output.

## Existing output architecture

The report currently has three presentation surfaces:

1. Interactive staff / Investor HTML report
   - `src/components/reports/MonthlyWealthReport.js`
2. Browser A4 print preview
   - `src/components/reports/MonthlyReportPrintDocument.js`
   - `src/components/pdf/PdfDocumentShell.js`
   - print styles in `src/app/globals.css`
3. Secure server-generated PDF
   - `src/lib/server/reportPdf.js`
   - `src/lib/server/pdfDocumentShell.js`
   - generated and stored through `src/lib/server/reportServer.js`

## Critical design rule

The browser A4 preview and secure PDF are separate renderers.

A PDF redesign must therefore be implemented in both:

- `MonthlyReportPrintDocument.js` + report print CSS
- `reportPdf.js` + server PDF shell

Changing only one renderer will create a visible mismatch between Preview PDF and the downloaded secure PDF.

## What must remain unchanged during a visual redesign

The design pass should not change:

- monthly report source calculations
- Portfolio Master hydration
- report completion validation
- template snapshot immutability
- branding snapshot immutability
- report version history
- stale-PDF invalidation
- Firebase Storage path logic
- staff / Investor access checks
- publication workflow
- Investor visibility controls
- email delivery logic

## Current template dependency

The selected report template controls:

- section order
- section visibility
- primary colour
- secondary colour
- dark colour
- cover style
- table density
- chart style
- Advisor card visibility
- PDF document controls

A report stores the template version and snapshot. Historical versions should continue to render with their saved snapshot.

## Current PDF section model

Depending on template visibility and available data, the secure PDF can include:

- Cover
- Executive Summary
- Portfolio Performance
- Portfolio Value Trend
- Goals / Bucket List
- Portfolio Allocation
- Allocation Details
- Detailed Holdings
- Intraday Trading Summary
- Transactions
- Insurance & Protection
- Advisor Commentary
- Surplus Allocation & Loan Position
- Investor Profile Actions / Advisor Recommendations
- Next Review
- Report Information / Disclaimer

Large allocation, holding, transaction, action and disclaimer sections paginate automatically.

## Design observations

### 1. Browser and secure PDF do not use the same rendering technology

The browser preview uses React / CSS while the secure PDF is drawn directly with `pdf-lib`. Visual parity must be maintained manually.

### 2. Typography is not fully brand-matched in the secure PDF

The application uses GrowVest web fonts, while the secure PDF currently embeds standard Helvetica fonts. This is reliable for PDF generation but visually different from the browser report.

Any brand-font change should be implemented only after confirming the font files can be safely embedded in the server runtime and redistributed in generated investor PDFs.

### 3. Rounded UI cards are approximated in server PDF

The browser report uses rounded cards. The current server renderer uses rectangular PDF primitives. This should be considered when defining the final design language so the secure PDF does not look like a weaker copy of the HTML preview.

### 4. Cover design and document chrome are shared conceptually, not technically

Header, footer, logo, watermark, contact information and page metadata exist in both browser and server PDF shells. These should be updated together in any redesign.

### 5. Some template appearance controls are currently presentation-only

The template editor exposes `coverStyle`, `coverPattern`, `chartStyle`, `headingStyle`, `bodyDensity`, `headerStyle` and `footerStyle`. In the current report output, only a subset has meaningful effect.

In particular:

- `coverStyle` is added as a browser CSS class, but no matching cover-style rules currently exist in `globals.css`.
- `coverPattern` is shown in the template editor / thumbnail but is not consumed by the browser A4 renderer or secure PDF renderer.
- `chartStyle` is shown in the template editor but the report chart components use fixed visual styles.
- `headingStyle`, `headerStyle` and `footerStyle` are stored but are not currently applied as distinct output variants.

This means the template thumbnail can visually promise a different design from the actual generated report. The next report-design pass should wire only the appearance options GrowVest genuinely intends to support, or remove unsupported controls from the editor.

### 6. Template logic must remain the source of truth

The redesigned PDF should continue to resolve:

- `template.sectionOrder`
- `template.sectionVisibility`
- `template.appearance`
- saved branding snapshot

Avoid hardcoding one design in a way that bypasses template/version history.

## Recommended redesign approach

### Stage A - lock the visual system

Define the final report design system first:

- A4 page grid and margins
- cover composition
- section title treatment
- KPI card system
- chart treatment
- goal card system
- allocation table style
- holdings table style
- commentary / insight cards
- action cards
- disclaimer / legal page
- header and footer rules

### Stage B - implement browser A4 preview

Update:

- `MonthlyReportPrintDocument.js`
- `PdfDocumentShell.js`
- report print CSS in `globals.css`

Use `/report-print/[reportId]` as the visual review surface.

### Stage C - mirror secure PDF

Update:

- `reportPdf.js`
- `pdfDocumentShell.js`

Maintain the same section order, content and visual hierarchy as the browser A4 preview.

### Stage D - regression check

Compare:

1. Staff HTML report
2. Browser A4 preview
3. Secure downloaded PDF
4. Investor HTML report
5. Active published report version

Test both compact and high-volume portfolios.

## High-volume PDF test cases

Include at least:

- 10+ goals
- 15+ allocation rows
- 20+ holdings
- 15+ transactions
- long Advisor commentary
- long goal names
- multiple profile actions / recommendations
- insurance policies
- financial-plan data
- long disclaimer

This ensures the final design remains usable when the report expands beyond the ideal sample case.
