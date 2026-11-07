# GrowVest v0.34.35 | October Source Coverage HTTP 409 | Focused correction

**Exact baseline:** GrowVest_v0.34.35_Unified_Monthly_Close_Special_Trading_Complete_Project.zip. This is an incremental patch for that cumulative release only. If that baseline is uncertain, deploy the new full cumulative project in a fresh staging directory rather than stacking patches.

## Why this happened
The reporting API correctly blocked an old verified 2026-10-05 snapshot because a newer 2026-10-31 Fundbazaar dated valuation exists. That HTTP 409 is a business validation outcome, not a build or Next.js runtime failure. A separate UI classification bug accidentally logged `portfolio_source_coverage_incomplete` as an uncaught console error. The month-end approval endpoint also logged expected 4xx validation decisions as server errors.

## Changes
1. Share the expected monthly financial-validation error classification with automatic source recovery and the report form. Include `portfolio_source_coverage_incomplete`, 409 approval/reconciliation blockers, and admin-approval-required responses. Unknown errors still log.
2. Suppress server `console.error` only for expected 4xx eligibility/approval responses; 5xx faults still log normally.
3. Return structured authenticated diagnostics (selected snapshot ID/date/mode, newer source archive IDs/dates, reporting month/cutoff) for the 409 source-coverage response.
4. Preserve those diagnostics in the authenticated client error and display a concrete staff action under the report's financial verification warning instead of a Next.js console overlay.
5. Add a fixture reproducing an old October 5 snapshot vs October 31 Fundbazaar archive, successful verified promotion, legitimate blocker propagation and post-cutoff/voided guards.

## Important: NOT an auto-approval bypass
If the automatic month-end close does NOT approve the October 31 archive because of missing/uncertain original source evidence, the report remains BLOCKED. A patch cannot determine the exact reason without running the staging Firebase eligibility check on the actual archive. Do not publish the old October 5 value, backdate Saturday NAVs or overwrite September reports.

## Testing
`npm ci; npm run qa; node --no-warnings scripts/qa/monthly-source-coverage-409-fixture.mjs; npm run qa:monthly-engine; npm run build` in staging. Real Firebase, official NAV network, and production build have not been verified in this offline environment.

## Diagnose any remaining block
As a staging admin, open Portfolio Overview > Historical valuations, select the affected investor/month, run Check reporting eligibility for the newest October archive, and read the exact blocker. The report's first GET may show an HTTP 409 while the guarded automatic close is attempted; the business message should not create a runtime overlay. If the archive is eligible, the POST should approve and a subsequent GET must select the new verified snapshot. If it is not eligible, record the code and `eligibility.blockers`; the needed data correction follows that evidence, not a guessed date or re-upload.
