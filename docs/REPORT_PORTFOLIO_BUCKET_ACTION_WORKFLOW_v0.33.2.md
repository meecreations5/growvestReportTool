# GrowVest v0.33.2 — Portfolio → Bucket List → Report → Action Workflow

## Purpose

This release makes Bucket List allocation a portfolio invariant and makes Monthly Report generation use verified Portfolio Master data instead of asking the Advisor to re-enter financial facts.

## Mandatory bucket invariant

Every active `portfolioPositions` record must resolve to exactly 100% portfolio allocation:

- one or more existing Bucket List goals; and/or
- the system default bucket **General Wealth**.

There is no operationally unassigned investment.

Examples:

| Specific Bucket List allocation | Stored result |
| --- | --- |
| none | General Wealth 100% |
| Retirement 100% | Retirement 100% |
| Retirement 60% | Retirement 60% + General Wealth 40% |
| Retirement 60% + Education 30% | Retirement 60% + Education 30% + General Wealth 10% |

Allocations above 100% remain invalid and must be corrected.

`General Wealth` is a real system default bucket for portfolio allocation, but it is not inserted into the investor's user-defined Bucket List/goal master.

## Where the rule is enforced

The default bucket is applied or normalized when positions are created/updated through:

- Fundbazaar Client Wise Valuation imports;
- Bajaj Broking delivery holdings;
- Angel One closing/delivery holdings;
- ULIP imports;
- GrowVest Standard/Generic imports;
- Manual single-holding creation/import;
- multi-investor Manual Portfolio Management workbook imports;
- Manual Portfolio Management cash positions;
- import recovery/reprocessing;
- staff Bucket List reassignment; and
- Portfolio Snapshot creation (also migrates legacy empty allocations).

Full Portfolio Reset still preserves investor Bucket List definitions, but deletes holdings and their old allocations. Freshly imported holdings default to General Wealth unless a specific Bucket List is deliberately matched.

## Portfolio snapshot and reporting

Portfolio Snapshot now carries both:

- `goalTotals` — totals for user-defined Bucket List goals; and
- `bucketTotals` — all allocations including General Wealth.

It also records General Wealth corpus and count information.

### Monthly Report generation

When a report is generated from a verified Portfolio Master snapshot, GrowVest automatically fetches and locks the portfolio facts in the Report Builder:

- total portfolio value;
- total invested amount / gain-loss where available;
- monthly SIP;
- holdings and current values;
- asset allocation;
- investment-wise details;
- Bucket List / General Wealth mapping;
- source valuation/freshness information; and
- trading summary separately from long-term corpus.

The Advisor continues to enter/edit the advisory layer: observations, report notes, recommendations, action items, commentary and next steps.

The Advisor cannot silently overwrite verified Portfolio Master values in a Portfolio-Master-sourced report. A source correction must be made in Portfolio Administration/import/reconciliation and the report refreshed.

## Advisor Bucket List change from Report Builder

If the draft report is based on the investor's **latest current Portfolio Snapshot**, an authorised staff user can change an investment's Bucket List from the report screen. GrowVest first updates the live Portfolio Master and creates/refreshed snapshot state, then reloads the report from Portfolio Master.

`General Wealth (Default)` is always available.

If the report is based on a historical snapshot, the allocation selector is read-only. Historical/published report allocations must not mutate current Portfolio Master.

## Published report behaviour

Published Monthly Reports remain frozen historical documents. Later portfolio updates or Bucket List changes do not rewrite an already-published report.

## Investor Take Action

Investor portfolio holdings expose **Take Action**. Supported request scenarios include Invest More, SIP changes, partial/full redemption, switch, Bucket List change, portfolio-information correction and other servicing requests.

The Investor can supply structured details such as:

- requested amount;
- requested monthly amount;
- units/quantity;
- preferred effective date;
- target Bucket List or General Wealth; and
- correction/additional-information details.

Submitting a request creates an `investorActions` workflow record. It does **not** directly alter Portfolio Master, create a broker/provider transaction or overwrite a verified financial value.

Advisor Follow-up displays the structured Investor request, then staff can review, discuss, approve/reject/process and wait for verified provider/manual portfolio data to update the Portfolio Master.

## UAT scenarios

1. Import a new holding without a goal. Confirm position stores General Wealth 100% and no Unassigned warning appears.
2. Assign a holding 100% to Retirement. Confirm General Wealth remainder becomes 0%.
3. Import/manual-allocate Retirement 60%. Confirm General Wealth automatically receives 40%.
4. Generate a Monthly Report from latest Portfolio Master. Confirm financial facts are prefilled/read-only and each investment shows its Bucket List/default bucket.
5. From the latest report draft, change a holding from General Wealth to a real Bucket List. Confirm Portfolio Master changes first and report refreshes.
6. Open a historical report snapshot. Confirm bucket selector is frozen.
7. Investor clicks Take Action → Goal / Bucket List Change. Confirm request captures the target bucket but Portfolio Master stays unchanged until staff/provider workflow completes.
8. Run Full Portfolio Reset. Confirm Bucket List definitions remain, old holding allocations disappear, and newly imported positions default to General Wealth.
