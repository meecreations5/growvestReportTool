# GrowVest v0.34.35 - Automatic NAV Eligibility Preview Fix

## Why the error kept returning

The **Check reporting eligibility** (GET preview) path did not call the server's official NAV verification. Only automatic POST recovery attempted AMFI. The UI also sent blank manual-proof fields, so the user could see the same false "unverified weekend NAV" blocker repeatedly. Independently, AMFI history fetch timed out after only 9 seconds and did not retry intermittent empty responses.

## Fix in this cumulative project

1. Preview, explicit admin approval and automatic monthly close share the same server-side official NAV verification. The GET preview is read-only.
2. Valid source evidence takes precedence over empty or duplicate browser-entered manual proof. An alternate manual attestation remains available only for genuinely unresolved exceptions.
3. Official AMFI historical requests use a 19-second per-request timeout and a single surrounding-range retry when the first response is empty or unavailable; the exact ISIN, NAV date and NAV amount must match, and the actual reference URL used is retained.
4. Verified official historical records are cached 15 minutes in the current server instance to reduce duplicate external calls across investors; failures have a 30-second short retry cooldown.
5. The UI shows an explicit automatic AMFI match result and hides the manual NAV fields when the official record matched successfully.
6. The route declares a 60-second maximum duration where supported by the host. This does NOT guarantee that every hosting platform allows 60-second requests.
7. No changes were made to historical NAV dates, cash flows, existing investor holdings, or already-published reports. All other financial eligibility checks remain intact.

## Installation

- This is a **cumulative full project** based on the last `GrowVest_v0.34.35_Report_Reconciliation_Complete_Project.zip`. Do not apply prior hotfixes on top.
- Confirm the Firestore export/backup completed. Deploy to a staging Firebase project before production.
- Preserve your existing local `.env.local` configuration separately, outside any ZIP; do not include secrets in a shared artifact.
- Extract this project, run `npm ci`, `npm run qa`, `npm run build` with project dependencies available.
- Run focused fixtures:
  `node --no-warnings scripts/qa/monthend-preview-official-nav-fixture.mjs`
  `node --no-warnings scripts/qa/amfi-network-resilience-fixture.mjs`
  `node --no-warnings scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs`
- In the staging app open **Portfolio > Dated portfolio history > October 2026 > Check reporting eligibility**. Expect an automatic AMFI check result.
- If the official historical NAV matches the archived holding exactly, weekend-date blocking is cleared and no manual proof is requested. All other financial checks still apply.
- If AMFI cannot provide an exact official ISIN/date/NAV match, the record remains blocked with an explicit reason rather than silently using an older value.
- Once eligible, use the normal report approval workflow and verify October closing against the archive; do not publish until reconciled.

## Verification performed here

- 577/577 release audit checks passed.
- 41/41 historical month-end checks passed.
- 21/21 previous AMFI/month-end fixture checks passed.
- 9/9 new preview evidence checks passed.
- 5/5 new mocked-network resilience checks passed.
- Server modules passed Node syntax check.

## Limitations

This environment cannot connect to the live AMFI endpoint or to your Firebase staging/production project, and dependencies are not installed here, so **live AMFI matching, Next production build, and actual investor reconciliation are not verified**. A real AMFI outage, wrong fund ISIN, source NAV amount mismatch, or additional cash-flow/PMS blocker must still prevent financial approval. If the full month-end pipeline remains blocked for another reason, capture the new specific blocker from this release.
