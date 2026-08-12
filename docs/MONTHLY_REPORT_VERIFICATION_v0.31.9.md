# Monthly Report Verification & Auto-Generation — v0.31.9

## Purpose

Monthly Reports now use the verified Portfolio Master as the financial source of truth. The existing Create → Review/Edit → HTML Preview → Publish workflow remains unchanged.

## Verification gate

Before the Portfolio Data step is considered complete, GrowVest checks:

- verified portfolio snapshot availability on or before the report data date;
- snapshot and provider/source freshness;
- opening snapshot availability for monthly movement calculation;
- new and exited holdings compared with the opening snapshot;
- Goal/Bucket List allocation validity (General Wealth / Unassigned remains valid);
- monthly investment transaction availability for fresh-money/withdrawal separation.

Data up to 7 days old is considered fresh. Data older than 7 days is flagged for staff review. Data older than 31 days blocks report completion until Portfolio Master is refreshed.

For a current/future reporting period, verification is capped at today's date so the system never treats a future month-end as a stale-data reference.

## Auto-generated financial movement

Where an opening verified snapshot exists:

Closing Portfolio = Opening Portfolio + New Money - Withdrawals + Investment Movement

Investment movement is therefore separated from fresh investment and withdrawals. If no opening snapshot exists, GrowVest does not infer investment gain from an unknown opening corpus.

## Review acknowledgement

Warnings such as stale-but-usable data, no opening snapshot, or new/exited holdings require Admin/Advisor review confirmation before proceeding. Confirmation is stored on the working report with user and timestamp.

## Historical safety

Published reports remain frozen/versioned. Refreshing Portfolio Master does not silently rewrite an already published report. A staff user must explicitly refresh verification on an existing working report.
