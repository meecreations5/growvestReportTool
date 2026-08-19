# GrowVest v0.32.9 — Investor Portfolio Bulk Cleanup

## Purpose

This release replaces the earlier source/vendor-centric cleanup concept with an Investor Portfolio cleanup workflow. Cleanup is performed from the selected Investor's **Portfolio** tab and can target one, several, all filtered, or the entire current set of holdings.

## Admin workflow

1. Open **Investors → Investor → Portfolio**.
2. Click **Manage Portfolio**.
3. Select individual holdings, **Select Visible**, or **Select All Portfolio**.
4. Click **Delete Selected**.
5. Review the cleanup impact.
6. Choose whether to remove only related imported transactions or all related transactions.
7. Enter a reason and type `DELETE`.
8. Confirm the cleanup.

Only Admin and Super Admin can execute this action.

## What is removed

- Selected current `portfolioPositions`.
- Related imported `investmentTransactions` by default.
- Optional related manual transactions when the stronger transaction cleanup option is explicitly selected.
- ULIP policy summary records are recalculated; a policy record is removed only when all of its underlying selected fund positions are removed.
- Recovery journals for import files affected by cleanup are invalidated so an older rollback cannot silently restore deleted holdings.
- Exact-file duplicate locks are released when all current holdings from an affected import file are removed.
- When the **entire current investor portfolio** is deleted, all portfolio fingerprints for that investor are released so a valid historical/current source file can be uploaded again.

## What is preserved

- Investor Profile and KYC.
- PAN/Aadhaar configuration.
- Goals and Bucket Lists themselves.
- Documents.
- Meetings/MOMs.
- Investor Actions.
- Trading activity unless explicitly handled through its own workflow.
- Historical snapshots from earlier dates.
- Already-published Monthly Reports and their version history.
- External investor/source mappings.

Deleting a holding removes its current Goal/Bucket contribution but does not delete the Goal or Bucket List.

## Audit and current-state rebuild

Every cleanup writes an `activityLogs` record containing the reason, selected holding summary, removed value, transaction count, affected import files, and released file-lock count.

After cleanup GrowVest rebuilds today's portfolio snapshot with `verificationStatus: corrected`. This recalculates:

- current portfolio value,
- invested amount,
- gain/loss,
- monthly SIP,
- Goal/Bucket corpus,
- asset/product allocation,
- reconciliation intelligence.

## Duplicate/re-upload behaviour

A partial cleanup does **not** blindly release every file fingerprint. A fingerprint is released only when all current holdings represented by that import file were removed.

If the entire current portfolio is cleaned, all exact-file fingerprints linked to that investor are released. This is intentional so Admin can rebuild the portfolio cleanly from the correct Client Wise Valuation or other valid source file.

## Recommended UAT

1. Select two Fundbazaar funds and delete them with imported transactions only.
2. Confirm the remaining holdings and Goal progress recalculate.
3. Confirm an already-published Monthly Report is unchanged.
4. Select all current holdings and perform full portfolio cleanup.
5. Confirm current portfolio value becomes zero while the Investor Profile remains intact.
6. Re-upload the correct Fundbazaar `Client Wise Valuation Report.xlsx` and confirm it is accepted after full cleanup.
7. Test one ULIP policy with multiple funds: delete one fund and confirm the policy remains; delete the last fund and confirm the policy summary is removed.
8. Confirm the cleanup activity appears in the audit/activity history.
