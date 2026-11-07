# Release Validation — v0.34.34

Scope: Monthly Wealth Review reconciliation gate for production report generation and delivery.

Validation targets:
- Same-date snapshot revisions select the latest verified revision and trigger report re-review when the saved report is older.
- Completed-but-not-published Monthly Reviews re-check Portfolio Master and reopen for review when month-end financial facts changed.
- Same-date snapshot revision advances are detected through `sourcePortfolioSnapshotVersion`.
- Financial-summary mismatches are detected even if snapshot identity is unchanged.
- Completion re-reads the verified report source immediately before completing the review.
- Stale reports are blocked server-side before final PDF generation.
- Stale reports are blocked server-side before publish/send.
- Published investor versions remain frozen and require an explicit working revision for later corrections.
- Previous month closing -> next month opening continuity remains preserved.
- Existing Fundbazaar multi-file upload, SIP reconciliation, PMS withdrawal, portfolio progress and PDF encoding behavior remain intact.
# Release Validation v0.34.34

## Monthly Review Reconciliation Gate

- Monthly Review completion re-reads Portfolio Master immediately before completion.
- A changed snapshot id, snapshot version, or financial summary refreshes the report and requires Advisor review again.
- Completed-but-not-published reports automatically reopen for financial review when the month-end Portfolio Master facts change.
- Final PDF generation is blocked when the saved Monthly Review snapshot revision is stale.
- Publish/send is blocked when the saved Monthly Review snapshot revision is stale.
- Published investor versions remain immutable; corrections continue through the controlled revision workflow.
- Same-date month-end revisions prefer the highest snapshotVersion / latest revision.

## Target regression

31 Oct snapshot revision 1 = approximately Rs 47,954, later revision 2 = Rs 95,801. The October report must use revision 2 and must not generate/publish from revision 1.
