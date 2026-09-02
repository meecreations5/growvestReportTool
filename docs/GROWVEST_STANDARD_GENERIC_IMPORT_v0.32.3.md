# GrowVest Standard / Generic Portfolio Importer — v0.32.3

## Purpose

v0.32.3 adds a universal fallback importer for portfolio providers that do not yet have a dedicated GrowVest adapter. Dedicated Fundbazaar, Bajaj Broking and ULIP importers remain preferred because they understand source-specific semantics. The generic importer is for standardized/manual portfolio feeds and provider exports whose columns can be mapped safely.

## Daily Admin Flow

1. Open **Portfolio → Daily Portfolio Update**.
2. Upload one or more XLS, XLSX or CSV files.
3. GrowVest first tries the dedicated source adapters.
4. If the file matches the official GrowVest Standard workbook, it is parsed automatically.
5. If a generic portfolio table is detected, choose **Map Columns**.
6. Confirm what the rows represent, map the provider columns, optionally set defaults, and save the layout profile.
7. Confirm/resolve the investor only when PAN, Client Code or a verified external mapping does not identify the investor automatically.
8. Click **Update Ready Portfolios**.

## Official Standard Workbook

Download from the Daily Portfolio Update page or use:

`public/templates/GrowVest_Standard_Portfolio_Import_v0.32.3.xlsx`

The workbook has these operational sheets:

### Portfolio_Holdings

One row per current investment position. Important fields include:

- Investor Name
- PAN
- Client Code
- Investment Type
- Investment Mode
- Provider / Broker
- Investment Name
- Symbol
- ISIN
- Account / Folio / Policy No.
- Exchange
- Purchase / Start Date
- Units / Quantity
- Average Purchase NAV / Rate
- Invested Amount
- Current NAV / Rate
- Current Value
- NAV / Valuation Date
- Maturity Date
- Goal / Bucket List
- Notes

For each holding, provide an **Investment Name** or stable identifier (Symbol / ISIN / Account reference). The minimum financial requirement is **Current Value**, or both **Units / Quantity + Current NAV / Rate**.

### Transactions

Optional transaction history. Supported fields include:

- Investor Name / PAN / Client Code
- Investment Type / Mode
- Provider / Broker
- Investment Name / Symbol / ISIN / Account Reference
- Transaction Date
- Transaction Type
- Transaction / Order ID
- Transaction Units / Quantity
- Transaction NAV / Rate
- Transaction Amount
- Notes

A stable Transaction / Order ID is recommended when the provider supplies one because it improves idempotent transaction matching.

## Supported Investment Types

- Mutual Fund
- Direct Equity / Delivery
- ULIP
- PMS
- Bond
- Fixed Deposit
- Gold
- Real Estate
- Other

Intraday trading should continue through the dedicated trading/Bajaj workflow rather than the generic long-term portfolio importer.

## Generic Column Mapping

For an unknown provider spreadsheet, GrowVest scans the workbook for a likely portfolio table. If enough fields are recognized but the layout is not a dedicated source format, the file is marked **Map columns** instead of being guessed into Portfolio Master.

Admin can map:

- Investor identity
- Investment classification and mode
- Provider/broker
- Instrument identifiers
- Holdings and valuation fields
- Transaction fields
- Maturity date
- Goal / Bucket List
- Notes

Admin can also set default Investment Type, Investment Mode, Transaction Type and Provider when those values are not present in the source file.

### Mapping Profile Memory

When **Remember this column layout** is enabled, the mapping is stored server-side in `portfolioImportMappingProfiles`.

Auto-application requires the same normalized header structure and sheet identity. Investor matching remains independent; a saved column mapping never grants or transfers investor ownership. A ready generic file that used a saved profile exposes **Review Mapping**; Admin can update the mapping or turn off future auto-application for that profile.

Browser access to mapping profiles is denied by Firestore rules. The authenticated server import API manages them.

## Investor Matching

Generic imports use the following hierarchy:

1. Existing verified GrowVest Standard external mapping
2. PAN exact match
3. GrowVest Client Code exact match
4. Exact normalized investor-name suggestion requiring review when no stronger identity exists
5. Similar-name manual review
6. Ownership conflict / unmatched

One external identity cannot silently move between GrowVest investors.

## Goal / Bucket List Behavior

Goal assignment is planning metadata and is not overwritten by daily source values.

- Existing position → existing Goal/Bucket assignment is preserved.
- New position with an exact valid Goal/Bucket name → GrowVest can assign it at 100%.
- New position with no goal → General Wealth (Default).
- Unknown/ambiguous goal name → position remains unassigned and is marked for goal review.
- Reprocess retains the original position allocation.
- Correct Investor does not copy the old investor’s Goal/Bucket assignment to the new investor.

## Complete Snapshot Safety

The official `Portfolio_Holdings` standard workbook is treated as a complete current-holdings snapshot.

For arbitrary provider layouts, **Treat this provider file as a complete current-holdings snapshot** is OFF by default.

If enabled, positions from the same represented provider that are missing from the new current-holdings file may be marked exited. Only enable this when the provider file is known to contain the complete current portfolio.

Transaction-only files never zero or exit current positions.

## Duplicate and Recovery Controls

Generic imports participate in the same Portfolio Import Recovery framework:

- Exact duplicate file fingerprint → skipped
- Reprocess → idempotent update using stable position/transaction identities
- Correct Investor → remove/reconcile the import from the wrong investor and apply it to the selected correct investor
- Rollback → restore the pre-import state when the recovery journal is still safely reversible
- Published Monthly Reports remain frozen/versioned

Generic transaction matching prefers a supplied Transaction / Order ID. When absent, GrowVest uses provider + instrument/reference + transaction date/type + amount/rate/quantity as a deterministic fallback identity.

## Current Position Matching

Existing GrowVest Standard positions are reconciled using the strongest available stable identity:

1. Provider + Product Type + Account/Folio/Policy reference
2. ISIN
3. Symbol + Exchange
4. Normalized Investment Name

Provider/account references are checked for cross-investor ownership conflicts before commit.

## Monthly Reports and Investor Portal

Generic portfolio positions flow through the normal Portfolio Master and verified snapshot process. Therefore they can appear in:

- Investor Portal Portfolio
- Goal/Bucket progress
- NAV/current-rate and valuation-date views where supplied
- Asset allocation
- Daily snapshots
- Monthly Portfolio Verification
- Monthly Reports generated from the verified snapshot

## UAT Checklist

1. Upload the official standard workbook with one investor and 2–3 holdings.
2. Confirm automatic recognition as **GrowVest Standard Import**.
3. Verify PAN/Client Code investor matching.
4. Import and confirm positions in Investor → Portfolio.
5. Assign one position to a Goal/Bucket List.
6. Upload a newer standard workbook and confirm the Goal assignment persists.
7. Upload the exact same file again and confirm it is skipped as duplicate.
8. Upload an unknown provider XLS/XLSX/CSV and confirm **Map Columns** appears.
9. Map the provider layout and enable **Remember this column layout**.
10. Upload a second file with the same sheet/header layout and confirm the mapping is auto-applied.
11. Test transaction import with a Transaction / Order ID and verify reprocessing does not duplicate it.
12. Test Reprocess, Correct Investor and Rollback on a non-production test investor.
13. Confirm Investor Portal and Monthly Report show the imported positions through Portfolio Master.
14. Verify a transaction-only file does not mark holdings exited.
15. Verify unknown provider layouts do not mark missing holdings exited unless complete-snapshot mode was explicitly enabled.
