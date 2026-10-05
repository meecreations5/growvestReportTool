# v0.34.27 — Manual PMS Report Freshness

## Problem fixed

Opening/Monthly Wealth Review verification could show either:

- `Source valuation date missing`; or
- `Portfolio source is stale` / blocked because one manually managed PMS holding carried an old or blank valuation date.

This was most visible for investors whose portfolio is maintained through the multi-sheet **Manual Portfolio Management / PMS workbook**.

## Root cause

Portfolio Intelligence previously used each holding's `NAV / Valuation Date` as the freshness gate for every portfolio source. That is correct for provider feeds, but not for a staff-maintained PMS workbook where the operational freshness event is the dated workbook import/account snapshot.

The problem was amplified because all Manual positions were grouped under the same source, so one missing/old holding date could mark the complete Manual source as missing or stale.

## New rule

For `source = manual` positions managed through the Manual Portfolio Management/PMS workbook:

1. **Source freshness = Manual workbook import date / Manual account snapshot date.**
2. The holding's own financial `Valuation Date` is still retained as financial metadata and is not rewritten for this rule.
3. A blank holding valuation date no longer creates a false `Source valuation date missing` warning when the PMS workbook itself was imported recently.
4. An old valuation date does not by itself make the source stale when staff refreshed the Manual PMS workbook recently.
5. The existing freshness controls still apply to the import date:
   - more than 7 days: review;
   - more than 31 days: block.

Therefore a Manual PMS workbook last maintained 36 days ago still blocks. The fix removes **false** missing/stale warnings; it does not disable freshness governance.

## Legacy snapshot support

For positions created before v0.34.27, GrowVest can recover the Manual PMS import date from the existing `manual_pms_<timestamp>_...` bulk-import ID and from `manualPortfolioAccountSnapshots`.

The report-source server path overlays only freshness metadata. It does not change historical portfolio values, NAVs, goal allocations or cash flows.

## Simple Manual Investment Excel

The v0.34.26 rule remains unchanged. The single-investor Simple Manual Investment Excel already uses its Excel import date as the effective Manual source freshness date and treats a new folio/account/policy number as a new investment.
