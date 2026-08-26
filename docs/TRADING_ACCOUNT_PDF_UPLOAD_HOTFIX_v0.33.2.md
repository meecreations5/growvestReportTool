# Trading Account PDF Upload Hotfix — v0.33.2

## Issue

The Unified Portfolio Import file picker advertised `.pdf` support, but the client-side `selectFiles()` gate still filtered files with an XLS/XLSX/CSV-only regular expression. As a result, a valid Angel One digital DP Transaction Cum Holding PDF was discarded before the server-side Angel One parser could analyse it, and the UI displayed `Choose XLS/XLSX/CSV portfolio reports.`

## Fix

- Unified Import now accepts `.xls`, `.xlsx`, `.csv`, and `.pdf` in both the browser file picker and the client-side selection gate.
- The validation message now explicitly mentions supported digital PDF portfolio reports.
- Existing server-side Angel One PDF detection remains unchanged and continues to reject unsupported/scanned PDF layouts safely during analysis rather than fabricating data.
- Release QA now asserts both the picker `accept` contract and the `selectFiles()` PDF gate so this regression cannot silently recur.

## Expected workflow

1. Open `Portfolio Management -> Daily Portfolio Update`.
2. Select or drag the original Angel One `DP Transaction Cum Holding Statement` PDF.
3. The file remains selected.
4. Click `Analyse Files`.
5. GrowVest detects `Angel One -> DP Transaction Cum Holding Statement` when the PDF matches the supported digital format.
6. Review the suggested investor and confirm mapping before update.

## Validation

`node scripts/qa/release-audit.mjs` -> 122 passed, 0 warnings, 0 failures.
