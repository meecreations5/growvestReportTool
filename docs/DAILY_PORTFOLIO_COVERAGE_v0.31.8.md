# GrowVest v0.31.8 — Daily Portfolio Coverage & Missing Investor Tracking

## Purpose

The Daily Portfolio Update screen now answers the operational question: **which expected investor portfolio reports have been received today, which were applied, which need attention, and which are still missing?**

GrowVest uses verified Fundbazaar external-investor mappings as the expected population. Client-name and PAN mappings are deduplicated to one expected row per GrowVest investor.

## Daily statuses

- **Updated today** — a Fundbazaar report was successfully applied to Portfolio Master today.
- **Received** — a report was received and recognised but is not yet in a terminal imported state.
- **Received · duplicate** — an exact file was received today but safely skipped because its fingerprint was already imported.
- **Needs attention** — the report requires investor confirmation, has a conflict, failed parsing/import, or otherwise needs review.
- **Missing today** — no Fundbazaar report has been matched to that expected investor today.
- **Tracking paused** — Admin/Super Admin intentionally excluded the investor from the daily expected count. The Fundbazaar mapping remains intact.

## Important data-retention rule

A missing daily file **must never** set holdings, units, NAV, or current value to zero. The latest verified Portfolio Master position and snapshot stay available. The coverage screen shows the last Fundbazaar update date and stale-day count.

## Primary Fundbazaar source

The operational primary source is **Portfolio Ledger**. Client Wise Valuation remains supported for backward compatibility, and a valid Fundbazaar report can still satisfy daily receipt coverage.

## Coverage metrics

The page displays:

- Expected
- Received
- Updated
- Need Attention
- Missing
- Completion percentage (`Received / Expected`)
- Paused tracking count

Unmatched files are shown separately because they cannot safely be assigned to an expected investor until mapping is resolved.

## Tracking controls

Admin and Super Admin can pause/resume Fundbazaar daily tracking per investor. This updates the existing Fundbazaar external mappings; it does not remove mapping ownership, portfolio holdings, transactions, snapshots, reports, or Goal/Bucket List assignments.

## Duplicate behaviour

Exact duplicates remain idempotent. v0.31.8 preserves the matched investor identity on a duplicate preview when it can be resolved from the saved mapping/fingerprint, so the file counts as **Received** for daily coverage while still being skipped from Portfolio Master updates.

## Import integration

After a successful import commit, the batch stores current daily coverage metrics including expected, received, updated, attention, missing and completion percentage. The previous batch-only "missing" interpretation is replaced by true daily coverage across all batches processed that day.

## Deployment

No new client-readable Firestore collection or composite index is required by v0.31.8. The coverage endpoint uses the Firebase Admin SDK and existing collections.

Restart after updating:

```bash
rm -rf .next
npm run dev
```

## UAT

1. Open **Admin → Portfolio → Daily Portfolio Update** before uploading anything. All verified, tracking-enabled Fundbazaar investors should appear in Expected; investors without a report today should appear Missing.
2. Upload and analyse one Portfolio Ledger. Coverage should refresh and show that investor as Received/Needs Attention depending on mapping state.
3. Confirm investor mapping and click **Update Ready Portfolios**. The row should become Updated today and Missing should decrease.
4. Upload the exact same Ledger again. It should show Received · duplicate and remain skipped safely.
5. Leave another expected investor without a report. Confirm their latest portfolio value remains visible and is not cleared.
6. Use Pause on a test investor. Expected count should decrease and the investor should move to Paused. Resume should restore them to Expected.
7. Upload a file that cannot be mapped. It should appear in the unmatched exception section and increase Need Attention without being guessed into an investor.
8. Perform Reprocess/Correct Investor/Rollback from Import History and confirm the coverage panel refreshes afterward.
