# GrowVest Report Tool v0.34.35 - Saturday NAV Acceptance

## Purpose
Allow source-reported **Saturday** NAV dates (including October 31, 2026) to participate in month-end eligibility rather than treating a Saturday alone as a financial blocker. Preserve original NAV dates and keep all fund, transaction, source and cutoff reconciliation safeguards.

## Based on
Cumulative GrowVest_v0.34.35_Eligibility_AMFI_Auto_Fix_Complete_Project.zip. This release supersedes that archive; do not stack prior month-end hotfixes.

## Behavior
- Friday and Saturday are both eligible source NAV dates, subject to the normal Fundbazaar archive/source authenticity checks, complete positions, month cutoff, NAV recency, full-portfolio totals, per-holding cash movement and transaction-ledger coverage.
- Saturday positions are additionally checked: positive units and NAV, positive value, and `|units * NAV - current value| <= max(INR 2, 0.02% of holding value)` to avoid approving an invalid NAV-date field.
- On Saturday, the UI no longer demands manual AMFI evidence, and automatic recovery does not wait for a mandatory AMFI lookup. Eligibility notes identify the Saturday values as **source-accepted**, NOT independently official-NAV-verified.
- Sunday still requires exact official ISIN/date/NAV corroboration where required; network failures for Sunday remain blocking.
- The month-end snapshot, imported source, holdings and audit records preserve accepted Saturday date/NAV/source evidence; pre-existing verified monthly reports are not silently overwritten.
- Imported source documents and SHA/fingerprint are checked by the existing server route before approval. This fix does not turn an unsourced NAV into a verified NAV.
- A Fundbazaar-only historical approval still blocks if the investor also has Manual PMS/other-source holdings, or if any other source/transaction validation fails. That is a separate genuine completeness condition.

## Changed application files (4)
1. `src/lib/portfolioHistoricalMonthEnd.js`
2. `src/lib/server/amfiOfficialNavEvidence.js`
3. `src/app/api/portfolio/valuation-history/approve-month-end/route.js`
4. `src/components/portfolio/InvestorDatedValuationHistory.js`

## Updated regression fixtures (2)
1. `scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs`
2. `scripts/qa/amfi-network-resilience-fixture.mjs`

## Staging test
1. Verify a completed Firestore backup; keep your existing `.env.local` configuration outside the ZIP.
2. Deploy this **full cumulative project** to staging, not the previously supplied releases layered together.
3. Run `npm ci`, `npm run qa`, `npm run build` and the focused fixtures below.
4. Open **Dated portfolio history > the October source through 31 October** and click **Check reporting eligibility**.
5. The 31 October SBI Saturday NAV should no longer produce a weekend-only blocker. Its actual 31 Oct date should remain displayed.
6. If the preview is Ready, review the full Fundbazaar-only portfolio/transactions and approve, then refresh the October Wealth Review. If still blocked, read the NEW specific blocker; do not alter source date or bypass it.
7. Check an investor with a missing SIP, an out-of-period NAV and a combined PMS portfolio remain blocked as appropriate.

## Regression commands
```
node --no-warnings scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs
node --no-warnings scripts/qa/amfi-network-resilience-fixture.mjs
node --no-warnings scripts/qa/amfi-automatic-monthend-fixture.mjs
node --no-warnings scripts/qa/monthend-preview-official-nav-fixture.mjs
npm run qa
npm run build
```

## Verification in this environment
- 577/577 release QA passed.
- 44/44 historical approval checks passed, including Saturday source acceptance, NAV mismatch and cash flow exclusions.
- 6/6 AMFI-network checks passed, including confirming that Saturday no longer requires a network request.
- 21/21 AMFI/month-end integration checks and 9/9 eligibility-preview checks passed.
- Changed server modules passed `node --check`.
- No live Firebase/AMFI integration, real Jitendra investor documents, or Next production build executed here because live credentials and installed Next dependencies are unavailable. Perform staging validation before production.
