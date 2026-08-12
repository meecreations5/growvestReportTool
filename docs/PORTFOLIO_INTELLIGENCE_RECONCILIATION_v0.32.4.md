# GrowVest v0.32.4 — Portfolio Intelligence & Reconciliation

## Purpose

v0.32.4 adds an intelligence layer above Portfolio Master. It does not replace Fundbazaar, Bajaj, ULIP or Generic imports. Each verified snapshot is compared with the previous verified snapshot and the investment transactions recorded between them.

## Reconciliation statuses

- `verified` — no actionable reconciliation exception detected.
- `needs_review` — cash-flow classification or quantity movement needs staff review.
- `mismatch` — duplicate holding identity or units/quantity × NAV/rate mismatch detected.
- `stale` — one or more sources are older than the configured stale threshold.
- `missing_source` — valuation/source date is unavailable.
- `ownership_conflict` — reserved for source identity ownership conflicts blocked by import matching.

## Snapshot intelligence

Every new portfolio snapshot stores:

- new holdings compared with the previous snapshot;
- exited holdings;
- partial quantity reductions;
- unexplained reductions without matching redemption/sale activity;
- fresh investment, withdrawals, internal transfers and cash flows needing review;
- realised P&L available from recorded sale transactions;
- portfolio/valuation movement after known cash flows;
- NAV/current-rate movement by holding;
- units/quantity × NAV/current-rate reconciliation;
- duplicate active holding identities;
- source freshness including oldest and latest valuation dates;
- Goal/Bucket unassigned holdings;
- largest holding, asset-class and Goal concentration indicators.

Concentration indicators are informational only. GrowVest does not automatically execute rebalancing or classify a portfolio as suitable/unsuitable from concentration alone.

## Admin workflow

Open **Portfolio → Daily Portfolio Update → Portfolio Reconciliation**.

Admin/Advisor can filter:

- Exceptions
- Mismatch
- Needs Review
- Stale/Missing
- All

Each investor row shows portfolio value, snapshot date, reconciliation status, new/exited/unassigned holdings and issue count. Expanding a row shows source freshness, valuation mismatch counts and concentration indicators.

## Investor Portal

Investor Portfolio now includes:

- simplified data-verification status;
- month-on-month portfolio comparison;
- fresh investment and withdrawals separated from investment movement;
- new/exited/partial holding changes;
- largest holding and asset-class concentration indicators;
- NAV/price changes since the previous verified snapshot.

Operational mismatch details remain staff-facing. If a source is under review, the investor sees a neutral message that GrowVest is reviewing the update while the latest verified values remain visible.

## Monthly Report integration

The Monthly Report verification gate now also checks snapshot reconciliation.

- `mismatch` / `ownership_conflict` → block completion until resolved.
- `needs_review`, `stale`, `missing_source` → review warning.
- `verified` → pass.

The existing Create → Review/Edit → HTML Preview → Publish workflow is unchanged.

## Freshness thresholds

Default operational thresholds:

- 0–3 days: fresh
- 4–7 days: aging
- 8–31 days: stale
- more than 31 days: critical stale

These values are defined centrally in `src/lib/constants/portfolio.js`.

## UAT checklist

1. Create at least two verified snapshots for one investor on different dates.
2. Confirm Portfolio Intelligence shows the prior snapshot comparison.
3. Add a new holding and create a new snapshot; confirm `newHoldings` increments.
4. Remove/exit a holding through an authoritative flow and create a snapshot; confirm `exitedHoldings` increments.
5. Reduce units/quantity with a matching sale/redemption transaction; confirm partial exit is detected without an unexplained-quantity warning.
6. Create a test mismatch between current value and quantity × rate above tolerance; confirm status becomes `mismatch`.
7. Use an old NAV/valuation date; confirm `stale` status.
8. Confirm Admin Portfolio Reconciliation lists the investor in the appropriate exception filter.
9. Confirm Investor Portal shows simplified Portfolio Intelligence and does not expose internal mismatch diagnostics.
10. Create a Monthly Report from a mismatch snapshot and confirm reconciliation blocks completion.
11. Confirm an ordinary verified snapshot passes Monthly Report verification.
12. Confirm existing imports, recovery, coverage and Goal/Bucket assignments still work unchanged.

## Deployment

No new Firestore collection, rule or composite index is required by v0.32.4. Existing portfolio snapshot and transaction indexes are reused.
