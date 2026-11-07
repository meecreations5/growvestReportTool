# GrowVest v0.34.35 — Automatic Month-End Snapshot Bridge

## Why you still saw the 5 October snapshot

The Monthly Wealth Review reads verified `portfolioSnapshots`. Your newer Fundbazaar statement was saved in `portfolioDatedValuations` but not automatically promoted into a verified monthly closing snapshot. **Refresh Financial Data** only reread the old verified snapshot.

## What this focused update does

- When a monthly report is blocked, **Refresh Financial Data** now attempts an administrator-authorized, on-demand month-end reconciliation using the **newest** available Fundbazaar archived valuation for that month.
- It verifies the original imported file fingerprint, holding/source totals, distinct holdings and actual individual NAV dates, the October transaction ledger, post-NAV cash movements, full source coverage, and competing later archives.
- For weekend NAVs, it attempts a strict ISIN + exact NAV date + NAV amount match against the official AMFI historical text feed; it does not backdate the source or use a third-party NAV in automatic verification.
- Only a fully eligible, Fundbazaar-only monthly close creates an immutable verified `portfolioSnapshots` record with its actual holdings and an approval audit. **No live portfolio positions are overwritten.**
- If the live official AMFI endpoint is unavailable or there is a PMS/other-source overlap, incomplete ledger, duplicate import, or source mismatch, the report stays blocked and shows the **specific exception**. A download or reupload of old NAV files is not requested for routine verified sources.

## Installation

Use **either** the focused patch ZIP on top of the previously supplied `GrowVest_v0.34.35_Unified_Monthly_PMS_Full_Project.zip` release, **or** use the separately supplied cumulative full project ZIP. Do not apply both. The focused patch is **not** compatible with an older v0.34.35 baseline that does not already include the Unified PMS release.

1. Verify your Firestore export/backup completed, and use a **staging Firebase project**.
2. Replace only the seven code/QA files from the patch at identical relative paths.
3. Run `npm ci`, `npm run qa`, `node --no-warnings scripts/qa/amfi-automatic-monthend-fixture.mjs`, `node --no-warnings scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs`, and `npm run build`.
4. Login as an **Admin / Super Admin**. Open Jitendra's October 2026 Monthly Wealth Review → Portfolio Data → **Refresh Financial Data**.
5. When the source and ledger fully reconcile, the verified October closing snapshot should replace the 5 October reference and populate holdings and transactions. Review the October figures before approval or PDF publication.
6. If the status remains Blocked, read the new **specific** error. Record the exact message; it is now the real blocker (e.g., official NAV endpoint unreachable, another source such as Manual PMS, or missing transaction coverage), not a request to manually make up a month-end NAV.

## Finance and operational safety

- October 2026 financial period is October 1–31, regardless of November file-upload date.
- Stopped/paused SIP instructions are not cash flows. Only confirmed transactions are counted.
- Manual PMS portfolios, mixed-source investors, and scheduled all-54-investor monthly closes **are not automatically finalized by this narrow bridge**. Those require a combined authoritative source and a separate auto-reconciliation workflow.
- If official NAV history cannot be obtained, automation **must not** claim the weekend NAV was independently verified. No backdating and no approval by guessing.
- This update has passed local automated fixtures. **Not tested against live AMFI, a production build, or Firebase** in this environment.

## Verification commands

```powershell
npm ci
npm run qa
node --no-warnings scripts/qa/amfi-automatic-monthend-fixture.mjs
node --no-warnings scripts/qa/fundbazaar-historical-monthend-approval-fixture.mjs
node --no-warnings scripts/qa/monthly-close-cutoff-fixture.mjs
npm run build
```

## Change manifest

See `CHANGE_MANIFEST_MONTHLY_AUTO_CLOSE.json` in the ZIP. Only four existing application files changed. Two runtime modules and one fixture were added.
