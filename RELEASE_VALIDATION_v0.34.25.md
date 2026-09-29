# GrowVest v0.34.25 — Daily Trading / F&O Excel Import

## Scope

This release adds a standard GrowVest Daily Trading Excel adapter for **closed** trading activity while keeping trading separate from the investor's long-term investment portfolio and Bucket List corpus.

### Supported trading instruments
- Equity Intraday
- Futures
- Call Options
- Put Options
- LONG and SHORT closed positions

### Import controls
- One investor per workbook
- One broker per workbook
- Only CLOSED trades are committed in v1
- Invalid/open rows block the import rather than being silently skipped
- Quantity is treated as total units/contracts; Lot Size is used to derive Lots
- Turnover, Gross P&L, Total Charges and Net P&L are calculated and retained at trade level

### Portfolio separation
Trading rows are written to `tradingTransactions`. They do **not** create long-term `portfolioPositions`, do not increase current investment value, and do not enter Bucket List goal corpus.

### Monthly reporting
Monthly trading summaries aggregate closed trading transactions across supported trading sources so Futures/Options activity is not overwritten by a later broker intraday import.

## Excel artifacts
- `public/templates/GrowVest_Daily_Trading_FO_Template_v0.34.25.xlsx`
- `public/templates/GrowVest_Daily_Trading_FO_Filled_Sample_v0.34.25.xlsx`

## QA
Release audit includes dedicated assertions for the new source/report type, parser, preview, commit, trading-account metrics, template links, trading/portfolio separation, and cache/version metadata.
