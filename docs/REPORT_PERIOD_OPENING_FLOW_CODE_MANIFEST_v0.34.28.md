# v0.34.28 Code Manifest — Reporting Period & Opening Review Flow

## Core period rules
- `src/lib/reportPeriodRules.js`
  - previous completed month helper
  - Opening baseline month/date normalisation
  - same-month Monthly eligibility when the cutoff is later than the Opening snapshot

## Report editor
- `src/components/reports/ReportForm.js`
  - preserves selected reporting period when auto-switching a first report to Opening
  - allows Monthly draft/completion/PDF preparation while Opening publication is pending
  - blocks only genuine cutoff-before-baseline conflicts
- `src/components/reports/create/ReportingPeriodStep.js`
  - separate informational Opening-publication notice from period conflict

## Portfolio report source
- `src/app/api/portfolio/report-source/route.js`
  - for the first same-month Monthly Review, uses the verified Opening report snapshot as the opening performance baseline
  - later months retain the normal month-start snapshot logic

## Save/publish enforcement
- `src/services/reportService.js`
  - Monthly draft save no longer requires Opening publication
  - still requires an Opening/legacy baseline and a valid post-baseline cutoff
- `src/app/api/reports/[reportId]/publish/route.js`
  - investor publication still requires the Opening Wealth Review to be published
  - same-month Monthly period is accepted when its cutoff is later than the Opening baseline

## QA
- `scripts/qa/report-period-opening-fixture.mjs`
  - 5 Oct -> September default
  - Sep 11 Opening -> Sep 30 Monthly allowed
  - Sep 30 Opening -> Sep 30 Monthly rejected
  - later-month Monthly allowed
