# Provider Format Compatibility Hotfix - v0.33.2

## Purpose

This hotfix changes Daily Portfolio Update from an extension-led gate to a report-structure-led compatibility policy for provider reports that GrowVest already understands.

A recognised provider report is accepted when GrowVest can safely identify its report structure and parse the required financial fields. The filename extension remains a useful signal, but it is no longer allowed to reject a valid known report merely because the provider exported the same report as `.xls` rather than `.xlsx`.

Unknown or incomplete layouts still go to review. GrowVest does not guess financial fields.

## Fundbazaar - Client Wise Valuation

Supported for first import and ongoing daily valuation updates when the Client Wise Valuation structure is recognised:

- `.xlsx`
- `.xls`
- Excel-readable HTML-XLS `.xls`
- `.csv`

The old `fundbazaarBootstrapOnly` restriction has been removed. A valid Client Wise Valuation `.xls` is no longer limited to a blank/newly reset Investor.

Duplicate protection remains fingerprint based. A successfully imported identical file is still skipped/protected. A previously failed preview is not treated as a successful import and may be analysed again after the parser is corrected.

Fundbazaar Portfolio Ledger remains intentionally unsupported for Daily Portfolio Update. Use Client Wise Valuation for the authoritative daily valuation snapshot.

## Bajaj Broking - Client Holding Report

The existing native Bajaj delivery-holding adapter remains enabled for spreadsheet reports whose structure matches the known Client Holding Report signatures, including the real production-format report validated during Trading Account Phase 1.

Supported spreadsheet containers include `.xls`, `.xlsx` and `.csv` when the known holding structure is present.

Key structural signals include security/scrip identity plus holding quantity and current valuation fields such as:

- SCRIP NAME / Security Name
- ISIN
- EXCHANGE
- DP HOLDING QTY / TOTAL HOLDING QTY
- CLOSE RATE / Current Rate
- HOLDING VALUE / Current Value

When the provider report does not contain purchase cost, GrowVest keeps cost basis pending rather than inventing invested amount or P&L. Previously known cost basis is preserved when a later holding snapshot updates quantity/value.

## Angel One - DP Transaction Cum Holding

The supplied real Angel One source is a digital DP Transaction Cum Holding PDF. GrowVest continues to support that PDF layout.

This hotfix also supports spreadsheet equivalents of the same DP statement structure in:

- `.xlsx`
- `.xls`
- Excel-readable HTML-XLS `.xls`
- `.csv`

Required safe-detection signals are:

- Angel One / DP Transaction Cum Holding identity signal;
- Investor Name;
- Demat ID / BO ID;
- a DP table that resolves Date, Script/Scrip Name, Description, Debit, Credit, Balance and Amount.

The spreadsheet adapter uses the same accounting semantics as the PDF adapter:

- authoritative closing holdings update Delivery holdings;
- debit/credit movement is stored in `brokerDpTransactions`;
- DP movement is marked as reconciliation activity and does not create intraday/trading P&L;
- purchase cost is not inferred from the DP statement;
- new positions remain cost-basis pending unless reliable cost data already exists elsewhere.

Image-only/scanned PDFs remain intentionally unsupported without OCR.

### Important Angel One XLS limitation

GrowVest has been validated against the supplied Angel One PDF and against a spreadsheet equivalent of that observed DP structure. An actual Angel One portal XLS was not supplied in this compatibility pass. If the portal XLS uses materially different headers/sections, GrowVest will safely mark it for review rather than import incorrect data. Upload one real portal XLS/XLSX and its exact native layout can be added/verified as an additional signature.

## Re-upload after a failed attempt

A failed/unsupported analysis must not become a permanent duplicate lock.

The safe behavior is:

1. File is analysed but fails adapter/format validation.
2. No Portfolio Master update is committed.
3. The failed attempt may appear as an issue until operational history is cleared/resolved.
4. After a parser/adapter fix, the same source file can be analysed again.
5. Only a successful imported fingerprint is treated as an applied duplicate for the Investor/source context.

## Investor matching

Format compatibility does not weaken identity controls. Matching continues to prefer verified mapping/strong identifiers and then safe name suggestions. Ambiguous or conflicting Investor identity remains blocking until staff confirms it.

## Daily update scenarios

### Scenario A - Fundbazaar `.xls` after prior successful import

Expected: `Ready` -> mapped Investor -> update Portfolio Master -> today's snapshot. No blank/reset-only check.

### Scenario B - Fundbazaar `.xlsx`

Expected: same Client Wise Valuation flow as `.xls` when structurally valid.

### Scenario C - Bajaj Client Holding spreadsheet

Expected: update delivery quantity/current value and broker snapshot. Missing purchase cost remains pending.

### Scenario D - Angel One digital PDF DP statement

Expected: closing delivery holding + DP movements; no P&L inferred.

### Scenario E - Angel One spreadsheet DP statement

Expected: same as Scenario D when the DP statement structure is recognised.

### Scenario F - unknown provider/reformatted spreadsheet

Expected: review/mapping or unsupported. No silent import and no financial-field guessing.

### Scenario G - identical already-successful file

Expected: duplicate protection skips/rejects re-applying the same successful source fingerprint.

### Scenario H - same file previously failed before this hotfix

Expected: file may be analysed again; the old failed attempt does not count as a successful duplicate import.

## Compatibility sample

`docs/templates/GrowVest_AngelOne_DP_Statement_Compatibility_Sample_v0.33.2.xlsx`

`docs/templates/GrowVest_AngelOne_DP_Statement_Compatibility_Sample_v0.33.2.xls`

These are GrowVest UAT/compatibility samples based on the observed Angel One DP statement structure. They are not official Angel One portal exports.

## QA

The release audit verifies:

- Fundbazaar Client Wise Valuation no longer carries `fundbazaarBootstrapOnly`;
- Fundbazaar commit accepts recognised XLS/XLSX/CSV/HTML-XLS without a blank/reset-state restriction;
- Angel One DP matrix aliases and parser are present;
- Angel One HTML-XLS path is enabled;
- provider-native spreadsheet/PDF wording is reflected in Unified Import.

Functional parser fixtures additionally verify:

- a Fundbazaar Client Wise HTML-XLS returns `ready` and current value is parsed;
- an Angel One DP HTML-XLS returns `ready`, closing quantity/value are parsed, and DP movements remain separate;
- the Angel One XLSX sample matrix resolves the same report type and closing state.
