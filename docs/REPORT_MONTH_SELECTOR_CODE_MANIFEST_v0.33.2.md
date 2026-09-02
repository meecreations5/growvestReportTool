# Reporting Month Selector - Code Manifest v0.33.2

Files changed/added in this incremental hotfix:

1. `src/components/reports/ReportForm.js`
   - accepts `month=YYYY-MM` on Create Report links
   - safely rejects future/invalid month parameters
   - supports atomic `reportMonthKey` changes and recalculates the reporting-period metadata

2. `src/components/reports/create/ReportingPeriodStep.js`
   - replaces separate month/year editing with one explicit month picker
   - keeps report year and financial year visible
   - explains next-month report preparation behaviour

3. `scripts/qa/release-audit.mjs`
   - regression coverage for the month picker and month-aware deep links

4. `docs/REPORT_MONTH_SELECTOR_HOTFIX_v0.33.2.md`
   - workflow documentation

5. `docs/REPORT_MONTH_SELECTOR_CODE_MANIFEST_v0.33.2.md`
   - this manifest
