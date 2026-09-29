# GrowVest v0.34.26 — Simple Manual Investment Folio / Date Rule

## Scope

This release changes only the simplified individual-investor Manual Investment Excel importer. It does not change Fundbazaar, Bajaj Delivery, Trading/F&O, ULIP, Generic imports, or the separate multi-sheet Manual Portfolio Management workbook.

## Expected behavior

1. `Valuation Date` may be blank and is ignored for this simple Manual Excel flow.
2. The file import date becomes the effective Manual valuation/freshness date.
3. Same Investor + same Investment identity + same Folio/Account/Policy No. updates the existing holding.
4. A new Folio/Account/Policy No. creates a new investment.
5. If a newly created holding has a blank `Investment Date`, the import date is stored as Investment Date and Purchase Date.
6. Existing holdings preserve their prior Investment/Purchase Date when a later workbook leaves Investment Date blank.
7. `createdAt` remains preserved for existing holdings.

## Revised Nikhil workbook

The revised workbook contains:

- HDFC Flexi Cap Fund / `MF-ND-001`
- HDFC Flexi Cap Fund / `MF-ND-007`

These are intentionally two separate investments. Both have blank Valuation Date, which is acceptable under v0.34.26.
