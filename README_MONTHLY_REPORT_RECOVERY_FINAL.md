# GrowVest v0.34.35 - Monthly Wealth Review 05-Oct Reconciliation Loop Fix

## What was actually broken

The Monthly Wealth Review's report-source API selects only verified Portfolio Master snapshots. For October 2026, this can select 2026-10-05 even though later confirmed October SIPs exist and newer daily Fundbazaar valuation archives were retained separately. Its financial guard correctly rejects subtracting those late contributions from an early closing value (HTTP 409). The prior auto-close patch ran only when the user clicked Refresh Financial Data while the form was already blocked. The initial report load therefore showed the same 409 without attempting source recovery.

**This release fixes that frontend/backend handshake. It does not relax the financial guard.**

## Exactly what changed

- Monthly report source loading now detects the known 409 financial coverage error (or a missing monthly snapshot) and performs **one administrator-authorized POST** to the existing auto-month-end endpoint. On successful verified approval it **reloads** the report-source API and displays the correct month-end snapshot.
- React reloads and double-invocations share one in-flight close attempt per investor/report month. Manual Refresh Financial Data deliberately clears that key and retries the same guarded flow. No uncontrolled repeated approvals.
- Even after an HTTP success, the report refuses to proceed if no verified snapshot is returned, or the server still selects the earlier Oct 5 snapshot despite a later approved archival valuation.
- Real source exceptions are now shown: missing historical archive, unreachable/mismatched official NAV evidence, multi-source PMS+Fundbazaar coverage, mismatched source transactions, insufficient source coverage, missing admin permission. The original generic 'rebuild and refresh' 409 is not presented as though that were a sufficient resolution.
- Previously issued/published reports and Opening Wealth Review are **not** subjected to automatic month-end approvals.
- No NAVs, cash movements, portfolio valuations, investor balances, Firebase rules, scheduled SIP amounts or published PDFs are modified by the UI patch. The already-existing server auto-approval endpoint remains the only authority that can create an immutable verified historical closing snapshot, with its audit trail.

## Files changed vs GrowVest_v0.34.35_Auto_Monthly_Close_Full_Project.zip

- **Modified** `src/components/reports/ReportForm.js` - report-load integration and controlled refresh.
- **Added** `src/lib/portfolioMonthlySourceRecovery.js` - single attempt/retry/verification source-loader.
- **Modified** `scripts/qa/amfi-automatic-monthend-fixture.mjs` - updated to verify the automatic load path, not an optional button-only call.
- **Added** `scripts/qa/monthly-source-auto-recovery-fixture.mjs` - behavioral tests covering exact 05-Oct and Rs 5000 regression, concurrent requests, genuine exceptions, prior-report protection and false-success prevention.
- **Modified** `package.json` - `npm run qa:monthly-auto-recovery`.

A complete sanitized project ZIP is provided. Use **either the full project or the patch**. The *patch is only for an existing install of the earlier v0.34.35 Auto Monthly Close Full Project*, not the original v0.34.35 or the separate OpsTool.

## One testing path

1. Confirm your Firestore export shows **Completed** and copy the staging app. Do not change production data for testing.
2. Deploy the **complete sanitized project** to staging, keeping your local `.env.local` in your deployment environment. Never commit credentials.
3. Stop Next.js and clear `.next` cache before building.
4. Run:

```powershell
npm ci
npm run qa
npm run qa:monthly-auto-recovery
node --no-warnings scripts/qa/amfi-automatic-monthend-fixture.mjs
node --no-warnings scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs
node --no-warnings scripts/qa/manual-pms-monthly-reconciliation-fixture.mjs
node --no-warnings scripts/qa/monthly-close-cutoff-fixture.mjs
npm run build
```

5. Sign in as **Admin / Super Admin**. Open the affected investor's **October 2026 Monthly Wealth Review**. No initial manual refresh should be necessary: the report automatically attempts an eligible month-end source recovery, then reloads the snapshot.
6. Check that the source shows the actual eligible October NAV dates, not fabricated 31-Oct NAVs, and that the two actual October purchases total Rs 5,000; they must not be double-counted as loss or unconfirmed SIP commitments.
7. Repeat with an investor holding **both PMS and Fundbazaar**. That combination must remain blocked if no consolidated month-end valuation exists. The banner must now explain this precise reason, not silently approve a Fundbazaar-only snapshot.
8. Re-open already published September reports and confirm they remain unchanged. Verify an actual October closing against source facts before publishing.

## Verified in this offline environment

- Release audit: **577 passed, 0 warnings, 0 failures**.
- New month-end source recovery behavioral tests: **15 passed**.
- AMFI/month-end integration checks: **21 passed**.
- Historical month-end promotion: **41 passed**.
- Cutoff/freshness/PMS history: **45 passed**.
- Manual PMS cash-flow reconciliation: **38 passed**.
- SIP stop/pause handling: **17 passed**.
- JavaScript and JSX syntax: parsed successfully with TypeScript's parser.
- No live Firestore operations or investor data were changed in creating this release.

**Not verified:** Actual Firebase deployment, the user account's Admin permissions, successful live AMFI API fetch for exceptional NAV dates, source data completeness, or a full Next.js build in this offline environment (dependencies not installed). A missing or untrustworthy historical portfolio cannot be reconstructed by code alone. The engine MUST continue blocking publication if a complete closing source cannot be established.

## Known remaining scope: full unattended all-investor close

This fixes the recurring error and automatic recovery on the affected **Monthly Wealth Review screen** when eligible historical source data is available. It is **not** a scheduled, unattended, all-investor month-close processor and does not automatically merge independently valued PMS account statements with Fundbazaar archives into one new verified snapshot. The complete investor-wide automation requested earlier still needs its own source coverage integration and end-to-end test against your 54 investors.

If the banner persists after this cumulative release, it should show a **specific code/reason** (for example `monthly_close_no_historical_archive` or `monthly_close_requires_review`) rather than only the generic 05-Oct message. That reason is now the concrete blocking data/permission condition to address, not another instruction to reupload data blindly.
