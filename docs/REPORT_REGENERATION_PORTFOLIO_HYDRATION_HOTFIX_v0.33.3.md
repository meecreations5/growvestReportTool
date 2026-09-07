# GrowVest v0.33.3 - Monthly Report Regeneration / Portfolio Hydration Hotfix

## Issue

After deleting a Monthly Report and creating the same reporting month again, the new draft could reach **Portfolio Data** with:

- Monthly Portfolio Verification = `Checking`
- Snapshot = `not available`
- Holdings / Transactions / New holdings / Exited holdings = `0`

This did not necessarily mean Portfolio Master data had been deleted.

## Root cause 1 - saved draft route remount

A new report is first created without a report ID. When the draft is saved, GrowVest changes the route to `/reports/{id}/edit`. The Report Builder intentionally avoided automatically refreshing Portfolio Master for existing reports so historical working reports would not be silently rewritten.

That guard was too broad. If the first save happened before Portfolio Master hydration finished, the newly saved empty draft came back with `portfolioVerification.status = pending`, but the existing-report guard prevented the hydration request from running.

The hotfix now distinguishes an established report from an **empty recreated draft**. An empty draft with no Portfolio Snapshot / import source and no meaningful portfolio facts automatically hydrates Portfolio Master after the route remount.

`corpusTouchedRef` is also initialized from the actual persisted financial facts instead of being set to `true` for every existing report. Therefore **Refresh verification** can populate a genuinely empty recreated draft while still preserving established report facts.

## Root cause 2 - month-end file captured after month-end

GrowVest reports are month-based. An August report uses an August 31 cutoff even when prepared during 1-5 September.

Daily Portfolio snapshots are capture-date records. A verified August 31 valuation file uploaded on September 1-5 can therefore be stored in a snapshot whose capture date is after August 31. Previously, a report looked only for a snapshot whose snapshot date was on/before the cutoff and could miss that legitimate month-end valuation.

The hotfix adds a controlled five-day capture grace window. It is used only when no verified snapshot exists on/before the cutoff. A post-cutoff capture is eligible only when:

1. the capture is within five calendar days after the cutoff;
2. the snapshot is verified;
3. dated source freshness / snapshot-position valuation dates exist; and
4. **none of those dated values is after the report cutoff**.

This prevents September market values from being pulled backward into an August report.

When this fallback is used, GrowVest keeps the actual snapshot ID for audit, records the capture date separately, and treats the latest eligible source valuation date as the effective portfolio date shown in report verification.

## Preserved controls

- Deleting a Monthly Report still does not delete Portfolio Master, transactions, Bucket Lists or Profile actions.
- Published/historical report facts are not silently refreshed.
- Existing reports with meaningful portfolio facts retain those facts unless staff explicitly refreshes/corrects the source workflow.
- Full Portfolio Reset behaviour is unchanged.
- Post-cutoff values are never allowed into an earlier reporting month by the grace fallback.

## UAT

1. Delete an August Monthly Report using the controlled Delete Report workflow.
2. Start a new August report for the same Investor.
3. Complete Investor and Reporting Period and continue to Portfolio Data.
4. Confirm Portfolio Verification automatically moves out of `Checking` without requiring a manual page refresh.
5. Confirm Holdings and portfolio values repopulate from the eligible Portfolio Master snapshot.
6. Save the draft, allow the route to change to `/reports/{id}/edit`, and confirm the values remain populated.
7. Reopen the saved draft and confirm established values are not silently overwritten.
8. Where the August 31 valuation was captured on September 1-5, confirm the UI shows the effective snapshot/valuation date plus the separate capture date.
9. Confirm a September-dated valuation is rejected for an August 31 report.
10. Confirm a report remains blocked when no eligible snapshot or month-end grace capture exists.
