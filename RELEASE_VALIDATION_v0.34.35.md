# Release Validation - v0.34.35

Scope: Turbopack-safe Monthly Review reconciliation client fix.

## Root cause addressed

`ReportForm.js` called `reconcileMonthlyReportPortfolio()` through the large `reportService.js` client module. In the affected Next.js 16.2.10 / Turbopack runtime, the loaded client chunk exposed an older module shape and the named export resolved as `undefined`, producing `TypeError: reconcileMonthlyReportPortfolio is not a function` at completion.

## Fix

- Added dedicated `src/services/reportReconciliationService.js` client module.
- `ReportForm.js` now imports the reconciliation function from that dedicated module.
- Reconciliation request uses `cache: "no-store"`.
- Existing server-side `/api/reports/reconcile-portfolio` gate remains unchanged.
- Legacy export remains in `reportService.js` for compatibility, but the Monthly Review completion path no longer depends on it.
- v0.34.34 stale-report protections at Complete, PDF and Publish remain intact.

## Regression target

Clicking Continue/Complete on a Monthly Review must call the reconciliation API without a Turbopack `not a function` runtime error. A stale month-end snapshot must still block completion and require financial refresh/re-review.

## Validation result

- Release audit: 577 passed, 0 warnings, 0 failures.
- Dedicated client integration fixture: 7 passed.
- Portfolio reconciliation fixture: passed.
- Reconciliation gate fixture: passed.
- Report period / Opening baseline fixture: passed.
- PDF WinAnsi encoding fixture: passed.
