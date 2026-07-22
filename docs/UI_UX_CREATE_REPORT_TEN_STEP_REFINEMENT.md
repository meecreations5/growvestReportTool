# Create Monthly Report — Ten-Step UX Refinement

## Scope

This update retains the ten-step report workflow while simplifying how users understand and complete it.

## Included

1. Only one main workflow section is rendered at a time.
2. The ten-step progress rail remains available on desktop.
3. Mobile and tablet users open the full step list in a slide-over drawer.
4. Every step includes a **Where this appears in the report** guide.
5. The right report summary uses a lighter, quieter visual treatment.
6. Draft changes autosave after a short pause once the investor and reporting period are valid.
7. Autosaves do not create additional activity-log entries or artificial report versions.
8. Staff-entered, automatically calculated, inherited, and internal-only values are identified visually.
9. Calculated values such as overall progress, holding percentage, goal progress, allocation percentage, and variance are read-only.
10. The sticky workflow bar contains the single Save Draft action and the contextual Continue action.
11. The header no longer repeats Save Draft.
12. The Complete Report label appears only when final validation passes. Until then, the disabled action displays the number of issues to resolve.

## Updated files

- `src/components/reports/ReportForm.js`
- `src/components/reports/create/ReportWorkflowShell.js`
- `src/components/reports/create/ReportWorkflowGuidance.js`
- `src/services/reportService.js`

## Autosave behaviour

- Starts only after the Investor and Reporting Period steps are valid.
- Runs 1.8 seconds after the last change.
- Shows `Autosave pending`, `Autosaving…`, `All changes saved`, or `Autosave failed — use Save draft` in the workflow header.
- Uses the deterministic report ID for new reports and continues updating the same draft.
- Does not create a new audit activity or increment the visible version for every autosave.
- Manual Save Draft still creates the normal save activity and version update.

## Required testing

Test routes:

- `/reports/create`
- `/reports/[reportId]/edit`

Test widths:

- 390px
- 768px
- 1280px
- 1440px

Verify:

- Only the selected workflow step is visible.
- Ten progress items are present.
- Locked steps cannot be opened.
- The mobile step drawer opens and closes correctly.
- Mapping guidance changes with each step.
- Calculated fields cannot be edited.
- Autosave creates and then updates one draft.
- The Save Draft button appears only in the sticky action bar.
- Complete Report does not appear until validation passes.
- PDF and delivery steps remain locked until their prerequisites are complete.
