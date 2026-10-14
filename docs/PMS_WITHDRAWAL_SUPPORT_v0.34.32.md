# PMS Withdrawal Support — v0.34.32

## Issue
The Investor Profile withdrawal workflow filtered eligible positions to `mutual_fund` only. As a result, a live Portfolio Master holding classified as `pms` never appeared when staff or the investor opened **Withdrawals & Planned Cash Needs**.

The server also rejected a PMS position even if it was supplied directly, and the completion workflow assumed every selected position had Mutual Fund SIP instructions.

## Fix
v0.34.32 expands the structured withdrawal workflow to two supported Portfolio Master product types:

- Mutual Fund (`mutual_fund`)
- PMS (`pms`)

PMS positions now appear when they are mapped to the selected Bucket List or General Wealth. Partial and complete withdrawals follow the same Bucket List protection used for Mutual Funds: a complete withdrawal requires the position to be 100% mapped to the selected bucket, and a partial withdrawal cannot consume value mapped to another bucket.

## PMS behaviour
PMS withdrawals are amount-based. If the PMS position also carries units/rate information, units can be recorded during completion, but units are not required for a normal PMS withdrawal.

Mutual Fund SIP controls do not apply to PMS. The withdrawal planner therefore does not show Continue/Pause/Stop SIP for PMS positions, and the completion API does not overwrite PMS SIP fields.

## Completion and reporting
After execution is confirmed, GrowVest:

1. reduces the PMS position value,
2. adjusts cost basis proportionally,
3. preserves/recalculates the selected Bucket List allocation,
4. creates a confirmed withdrawal transaction,
5. rebuilds the verified Portfolio Master snapshot, and
6. exposes the completed withdrawal to Monthly Wealth Review cash-flow calculations.

The existing retry guard (`withdrawalPortfolioApplied`) remains in place so a retry cannot subtract the same withdrawal twice.

## Scope note
This release adds structured withdrawal support for positions explicitly classified as PMS in Portfolio Master. It does not treat every underlying stock/bond inside a manually managed PMS account as a separate PMS redemption instruction.
