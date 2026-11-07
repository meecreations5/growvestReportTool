# GrowVest v0.34.35 - Unified Monthly Close & Special Trading (Cumulative)

**Release scope:** Restores a consistent investor monthly close across Fundbazaar dated NAV archives, Manual PMS original dated workbook evidence, the eligibility preview, automatic approval, all-investor readiness scan, report loading, PDF verification and publication. This cumulative package includes preceding v0.34.35 Saturday NAV, AMFI eligibility, report-recovery and Manual PMS reconciliation work. No daily upload procedure has changed.

## What is implemented

1. **Date-source separation.** Each imported Fundbazaar row retains its real NAV date; Manual PMS has its own source-reported valuation date. File upload/capture date does not become a fictional month-end NAV. The final reporting cutoff is the last calendar day of the selected month.
2. **Weekend and special exchange sessions.** A genuine Saturday mutual-fund NAV is eligible with source reconciliation; an exceptional Sunday mutual-fund NAV needs exact official source evidence. The explicit **NSE/BSE Sunday Diwali Muhurat session on 8 November 2026** is recognized for equities, but does not automatically create a mutual-fund NAV on Sunday. Instrument/market calendar guides must not replace dated source evidence. Beyond the verified 2026 calendar, provisional weekdays are not considered authoritative.
3. **Per-holding/monthly cash-flow integrity.** Actual confirmed SIP purchases, lump-sum capital, Manual PMS additions/withdrawals and internal trades are checked against the **specific fund or PMS account valuation date**, not merely the newest overall snapshot date. Cancelled/failed SIP instructions do not count as capital.
4. **Fundbazaar + Manual PMS month-end.** An original complete dated PMS workbook may join a reconciled Fundbazaar month-end archive in a **single verified multi-source closing snapshot**. An incomplete, stale, provisional or unmatched PMS workbook blocks approval; no source is silently omitted.
5. **No conflicting report routes.** The eligibility checker, automatic historical close, report-source API, all-investor scan and PDF/publish guard share monthly source/date validation; all protect previously frozen reports and reject later effective transactions.
6. **Same-NAV daily upload protection.** Distinct Fundbazaar file fingerprints on the **same NAV date** are allowed when the archived scheme/folio holdings, units, NAV, invested cost, value and SIP amount are genuinely identical. Financial differences are flagged for review, even if aggregate totals happen to match.
7. **Source revisions and snapshot selection.** A verified historical source snapshot can outrank a conflicting operational snapshot on the **same closing date**. A new or voided source causes a fresh financial coverage/provenance check. Older September published results are not automatically overwritten.

## Deployment - staging first

1. **Back up the existing source and Firebase staging data.** Do not run against live investors until verified. This package **does not include** `.env.local`, private keys or administrator credentials.
2. **Use only ONE installation method:**
   - Complete-project ZIP: unpack into a new directory, bring your **staging** environment settings separately, install dependencies.
   - Changed-files ZIP: apply only on the **exact** prior `GrowVest_v0.34.35_Saturday_NAV_Cumulative_Project.zip` code baseline. Use the included SHA-256 manifest. Do not stack patches from older releases over it.
3. Make sure `.firebaserc`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `FIREBASE_ADMIN_PROJECT_ID` all reference your intended staging project. Do not simply copy a production `.env.local` into staging.
4. From the new project directory, run:

```powershell
npm ci
npm run qa
npm run qa:monthly-engine
node scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs
node scripts/qa/manual-pms-monthly-reconciliation-fixture.mjs
node scripts/qa/monthly-close-cutoff-fixture.mjs
npm run qa:env:strict
npm run build
npm run dev
```

5. Log in as a **staging administrator**; continue the established morning Manual Fundbazaar upload workflow. Import a dated Manual PMS workbook for a separate staging investor, when applicable.
6. On **Portfolio Overview > Historical valuations / Monthly report integrity**, scan October 2026; open **Check reporting eligibility** for the affected October valuation, then use the automatic month-end close or administrator approval. An eligible Fundbazaar or mixed-source archive should create an approved closing snapshot and report-source should read that same snapshot.
7. Create the **October 2026 Monthly Wealth Review** with cutoff `2026-10-31`. Inspect portfolio current value, additions/withdrawals, report source snapshot ID, PDF, and the unpublished investor preview. Do not publish to a live investor while testing.

## Essential acceptance cases

| Test | Expected |
| --- | --- |
| Previously blocked investor (5 Oct snapshot; later Oct SIPs) | Does not silently reuse 5 Oct if verified historical October source is available; complete archive and transactions reconcile or reveal a specific blocker. |
| Jitendra historical funds (nine 30 Oct NAVs, one 31 Oct Saturday NAV) | Saturday source NAV not rejected simply because it is Saturday; the archived units/values and actual October transactions must still reconcile. |
| Repeated morning files with the same genuine NAV date | Identical frozen holdings do not conflict just due to different file hashes; different scheme-level balances MUST block. |
| Manual PMS ₹5,00,000 opening, ₹1,00,000 added, ₹20,000 withdrawn, ₹5,98,000 closing | Correct **₹18,000** absolute gain (subject to complete dated statements and cash ledger). |
| Mixed MF/PMS portfolios | Both original dated sources included only when each independently reconciles. Missing PMS original archive must BLOCK a Fundbazaar-only close. |
| SIP paused/cancelled/failed | Does not produce fictitious fresh capital; confirmed purchase is included once. |
| Sunday **8 Nov 2026** Muhurat exchange trade | Actual equity execution is November activity; it cannot enter October. No fabricated Sunday mutual fund NAV. |
| Weekend/holiday with no imported new NAV | Do not relabel prior NAV as new market-date NAV. Retain date and surface real source gaps. |
| Existing published September report | No silent rewriting of its reported corpus. |
| All 54 investors October scan | Each result has an explainable Ready/Review/Blocked status, including historical source linkage and actual movement exceptions. |

## Evidence and limitations

Local checks completed in the prepared source tree:

- `npm run qa`: **577 passed**, zero warnings and failures.
- New unified market-calendar and multi-source fixture: **59 passed**.
- Previous historical source: **44 passed**; Manual PMS: **38 passed**; cutoff: **45 passed**; SIP: **17 passed**; system-wide integrity: **18 passed**, plus report/AMFI recovery fixtures.
- JavaScript syntax checks on changed modules passed.

**Not yet performed:** a full Next.js production build (the provided source workspace lacks installed `node_modules`), live official AMFI network validation, Firebase staging/production integration, or a real 54-investor end-to-end audit. Do not equate fixture green with release proven in production.

**Deliberate safety restrictions:** No synthetic NAV for closed markets or date backdating; incomplete, ambiguous or unverified source data remain blocked. A special equity trading day is not proof of MF NAV publication. Simple Manual Investment templates without original dated PMS valuation evidence cannot be silently promoted to a complete PMS month-end. Other broker/instrument sources beyond Fundbazaar and the supported dated Manual PMS archive require their own verified closing sources before automatic mixed-source approval.

## Troubleshooting

If the affected investor still shows the old snapshot after installing, open the month-end integrity scan and eligibility response. The application should now surface a concrete failure (source missing, dated holdings mismatched, later confirmed transaction, missing PMS original, source version conflict, original import voided, or exceptional NAV not verifiable). Collect the **investor ID, reporting month, source dated valuation IDs, code and message** from the staging API response; do not upload old files repeatedly without finding the missing source.

Reference: [NSE exchange calendars and holiday communications](https://www.nseindia.com/resources/exchange-communication-holidays). Fund house and AMFI NAV records remain separate from exchange trading calendars.
