# GrowVest v0.33.2 - Multi-Investor Manual Portfolio Excel

## Purpose

Portfolio Administration now supports one Manual Portfolio Excel workbook containing holdings for multiple GrowVest investors.

Use:

`Portfolio Administration -> Bulk Manual Portfolio -> Multi-Investor Template`

The existing investor-specific Manual Portfolio Excel remains available on an individual Investor Portfolio Administration page.

## Workbook shape

Use the `Investor_Portfolios` sheet and repeat the investor identity on every holding row.

Recommended identity columns:

- Investor Client Code
- Investor Name
- PAN

Holding columns remain aligned with the existing Manual Portfolio importer:

- Investment Type
- Investment Name
- Provider
- Investment Mode
- Folio / Account No
- ISIN
- Symbol
- Exchange
- Units / Quantity
- Average Buy / Purchase NAV
- Invested Amount
- Current NAV / Rate
- Current Value
- Valuation Date
- Monthly SIP
- Goal / Bucket List
- Notes

## Investor matching

GrowVest resolves each row before import.

Priority / safety:

1. Investor ID, when supplied
2. PAN
3. Client Code
4. Exact unique Investor Name

PAN, Client Code and Investor ID are treated as strong identity. Conflicting strong identities block the row. An ambiguous name also blocks the row. GrowVest does not silently choose between investors.

The preview shows the matched GrowVest investor, Client Code, holding count, current value, matching basis and warnings.

## Modes

### Merge / Update Manual Portfolios

For every matched investor in the workbook:

- matching source=Manual holdings are updated;
- new Manual holdings are created;
- omitted existing Manual holdings remain unchanged.

### Replace Manual Portfolios in this file

For every matched investor in the workbook:

- incoming source=Manual holdings are created/updated;
- existing source=Manual holdings missing from the workbook are deleted;
- Fundbazaar, Bajaj Broking, provider ULIP and other imported holdings are not touched;
- investors not present in the workbook are not touched.

## Goal / Bucket List

Goal / Bucket List remains optional. If the supplied goal name exists on that investor, the holding is assigned 100% to that goal. If the goal name is not found, the row remains importable with a review warning, consistent with the existing individual Manual Portfolio importer.

## Validation and limits

- Admin and Super Admin only.
- Preview is required before the UI enables import.
- Identity conflicts, unmatched investors, invalid holding rows and duplicate holding identities are blocking issues.
- Maximum 100 investors per workbook.
- Maximum 2,000 holdings per workbook.
- Maximum file size 12 MB.
- Current holdings are updated; historical transaction ledgers are not created by this workflow.

## Audit and Portfolio Master

Each matched investor receives:

- a per-investor Manual Portfolio bulk-import activity log;
- correlation through a common bulk import ID;
- a fresh Portfolio Master snapshot after the import;
- verified snapshot status when there are no goal warnings, or review-required when goal warnings remain.

A batch-level activity event records the workbook name, mode, investor count and holding count.
