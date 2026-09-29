# v0.34.26 — Simple Manual Investment Folio & Date Rules

## Scope

This change applies to the **simple Manual Investment Excel** used from an individual investor's Portfolio Administration screen (`Manual Investments` sheet). It does not change the separate Manual Portfolio Management/PMS multi-sheet workbook.

## Valuation Date

For now, the `Valuation Date` column in the simple Manual Investment Excel is optional and ignored.

GrowVest records the **Excel import date** as the effective Manual valuation/freshness date. This means staff can leave Valuation Date blank without creating a missing-source-date warning after the holding is re-imported.

## New folio = new investment

The existing Portfolio position ID already uses:

- Investor
- Manual source
- ISIN / Symbol / Investment Name
- Folio / Account / Policy Number

Therefore:

- Same investment + same folio/account/policy number → update the existing holding.
- Same investment + a new folio/account/policy number → create a new investment.

For example, `HDFC Flexi Cap Fund + MF-ND-001` and `HDFC Flexi Cap Fund + MF-ND-007` are separate Manual investments.

## Date saved for a newly detected folio

When a new folio/account/policy number is imported:

- `manualImportDate` = import date
- `firstSeenDate` = import date
- `investmentAddedDate` = import date
- `valuationDate` = import date
- Mutual Fund `navDate` = import date
- If `Investment Date` is blank, `investmentDate` and `purchaseDate` = import date
- If `Investment Date` is supplied in Excel, that supplied date is preserved

For an existing folio, a blank Investment Date does not reset the original investment/purchase date.
