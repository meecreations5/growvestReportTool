# Fundbazaar Reset Bootstrap Fix - v0.33.2

## Issue

After `Full Portfolio Reset`, GrowVest correctly removed the old Investor mapping, fingerprint and import history, but Unified Import still rejected a readable Fundbazaar `Client Wise Valuation Report.xls` / HTML-XLS export before the Investor could be mapped again.

The file was already being parsed successfully (holdings, transactions, invested value and current value were detected), but the adapter was marked unsupported because the normal daily-update rule requires a real `.xlsx` workbook.

## Corrected behavior

- `Client Wise Valuation Report.xlsx` remains the standard Fundbazaar format for normal ongoing daily updates.
- A readable Fundbazaar Client Wise Valuation `.xls` / HTML-XLS file is allowed only as a bootstrap import when the selected Investor has a completely blank portfolio state.
- This includes a newly created Investor or an Investor that has completed `Full Portfolio Reset`.
- The file is parsed and can proceed through the normal Investor mapping/review flow.
- At commit time, GrowVest re-checks the selected Investor and rejects the legacy file if any prior portfolio state/history remains.
- The current preview batch is excluded from that state check so the newly uploaded bootstrap file does not block itself.
- After the first successful bootstrap import, subsequent Fundbazaar updates require `.xlsx` again.
- Portfolio Ledger remains unsupported.

## Expected UI after reset

When the same readable `.xls` / HTML-XLS valuation report is analysed after Full Portfolio Reset, it should no longer show the red format rejection. It should be eligible for mapping/confirmation and then `Update Ready Portfolios`.

A warning explains that the legacy file is accepted for the blank/reset first upload only and that future Fundbazaar updates should use `.xlsx`.

## QA

The dependency-free release audit now includes checks for the bootstrap-only parser flag and the server-side blank/reset portfolio validation.
