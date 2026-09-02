# GrowVest v0.33.2 - Reporting Month Selector

## Purpose

Monthly Reports are usually prepared between the 1st and 5th of the following month. The report creation workflow therefore treats the reporting month as an explicit business period, independent of the date on which the Advisor creates the report.

## Create Report behaviour

- New reports default to the last completed calendar month.
- Step 2 now exposes one clear `Reporting month` month-picker.
- The Advisor can choose any eligible month up to the current calendar month before the report is created/saved.
- Selecting a month updates the report year, report month key, automatic portfolio cutoff date, reporting-period dates, monthly changes and report title together.
- Example: on 3 September 2026, the Advisor can select August 2026 and create the August 2026 Monthly Report.
- Existing saved reports keep their original reporting month locked to preserve historical integrity.

## Deep links

Create Report links that include `?month=YYYY-MM` now initialise the report with that month instead of silently reverting to the default previous month. Invalid or future month parameters fall back safely to the normal default period.

## Financial source rule

Changing the reporting month causes GrowVest to reload the Portfolio Master/report source for the selected cutoff date. Portfolio facts remain automatic; the month selector does not turn financial values into manual fields.
