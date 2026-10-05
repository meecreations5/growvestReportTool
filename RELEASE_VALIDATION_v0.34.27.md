# GrowVest v0.34.27 — Manual PMS Report Freshness

## Release objective

Stop false Opening/Monthly Wealth Review verification warnings caused by blank or old per-holding valuation dates in manually maintained PMS portfolios, while preserving the existing stale-source controls for genuinely old Manual PMS updates.

## Verified rules

- Manual PMS freshness uses the workbook import/account snapshot date.
- A recently imported Manual PMS workbook with blank holding valuation dates is not marked `Source valuation date missing`.
- A recently imported Manual PMS workbook with an older holding valuation date is not falsely marked stale.
- Legacy `manual_pms_<timestamp>_...` batch IDs recover the import date.
- Existing `manualPortfolioAccountSnapshots` support report-time freshness repair for legacy snapshots.
- A Manual PMS import that is genuinely more than 31 days old remains critical/blocked.
- Fundbazaar, Bajaj, ULIP and other provider sources continue using provider valuation/NAV dates.
- Financial values, NAV dates, historical snapshot values and Bucket List allocations are not rewritten by the report-time freshness overlay.

## QA

Run:

- `node scripts/qa/manual-pms-freshness-fixture.mjs`
- `npm run qa`
- `npm run qa:opening-verification`
- `npm run qa:opening-review`
- `npm run qa:pdf-encoding`

## Validation result in this package

- Release audit: **530 passed, 0 warnings, 0 failures**
- Manual PMS freshness fixture: passed
- Opening Portfolio Verification fixture: passed
- Opening Wealth Review reconciliation fixture: passed
- PDF WinAnsi encoding fixture: passed
- Changed JavaScript files: `node --check` passed
