# GrowVest v0.32.8 — Vendor / Source Portfolio Cleanup

## Purpose

Provide Admin/Super Admin with a safe way to reset one investor's portfolio data for one selected portfolio source without deleting the investor profile or unrelated financial data.

## Admin flow

1. Open **Portfolio → Daily Portfolio Update**.
2. Select **Clean Vendor Portfolio**.
3. Select the Investor.
4. Select the Vendor / Portfolio Source.
5. Review the impact preview.
6. Enter a cleanup reason.
7. Type `CLEAN` and confirm.

## Supported cleanup sources

- Fundbazaar
- Bajaj Broking
- ULIP
- GrowVest Standard / Generic Import
- Manual Portfolio

## Data removed for the selected source

Where applicable, GrowVest removes:

- Portfolio positions
- Investment transactions
- Intraday/trading transactions
- ULIP policies
- Trading monthly summaries
- External investor mappings for that source
- Exact-file fingerprint locks for files belonging to that investor/source

Import file/batch records are retained for audit, but are marked as vendor-cleaned. Recovery journals for the cleaned source are invalidated so an older rollback cannot accidentally restore removed vendor data.

## Data intentionally retained

Cleanup does **not** delete:

- Investor profile
- PAN/Aadhaar profile configuration
- Goals and Bucket Lists
- Documents
- Meetings/MOM
- Investor actions
- Published Monthly Reports
- Other portfolio sources/vendors
- Historical activity/audit records

Older portfolio snapshots remain historical evidence. GrowVest creates or refreshes today's corrected snapshot from the remaining current positions after cleanup.

## Fundbazaar behavior

When Fundbazaar is cleaned:

- Fundbazaar holdings/transactions/mappings are removed.
- Exact-file locks for the investor's Fundbazaar imports are released where ownership can be verified.
- Daily Fundbazaar coverage tracking is paused until a new verified mapping/import is created.
- Admin can then upload the correct **Client Wise Valuation Report.xlsx** again.

## Safety rules

- Admin/Super Admin only.
- One investor + one source per cleanup operation.
- A reason is mandatory.
- Explicit `CLEAN` confirmation is mandatory.
- No mass all-investor deletion option is exposed.
- Every cleanup creates an activity-log record with counts and the replacement snapshot ID.
- Published Monthly Reports remain frozen/versioned.

## UAT

### Test A — Fundbazaar reset

1. Import a Client Wise Valuation report for a test investor.
2. Confirm Fundbazaar holdings appear.
3. Clean `Fundbazaar` for that investor.
4. Confirm Fundbazaar holdings and transactions are gone.
5. Confirm unrelated Bajaj/ULIP holdings remain.
6. Upload the same exact Fundbazaar file again.
7. Confirm it is allowed after the fingerprint lock is released.

### Test B — Bajaj reset

1. Ensure the investor has Delivery + Intraday data.
2. Clean `Bajaj Broking`.
3. Confirm Delivery positions, intraday trades and monthly trading summaries are removed.
4. Confirm Fundbazaar/ULIP data remains.

### Test C — Audit protection

1. Complete a vendor cleanup.
2. Confirm an activity log is created.
3. Confirm historical import records remain marked `vendor_cleaned`.
4. Confirm older recovery journal actions cannot restore the cleaned vendor data.
5. Confirm published Monthly Reports are unchanged.
