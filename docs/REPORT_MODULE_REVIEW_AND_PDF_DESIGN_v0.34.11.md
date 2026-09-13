# GrowVest v0.34.11 - Report Module Review & Premium PDF Design

## Objective

Review the existing Monthly Report module end to end, preserve its mature reporting workflow, and upgrade the investor-facing A4 report into a more intentional wealth-review document without changing financial calculations, publication logic, history, or access rules.

## Report module review

The Report module already separates the main responsibilities correctly:

1. Report Create / Edit workspace
   - staff prepares a monthly report through the existing staged workflow
   - Portfolio Master data is hydrated separately from narrative and presentation controls
2. Interactive report presentation
   - `src/components/reports/MonthlyWealthReport.js`
3. Browser A4 Preview
   - `src/components/reports/MonthlyReportPrintDocument.js`
   - `src/components/pdf/PdfDocumentShell.js`
   - report print styles in `src/app/globals.css`
4. Secure server PDF
   - `src/lib/server/reportPdf.js`
   - generated/stored through `src/lib/server/reportServer.js`
5. Completion / PDF / publication lifecycle
   - working report remains distinct from generated PDF and immutable published version
6. Investor delivery
   - investor-visible report and secure PDF use the existing permission and publication boundaries

This architecture should be retained. The v0.34.11 work is a presentation and renderer-parity release, not a rewrite of the reporting engine.
The existing publishing sequence and immutable published-version model remain protected throughout the redesign.

## Protected boundaries - intentionally unchanged

The design pass does not change:

- Portfolio Master calculations or cost-basis logic
- report financial schema
- Portfolio Master hydration rules
- report completion validation
- stale-PDF invalidation behavior
- template snapshot/version immutability
- branding snapshot/version immutability
- report version history
- Firebase Storage path conventions
- staff or Investor access controls
- publication workflow
- Investor visibility rules
- email/report delivery logic

## Design direction

The previous A4 output contained the right information but visually behaved too much like an application dashboard placed onto a sheet of paper. v0.34.11 moves it toward a premium private-wealth review document.

### Design principles

- strong editorial cover rather than a dashboard hero
- restrained GrowVest blue/cyan accent system
- consistent A4 margins and page hierarchy
- smaller, quieter document header/footer chrome
- one clear hero metric per important summary page
- white metric cards with deliberate top accents instead of excessive rounded UI cards
- more readable goal and allocation storytelling
- print-safe charts sized for A4
- tables with fixed content-aware column widths, zebra rows and density modes
- calmer commentary/action presentation
- compact, legible disclaimer pages

## Renderer parity work

The browser Preview and secure PDF are separate technologies, so the same design intent is implemented in both.

### Browser A4 Preview

Updated:

- `MonthlyReportPrintDocument.js`
- `PdfDocumentShell.js`
- report A4 CSS in `globals.css`
- `ReportTrendChart.js`
- `ReportDonutChart.js`

### Secure PDF

Updated:

- `reportPdf.js`
- `reportServer.js`

The secure renderer version is now `2.2.0` so generated PDF metadata identifies the new visual renderer.

## Template controls now used more honestly

The report-template layer remains the source of truth. v0.34.11 connects several controls that previously had weak or cosmetic output impact.

### `coverStyle`

Browser and secure PDF now distinguish light, brand-light and dark cover treatments.

### `coverPattern`

The report can now render supported patterns in the actual A4 output, including:

- orbital
- grid
- lines
- wave
- brand mark
- none

The secure PDF uses PDF primitives; the browser Preview uses CSS equivalents.

### `chartStyle`

The trend chart now reacts to the selected style, including grid/detail density, area treatment, line weight and point/value emphasis. The chart also uses the resolved template primary colour instead of a hard-coded blue.

### `tableDensity`

Compact and comfortable density modes now affect A4 table padding/type sizing in addition to pagination behavior.

## Cover redesign

The cover now prioritises:

1. Reporting month/year
2. GrowVest positioning line
3. Prepared-for Investor identity
4. Advisor identity
5. Three compact summary measures

The selected cover style and cover pattern are rendered rather than remaining thumbnail-only concepts.

## Executive summary redesign

The summary page now uses:

- one dominant portfolio-value treatment
- three supporting metrics
- a stronger Partner/Advisor note
- smaller insight blocks for progress, attention and opportunity

This creates a clearer reading order and reduces card clutter.

## Performance and allocation

- trend chart is A4-aware and template-colour aware
- print mode is more compact than the interactive dashboard chart
- allocation donut has a dedicated print layout so it does not collapse into a long stacked block
- numeric tables use explicit column proportions

## Goals, holdings and transactions

- goal cards use restrained status treatment and stronger progress hierarchy
- holdings/allocation/transaction/protection tables now define content-aware widths
- table headers are light with brand accents rather than heavy dark bands
- zebra rows and compact numeric alignment improve long-table scanning

## Commentary, actions and disclaimer

The visual hierarchy is calmer and more document-like. Disclaimer style is also consumed by the secure renderer so compact/standard formatting affects pagination and density.

## Existing v0.34.10 consistency fix retained

If an Investor has no Bucket List goals, both Preview and secure PDF continue to show **General Wealth Corpus** rather than an inapplicable Overall Progress metric.

## Visual QA

A representative seven-page A4 wealth-review sample was rendered to PDF and then rendered to page images for visual inspection. The review covered:

- cover hierarchy
- executive-summary card alignment
- trend-chart bounds
- allocation/table proportions
- goal-card spacing
- holdings table density
- commentary/action blocks
- disclaimer readability
- footer/page chrome

No clipping or page-boundary overlap was observed in the A4 sample.

The environment could not complete an npm dependency install, so a live application `pdf-lib` generation could not be executed here. The secure renderer was therefore validated by source-level/syntax/release checks, while A4 visual QA used the browser-side design system with representative content. A generated PDF should still be visually spot-checked in the deployed/staging app before production publication.

## Recommended operational QA after deployment

Test at least:

- Investor with Bucket List goals
- Investor with no goals / General Wealth Corpus
- 10+ goals
- 20+ holdings
- 15+ allocation rows
- 15+ transactions
- insurance policies
- financial plan / loan data
- multiple actions
- long Advisor commentary
- long disclaimer
- each approved report template intended for production use

For each test report compare:

**Working Report -> Preview -> Generated Secure PDF -> Published Investor View**

## Product Tour scope

The planned app-wide In-App Guided Tour / Product Tour is intentionally not implemented in this release. It should begin after the Report PDF/report-workflow visual work is accepted, so onboarding is built against stable screens and actions.
