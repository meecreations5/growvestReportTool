# GrowVest v0.33.1 — Reconciled Portfolio Administration

## Purpose

This release implements the reconciled Portfolio requirement without creating another overlapping workflow. GrowVest keeps both portfolio-administration levels:

1. **Central Portfolio Administration** for selecting multiple investors and cleaning one or more portfolio categories across them.
2. **Individual Investor Portfolio Administration** for detailed cleanup and Manual Portfolio Excel management for one investor.

Daily provider imports continue to use **Daily Portfolio Update**. General migration/master-data uploads continue to use **Bulk Data Upload**.

## Navigation

### Portfolio Overview

`Portfolio Management → Portfolio Overview`

This is the non-destructive monitoring screen. It summarizes current portfolio value, Investor coverage, daily Fundbazaar status, source freshness and portfolio-health exceptions. It does not upload or delete portfolio data.

### Daily Portfolio Update

`Portfolio Management → Daily Portfolio Update`

This remains the provider/platform import workflow. Fundbazaar uses `Client Wise Valuation Report.xlsx`; Portfolio Ledger remains unsupported.

### Central

`Portfolio Management → Portfolio Administration`

Admin/Super Admin can:

- search by investor name or client code;
- filter investors by portfolio category;
- select multiple investors;
- select Fundbazaar, Bajaj Delivery, Trading / Intraday, ULIP, Manual Portfolio, Generic / Other, or Entire Portfolio;
- preview holdings, related imported transactions, trading records and current value affected;
- enter a reason and type `DELETE` before execution.

**Entire Portfolio** means all current holdings plus Trading / Intraday data for each selected investor.

### Individual

`Investors → Investor → Portfolio → Portfolio Administration`

Admin/Super Admin can:

- delete all holdings from a category;
- search/filter and select multiple individual holdings;
- delete all current holdings;
- clean Trading / Intraday separately;
- delete the entire portfolio (all current holdings + trading);
- upload/preview/merge/replace the Manual Portfolio Excel.

## Cleanup categories

Current holding categories are mutually exclusive:

- Fundbazaar
- Bajaj Delivery
- ULIP provider holdings
- Manual Portfolio
- Generic / Other

Trading / Intraday is stored separately and is not treated as Goal/Bucket corpus.

A holding created through Manual Portfolio stays in **Manual Portfolio** even when its investment type is Mutual Fund, Equity or ULIP. This prevents one holding from appearing in more than one cleanup category.

## Safety rules

Bulk deletion continues to use the existing investor cleanup engine. It does not bypass import recovery or duplicate-file protections.

The system preserves:

- Investor Profile
- KYC/PAN/Aadhaar security data
- Investor Documents
- Goals / Bucket Lists themselves
- Meetings and MOMs
- Advisor Follow-ups
- Service Requests
- Published Monthly Reports
- unrelated portfolio categories
- historical activity/audit records

For current holdings, the cleanup engine:

- removes selected positions;
- removes related imported transactions according to the standard cleanup mode;
- recalculates affected ULIP policy summaries;
- invalidates recovery journals that could otherwise restore removed data;
- releases exact-file fingerprints only when the corresponding import is fully removed (or all current holdings are removed);
- creates a corrected latest portfolio snapshot;
- recalculates Goal/Bucket corpus from the remaining current holdings.

Central bulk cleanup does **not** bulk-delete manually entered historical transactions. Those require the stronger individual cleanup option.

## Multi-investor audit correlation

A central deletion run creates a client-generated cleanup batch ID. The batch ID and selected cleanup scopes are stored in each investor's existing portfolio/trading cleanup audit metadata. This keeps the current per-investor audit model while making one multi-investor operation traceable as a group.

## Manual Portfolio Excel

Manual Portfolio Excel remains investor-specific and is not moved to the central page.

`Investor → Portfolio Administration → Manual Portfolio Excel`

Supported behavior remains:

- Merge / Update Manual Portfolio
- Replace Manual Portfolio
- provider-specific Fundbazaar/Bajaj/ULIP holdings untouched
- existing Goal/Bucket allocation preserved when the Excel goal field is blank

## UAT

1. Open **Portfolio → Portfolio Administration** as Admin/Super Admin.
2. Confirm the page lists only investors with current holdings and/or trading data.
3. Select two investors and choose **Fundbazaar**. Preview and confirm that only Fundbazaar holdings/related imported transactions are counted.
4. Cancel the dialog and verify nothing changes.
5. Repeat, enter a reason, type `DELETE`, and confirm. Verify other portfolio categories remain.
6. Select multiple investors and choose **Trading / Intraday**. Verify holdings stay untouched.
7. Select one investor and choose **Entire Portfolio**. Verify current holdings plus trading are removed, while profile/KYC/documents/goals/reports remain.
8. Open an individual investor's Portfolio Administration. Verify category cards, holding-level multi-select and Delete Entire Portfolio.
9. Create or import a Manual ULIP holding and verify it appears only under **Manual Portfolio**, not both Manual and ULIP.
10. After Fundbazaar cleanup that fully removes the related import, upload the verified `Client Wise Valuation Report.xlsx` and confirm the appropriate exact-file lock no longer blocks the corrected import.
11. Verify published Monthly Reports remain unchanged after current portfolio cleanup.
12. Verify activity logs from a central multi-investor run contain the same cleanup batch ID.

## Deployment

No new Firestore rules or composite indexes are required for this release.

After updating:

```bash
rm -rf .next
npm run dev
```

Run the normal release checks/CI before production deployment.
