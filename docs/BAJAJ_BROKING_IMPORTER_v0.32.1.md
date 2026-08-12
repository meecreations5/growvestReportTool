# GrowVest v0.32.1 — Bajaj Broking Importer

## Purpose

v0.32.1 adds Bajaj Broking as an enabled source in **Daily Portfolio Update** while keeping long-term Delivery holdings separate from Intraday trading.

## Supported import paths

### Bajaj Delivery Holdings

The importer recognises a Bajaj/GrowVest holdings table using a safe combination of fields such as:

- Investor/Client Name, PAN, Client Code/UCC (when supplied)
- Stock/Security/Instrument Name or Symbol
- ISIN (when supplied)
- Exchange
- Quantity
- Average Buy/Cost Rate
- Invested/Cost Value (or derives Quantity × Average Buy Rate)
- Current/LTP/Market Rate
- Current/Market Value (or derives Quantity × Current Rate)
- Unrealised P&L / Return %
- Valuation/Price/As-On Date
- Optional Goal / Bucket List

Delivery holdings update `portfolioPositions` with `productType = stock_delivery`. Existing Goal/Bucket List allocation is preserved across later Bajaj uploads. A requested goal from an import is applied only for a new holding when it matches exactly one existing GrowVest goal; otherwise the holding stays General Wealth and is flagged for review.

v0.32.1 deliberately does **not** mark an existing Bajaj holding as exited only because it is absent from an unverified broker layout. Explicit/manual stock-sale tracking remains available. After one real Bajaj Holdings export confirms that the report is always a complete holding set, exit-by-omission can be enabled safely. An empty or unrecognised report never clears the portfolio.

### Bajaj Intraday / Trade Book

The importer supports two safe shapes:

1. One closed trade per row with Buy Qty/Rate and Sell Qty/Rate.
2. Side-wise BUY/SELL rows that can be paired by Trade Date + Exchange + Symbol/Security.

It can capture Brokerage, STT, Exchange/Transaction Charges, GST, Stamp Duty, Other Charges, Total Charges, Gross P&L, Net P&L and Trade/Order ID when supplied.

Side-wise rows are auto-imported only when matched buy and sell quantities are balanced. Any unmatched quantity blocks automatic commit and is shown as a review warning rather than being guessed.

Intraday trades are written to `tradingTransactions` and monthly aggregates to `tradingMonthlySummaries`. They are not written to long-term `portfolioPositions` and therefore do not automatically increase Goal/Bucket List corpus.

## Investor matching

The matching hierarchy is:

1. Existing verified Bajaj external mapping.
2. PAN match to the Investor Profile.
3. Explicit Bajaj/Broker client-code profile match if configured.
4. Exact/similar investor-name suggestion requiring confirmation.
5. Manual investor selection.

Once confirmed, GrowVest saves the available Bajaj identity keys (name/PAN/client code) for future automatic matching. Conflicting identity mappings are blocked.

## Duplicate and recovery controls

A SHA-256 file fingerprint prevents the exact same file from being imported twice. Bajaj imports participate in the existing v0.31.7+ recovery journal, including Delivery positions, Intraday trades, monthly trading summaries, external identity mappings and the file fingerprint.

Admin/Super Admin can therefore use **Reprocess**, **Correct Investor**, and **Rollback** for Bajaj imports. Recovery is blocked if newer portfolio/trading changes have touched the same records.

## Portfolio and Monthly Report integration

- Delivery holdings appear in the Investor Portfolio and can be linked to Goals/Bucket Lists.
- Current rate/valuation date and previous valuation values are retained for portfolio movement visibility.
- Intraday activity appears in the separate Trading section.
- Monthly Reports continue to source long-term corpus from verified portfolio snapshots and trading performance from the separate monthly trading summary.

## Supported file types

Daily Portfolio Update accepts `.xls`, `.xlsx`, and `.csv`. Detection uses workbook contents/column signatures rather than filenames.

## Important production validation

GrowVest currently has no real Bajaj Broking export sample supplied by the project owner. v0.32.1 therefore includes flexible aliases for common holdings/trade-book terminology and a fully testable GrowVest Bajaj format, but **the exact Bajaj production export mapping must be verified against one real Bajaj Holdings file and one real Trade Book/P&L file before production sign-off**.

The importer intentionally refuses ambiguous/unbalanced structures rather than silently importing guessed data.

## UAT checklist

1. Add the test investor PAN in Investor Profile.
2. Upload a Bajaj Delivery workbook containing one investor.
3. Verify source/type detection, PAN/client-code display and investor match.
4. Commit and verify Delivery positions under Investor → Portfolio.
5. Assign one stock to a Goal/Bucket List.
6. Upload a newer Delivery report and verify the goal remains assigned.
7. Upload the exact same file again and verify it is skipped as a duplicate.
8. Upload a Bajaj Intraday workbook and verify trades appear under Trading, not long-term corpus.
9. Verify monthly trading totals for turnover, charges, gross P&L and net P&L.
10. Generate a Monthly Report and verify Delivery holdings enter the portfolio snapshot while Intraday P&L appears only in the Trading summary.
11. Test Reprocess/Correct Investor/Rollback on a test Bajaj import.
12. Verify an investor account can read only its own Delivery holdings and Trading records.
