# GrowVest v0.34.35 - Daily Portfolio Import Only

Based on the user's growvestReportTool(5).zip. This change does not modify Monthly Wealth Review, report source, monthly financial calculations, PDF generation, or report eligibility.

## Code changes
- Daily commit batch finalization: an all-duplicate, no-issue batch is successful (`completed`) rather than `failed`; mixed imports retain `partial` for issues and genuine failures remain `failed`.
- Daily import page: when all selected files were imported previously, show an explicit 'Already processed / nothing to update' explanation, not 'All eligible files ready'.
- Remove redundant React setResult call (if present in older copies; latest working upload already has a single call).
- Add `npm run qa:daily-import` with isolated test coverage.

## Installation
Use either the complete project OR the focused patch, not both. Patch only against growvestReportTool(5).zip. Keep your `.env.local` and other private configuration outside the ZIP. Use a backup and staging before production.

PowerShell:
    npm ci
    npm run qa:daily-import
    npm run qa
    npm run build
    npm run dev

## Staging acceptance checks
1. Upload the exact same already imported Fundbazaar file: show 'Already imported' and 'Nothing to update'. Do not write duplicate holdings or transactions.
2. Upload a newly generated daily file with new NAV or value: it must be ready and import successfully, even if investor and units did not change.
3. Upload one new and one duplicate: one imported; one skipped; batch not failed.
4. Upload a file with an unresolved investor mapping: mark as requiring review, not imported.
5. Confirm portfolio screen shows the updated daily value and import history is retained.
6. Confirm an existing Monthly Wealth Review still works exactly as before.

## Limits
The specific runtime failure message on your current daily import has not yet been supplied, so this release fixes the verified duplicate/status/display defects; it is not proof that every daily-import error is resolved. No Firebase staging connection or full Next.js production build was available in this environment. New daily file vs old file detection still uses the existing SHA-256 content fingerprint and the current mapping rules.
