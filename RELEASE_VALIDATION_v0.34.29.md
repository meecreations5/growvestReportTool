# GrowVest v0.34.29 Release Validation — Fundbazaar Daily Portfolio Import Stability

## Validated scope

- Fundbazaar Client Wise Valuation remains the supported daily source; Portfolio Ledger remains unsupported.
- Core Fundbazaar holding writes continue to use the same investor mapping, folio/ISIN identity, valuation, exit and goal-allocation rules.
- Blank/invalid optional numeric values cannot be written as `NaN` in Fundbazaar transaction fields.
- A missing/stale preview fingerprint produces an explicit re-analyse message.
- A file-level commit error is saved directly to the file record and is visible in the Daily Portfolio Update UI.
- Snapshot or Daily Coverage refresh failure after successful primary holdings commit produces a partial/warning result instead of a generic HTTP 500.
- Any route-level failure records the exact `failureStage` and returns that stage to the UI.

## Regression boundary

No Monthly Report period rules, Manual PMS freshness rules, Manual folio identity rules, trading/F&O logic, Bucket List allocation rules, Fundbazaar holding calculations or report PDF logic are changed.

## QA

- JavaScript syntax checks: passed for changed server/UI files.
- Release audit: run as part of packaging.
- Production/Vercel build remains the final environment check because live Firebase/Vercel credentials are not available in the isolated review environment.
