# Monthly Wealth Review Continuity — v0.34.33

## Reporting rule

A Monthly Wealth Review represents one completed calendar month. For October 2026 the cutoff is 31 Oct 2026 and the review is normally prepared during 1–5 Nov 2026.

## Opening baseline

For an established monthly-review chain, the previous completed Monthly Wealth Review's frozen closing corpus is the preferred opening value for the next review. This creates the invariant:

`September closing = October opening`, `October closing = November opening`.

The first Monthly Wealth Review may still use the Opening Wealth Review snapshot when the Opening baseline was established earlier in the same month.

## Closing snapshot

The closing value comes from the verified Portfolio Master snapshot on or before the report cutoff. Snapshot selection now orders same-date records/revisions by `snapshotVersion`, then update/capture timestamp, so the final verified revision wins.

Portfolio snapshots use a deterministic investor/date document and can be revised during the day. Draft reports store `sourcePortfolioSnapshotVersion`. If the same month-end snapshot is revised after the draft is created, reopening the draft automatically refreshes its portfolio facts before completion.

## Cash flows and performance

Only confirmed portfolio cash flows affect monthly performance:

`Investment Gain/Loss = Closing Portfolio - Opening Portfolio - Money Added + Money Withdrawn`

Active Monthly SIP is a recurring commitment and is not automatically treated as Money Added.

## Freeze rule

Completed/published reports preserve their financial facts. Later portfolio updates do not silently rewrite a completed Wealth Review. A historical correction should be handled by an explicit reopen/recreate workflow.
