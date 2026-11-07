# GrowVest Report Tool - Unified Monthly PMS Integration
Release base: v0.34.35 Monthly Close Complete Project (sanitized)
Release type: CUMULATIVE STAGING CANDIDATE. Use the new full-source ZIP OR the cumulative changed-files patch, not both.

## What this release changes

1. A shared historical reporting ledger feeds month-end financial facts in report-source, Portfolio Master snapshot calculations and server-side publication safety checks. Fundbazaar and Manual PMS are not mixed indiscriminately.
2. The detailed managed Manual PMS workbook treats `05_Cash_Ledger` actual investor capital as authoritative. Additional Capital / Investor Deposit are fresh external money; investor capital withdrawal is an external withdrawal. PMS buys, sells, redemptions and transfers between securities/accounts are INTERNAL, not investor deposits or withdrawals. Disputed or unclassified cash rows block reporting instead of inventing gain/loss.
3. `04_Transactions` has correct explicit cash-flow flags and amounts, and its capital entries are de-duplicated against confirmed cash-ledger movements when identity, amounts/dates and references safely match. Confirmed investor action ledger uses matching references to avoid double counting.
4. The simple per-investor Manual Investments workbook accepts OPTIONAL PMS capital-movement columns (see below). There is no requirement to change an existing workbook just to keep importing holdings; however, actual fresh money/withdrawals cannot be determined from NAV changes alone.
5. A simple Manual Investment Replace no longer deletes previously confirmed historical transaction records or holdings managed through the separate multi-account Manual PMS importer. Repeated imports use stable transaction IDs. Explicit corrections/reversals should use an audited correction workflow, NOT deleting old rows silently.
6. Per-account Manual PMS NAV dates and signed capital-withdrawal cash balances are preserved correctly. Where supplied, the simple importer stores actual workbook valuation dates instead of inventing the upload date. Missing source dates remain marked as upload-based provisional dates.
7. Existing October NAV/source eligibility, SIP cancelled/paused/stopped instruction exclusions, cutoff-date safeguards, and the latest-source guard from the previous hotfixes are INCLUDED. Do not install those older hotfixes afterward.
8. A first recurring Monthly Wealth Review requires a verified opening portfolio reference. Do not fabricate opening gain/loss. Previously published September reports are NOT rewritten.

## Optional columns for a simple Manual Investments workbook (PMS rows only)

- PMS Capital Added (number; actual confirmed new capital)
- PMS Capital Added Date (YYYY-MM-DD, required if amount is provided)
- PMS Capital Withdrawn (number; actual confirmed capital returned to investor)
- PMS Capital Withdrawal Date (YYYY-MM-DD, required if amount is provided)
- PMS Capital Reference (bank/transaction reference, optional but useful for deduplication)
- Valuation Date (YYYY-MM-DD actual PMS value date; strongly recommended)

Alternatively, use the existing optional `Transactions (Optional)` sheet with explicit `PMS Capital Addition` / `PMS Capital Withdrawal` transactions, their effective dates and references. Never put scheduled/failed SIP debits or intra-PMS security buys in these capital fields. For the detailed managed Manual PMS import, put actual investor capital movements in its `05_Cash_Ledger`; no extra form is required.

## Monthly rule (illustrative, not an approved investor figure)

October month-end investment gain/loss in INR = October closing value - verified September closing value - actual October external investments + actual October investor withdrawals. Internal switches and trades are not investor cash movements. Percentage return should use the approved cash-flow-aware calculation, not naive monthly gain / cost when money moves during the month.

## Staging implementation / release validation

1. Confirm the Firestore backup export is COMPLETED. Keep immutable copies of the last published September Wealth Reviews.
2. Choose only ONE install route:
   - FULL SOURCE: extract `GrowVest_v0.34.35_Unified_Monthly_PMS_Full_Project.zip` into a clean project directory, then restore your own local .env variables securely; or
   - CUMULATIVE PATCH: copy code paths from `GrowVest_v0.34.35_Unified_Monthly_PMS_Patch.zip` over the exact v0.34.35 Monthly Close Complete Project baseline (including if earlier NAV/SIP patches were applied). Do not mix with v1.40.x OpsTool.
3. Install dependencies according to package-lock (`npm ci`) in your own development environment; then run `npm run qa`, focused fixtures, and `npm run build`. This sandbox had no installed Next.js dependencies and DID NOT run a production build.
4. Use STAGING Firestore with backed-up/synthetic investor data. Run: first Opening Wealth Review; verified September closing -> October recurring; Oct 31 investment -> included; Nov 1 contribution -> excluded; PMS new capital + withdrawals; stopped/paused SIP; internal PMS stock trade; different NAV dates; full multi-source investment coverage; repeated daily imports; same sheet uploaded twice; and simple Replace not wiping historic confirmed cash flows.
5. Validate Jitendra with actual retained September baseline, October Fundbazaar archives and confirmed investment records. The unresolved SBI October 31 NAV still requires genuine source identity/value/date evidence. Never substitute unverified NAV or 4 Nov valuations for October. Report must remain on hold if evidence cannot be established.
6. Verify all 54 investors against staging exports, compare source-to-report totals, ensure all report statuses are correct, sign off, then deploy via your normal CI/CD route. Report drafts can be auto-prepared only when source coverage is actually verifiable; final investor publication remains a staff-controlled approval.

## Honest limitations / remaining implementation

- Not a fully autonomous NAV verification service. Official exceptional NAV provenance, post-cutoff multi-source closing reconstruction, and all 54 LIVE investor reconciliation still need verified source data/integration.
- There is no new scheduled background job/automatic 1-7 report publication in this patch. It fixes core cash-flow classification and existing month-end calculation pathways. A full scheduled orchestration/promotion workflow needs a separately tested backend service and source-provider access.
- No production deployment, live Firebase write or production build was performed here.
- Historical archive eligibility for Fundbazaar-only may remain blocked where manual and Fundbazaar sources coexist. This is intentional protection against incomplete portfolio source approval.
- PMS holding valuation alone cannot reliably reveal investor capital additions/withdrawals. Use an actual dated cash-flow record; otherwise require exception review.

## Source manifest and tests

`CHANGE_MANIFEST_UNIFIED_MONTHLY_PMS.json` lists each cumulative changed/new code file with SHA-256. Release QA: 577 checks; focused Manual PMS monthly 38; month-end cutoff 45; historical monthly source 41; SIP lifecycle 17; plus other preexisting fixtures passed. Node syntax checks passed. These are unit/source-fixture checks, not proof that staging Firebase or report PDF rendering works.
