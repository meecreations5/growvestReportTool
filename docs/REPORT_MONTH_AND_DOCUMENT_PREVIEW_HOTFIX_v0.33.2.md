# Report Month & Document Preview Hotfix — v0.33.2

## Fix 1 — Reporting month can be changed on an existing editable draft

The Reporting Period step previously disabled the native month control whenever the report already had an ID. This meant a draft created with the wrong month could not be corrected.

The month selector is now disabled only when the report itself is locked. Changing the month recalculates the report year, financial year, cutoff date, reporting period and title through the existing period update logic.

When an existing unpublished draft changes month, its report code is regenerated for the corrected month. Saving is also blocked if a report already exists for the investor and newly selected reporting month.

## Fix 2 — Document preview popup layering

The shared document preview dialog is now rendered through a React portal directly into `document.body`. This prevents the modal from being trapped by parent stacking contexts, overflow containers or transformed layouts on Investor Profile and Investor Portal pages.

The existing secure Blob preview flow remains unchanged for PDF/JPG/PNG files.

## Files changed

- `src/components/reports/create/ReportingPeriodStep.js`
- `src/components/reports/ReportForm.js`
- `src/services/reportService.js`
- `src/components/documents/DocumentPreviewModal.js`
- `docs/REPORT_MONTH_AND_DOCUMENT_PREVIEW_HOTFIX_v0.33.2.md`
