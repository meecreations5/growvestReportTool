# Reporting Period, Planned vs Actual Cash Flow — v0.33.2

## Purpose

Monthly Reports are generated for a **Reporting Month**, not for the calendar date on which the Advisor prepares the report. GrowVest defaults a new report to the last completed calendar month. Example: an August 2026 report can be prepared between 1–5 September 2026 and still uses the August reporting period.

## Reporting-period rule

- Reporting Month and Report Year are selected at report creation.
- Completed months use calendar month-end as the portfolio cutoff.
- Current-month reports use the current date as the cutoff.
- Portfolio facts come from the latest verified Portfolio Master snapshot on or before the cutoff date.
- Published Monthly Reports remain frozen historical documents.

## Automatic financial summary

The Advisor does not manually calculate portfolio movement.

- Opening Portfolio Value: verified snapshot before the reporting month.
- Money Added: confirmed external investor contributions during the reporting month.
- Money Withdrawn: confirmed external cash leaving the tracked investment portfolio during the reporting month.
- Closing Portfolio Value: verified Portfolio Master value at the report cutoff.
- Portfolio Gain / Loss = Closing Portfolio Value - Opening Portfolio Value - Money Added + Money Withdrawn.
- Monthly SIP: current verified SIP amount from Portfolio Master.

Manual PMS cash-ledger contributions/withdrawals are included. Internal buys, sells, dividends, charges and account transfers are not treated as new external money.

## Planned Action vs actual transaction

An Investor can raise a request before execution. The request is immediately visible in **Upcoming / Planned Actions**, but it does not change Money Added, Money Withdrawn, Portfolio Gain / Loss or Bucket List corpus.

Typical lifecycle:

1. Planned Action / Requested
2. Under Review / Approved
3. In Progress
4. Completed operationally
5. Awaiting Portfolio Confirmation
6. Confirmed actual movement

Only actual financial activity is allowed into monthly cash-flow calculations.

## SIP treatment

A SIP instruction and a portfolio withdrawal are different concepts.

- SIP started: planned until the debit/investment actually occurs.
- SIP increased: the revised monthly instruction is shown as a SIP change; only actual fresh debit is Money Added.
- SIP reduced: shown as a SIP change, not Money Withdrawn.
- SIP paused: shown as a SIP change, not Money Withdrawn.
- SIP stopped: shown as a SIP change, not Money Withdrawn.
- Mutual Fund Partial Redemption / Full Redemption: external outflow when actual redemption proceeds leave the tracked portfolio.
- Switch Investment: internal movement, not new money and not withdrawal.

The legacy **SIP Funding / Withdrawal** Advisor discussion is not automatically treated as a portfolio withdrawal because it can describe pre-SIP bank funding/transfer discussion rather than money leaving Portfolio Master.

## Trading Account treatment

GrowVest distinguishes a securities sale from an external withdrawal.

- Share sold, proceeds remain in broker/trading account: not Money Withdrawn.
- Share sold and proceeds moved to another tracked investment: Internal Reallocation.
- Trading Account Withdrawal to investor bank: can be recorded as **Trading Account Withdrawal**.
- Trading Account Deposit from investor bank: can be recorded as **Trading Account Deposit**.

A Trading Account Withdrawal request can carry the requested amount, preferred date and broker/account reference.

## Confirming actual external cash movement

When a financial action is marked Completed, the Advisor has two confirmation paths:

### Provider / portfolio transaction already captured

Use this when the provider/broker/import ledger already contains the actual contribution/withdrawal. GrowVest uses that provider transaction for report calculations and does not create a second cash-flow amount.

### Record confirmed external cash movement

Use this only when the actual bank/broker cash movement is verified but no provider transaction is stored in Portfolio Master. The Advisor records:

- Actual amount
- Actual movement date
- Optional bank/broker reference
- Confirmation note

GrowVest requires a verified Portfolio Master snapshot that is not earlier than the confirmed movement date. The confirmed movement is then included in the appropriate Reporting Month as Money Added or Money Withdrawn.

This manual confirmation is opt-in specifically to prevent double counting.

## What Changed This Month

GrowVest automatically derives this section from verified snapshots and confirmed financial activity. It can show:

- New investment
- Investment exited
- SIP increased
- SIP reduced
- SIP stopped
- Money Added
- Money Withdrawn
- Trading Account Withdrawal
- Trading Account Deposit
- Internal reallocation

Planned requests remain in Upcoming / Planned Actions until they become actual.

## Bucket List rule

Every live investment must resolve to a specific Bucket List and/or **General Wealth (Default)**. External cash movements do not silently remap investments. New investments follow the mandatory Bucket List/default allocation workflow.
