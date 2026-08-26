# Manual Portfolio Management - v0.33.2

## Purpose

This upgrade extends the previous multi-investor Manual Portfolio holdings upload into a full internal Manual Portfolio Management workbook for GrowVest. It is designed for manually administered investment/PMS-style accounts while keeping GrowVest's existing Fundbazaar, Bajaj Broking, ULIP and generic provider flows separate.

This is an internal portfolio administration capability. It does not describe GrowVest as a regulated PMS provider.

## Workbook sheets

1. `01_Investors` - reference list of existing GrowVest investors.
2. `02_Portfolio_Accounts` - investor-specific portfolio/PMS-style account master.
3. `03_Holdings` - current holdings snapshot that feeds `portfolioPositions`.
4. `04_Transactions` - buy/sell/SIP/lump sum/redemption/switch/top-up/transfer history in `investmentTransactions`.
5. `05_Cash_Ledger` - opening cash, contributions, withdrawals, purchase debits, sale proceeds, dividend/interest cash, charges and transfers.
6. `06_Income` - dividend, interest and other investment income.
7. `07_Corporate_Actions` - bonus, split, rights, maturity and other corporate-action history.
8. `08_Charges` - brokerage, transaction charges, GST/taxes and other portfolio expenses.
9. `09_Goal_Allocation` - multiple goal allocations per holding with percentage control.
10. `10_Reconciliation` - external statement vs GrowVest system-value reconciliation.
11. `11_Notes` - account review and operating notes with Internal/Investor visibility.

## Investor matching

Rows are matched in the following order of confidence:

- GrowVest Investor ID
- PAN
- Client Code
- exact unique Investor Name

Conflicting strong identifiers are blocked. Ambiguous names are blocked. GrowVest does not guess the investor.

## Account identity

`Portfolio Account Code` is unique only within an investor. Two investors may both use `PMS-01`. All supporting rows retain `investorId`, `accountId` and `accountCode`.

## Current Portfolio Master

`03_Holdings` remains the source of current manually managed investment holdings. It supports Mutual Fund, Delivery Equity, ETF, ULIP, PMS, Bond/NCD, Fixed Deposit, Gold/SGB, Real Estate and Other.

The cash ledger is calculated separately. GrowVest creates/updates one Manual cash position per account (`manualPortfolioCashPosition=true`, `assetClass=Cash`) so uninvested cash is included in current portfolio value and portfolio snapshots.

`05_Cash_Ledger` is the authoritative account-cash movement ledger. Each actual movement should be represented once. When brokerage/taxes are already netted into a Sale Proceeds or Purchase Debit cash entry, the supporting `08_Charges` row should not be entered again as a separate cash movement.

## Performance metrics

Each `manualPortfolioAccounts` record stores calculated metrics:

- invested amount
- current holdings value
- cash balance
- current portfolio value
- unrealized gain/loss
- realized P&L from imported transactions
- net income
- charges
- investor contributions
- investor withdrawals
- absolute return percentage where contribution data is available
- XIRR where usable dated contribution/withdrawal cash flows are available
- holding count
- transaction count
- asset-class allocation (including calculated cash)

Every successful workbook commit also writes an immutable-style account performance row to `manualPortfolioAccountSnapshots`. These account snapshots preserve dated metrics per account so month-wise, financial-year and since-inception performance views can be derived without relying on overwritten current account values.

Portfolio Intelligence also reads Manual Cash Ledger entries between verified snapshots. `Opening Cash`/`Contribution` are treated as external new money, `Withdrawal` as an external withdrawal, and `Transfer In`/`Transfer Out` as internal. Purchase/sale settlement, dividend, interest and charges are not counted again as fresh money, preventing double counting in portfolio movement.

## Goal / Bucket List handling

`09_Goal_Allocation` may split a holding across several GrowVest goals. Total allocation for the same Holding Key cannot exceed 100%.

`General Wealth` / `Unassigned` is treated as the non-goal portion and does not require a Goal definition. Unknown named goals are warnings and are preserved in the supporting allocation ledger but are not attached to the live holding until the goal exists.

If a holding contains a `Goal / Bucket List` value and there is no explicit `09_Goal_Allocation` row for that Holding Key, GrowVest treats the holding goal as a 100% inline allocation.

## Reconciliation

When `System Value` is blank, GrowVest calculates it after holdings and cash are committed. Difference is:

`Statement Value - System Value`

Default tolerance is the greater of INR 5 or 1% of statement value. If Status is blank, GrowVest marks the row `verified` inside tolerance and `mismatch` outside tolerance.

## Merge mode

Merge / Update upserts rows using stable keys and leaves omitted Manual data untouched.

Stable keys include:

- Portfolio Account Code
- Holding Key
- Transaction Key
- Cash Entry Key
- Income Key
- Corporate Action Key
- Charge Key
- Allocation Key
- Reconciliation Key
- Note Key

## Replace mode

Replace Manual Portfolio Data is investor-wide for each investor appearing in the workbook. It removes that investor's existing source=`manual` holdings and Manual Portfolio Management ledgers before recreating them from the workbook.

It does not remove Fundbazaar, Bajaj Broking, provider ULIP or other non-Manual portfolio sources.

## Collections

Existing collections reused:

- `portfolioPositions`
- `investmentTransactions`
- `portfolioSnapshots`
- `activityLogs`

New server-managed collections:

- `manualPortfolioAccounts`
- `manualPortfolioAccountSnapshots`
- `manualPortfolioCashLedger`
- `manualPortfolioIncome`
- `manualPortfolioCorporateActions`
- `manualPortfolioCharges`
- `manualPortfolioGoalAllocations`
- `manualPortfolioReconciliations`
- `manualPortfolioNotes`

## Full Portfolio Reset

Full Portfolio Reset now removes all of the new Manual Portfolio Management collections, including account performance snapshots, in addition to the existing portfolio master, transaction, snapshot, import, mapping, fingerprint, trading, recovery and SIP workflow state. Investor profile/KYC/documents/family/advisor/meetings/Goal definitions and frozen published Monthly Reports remain preserved under the existing reset contract.

## Security

Manual Portfolio Management upload/commit is restricted to Admin and Super Admin through authenticated server API routes. New collections are server-write only in Firestore rules. Investor note reads are restricted to notes explicitly marked `Visibility = Investor`; Internal notes remain staff-only.
