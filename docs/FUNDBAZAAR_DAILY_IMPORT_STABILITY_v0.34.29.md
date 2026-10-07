# v0.34.29 — Fundbazaar Daily Portfolio Import Stability

## Problem

Daily Portfolio Update could reach `POST /api/portfolio/imports/fundbazaar/commit` and return a generic HTTP 500. The commit route mixed the primary holding write with secondary snapshot, daily-coverage and activity-log work, so a failure after the holdings stage could make the whole request look as though nothing was imported. File-level failures also reused the shared BulkWriter for the failure marker, which made diagnosis harder after a bulk write problem.

## Changes

- Fundbazaar commit now records the exact server stage (`batch_lookup`, `file_commit:<id>`, `bulk_writer_finalize`, `snapshot_refresh`, `daily_coverage_refresh`, `batch_finalize`, `activity_log`).
- A route-level failure persists `failureStage` / `importError` on the import batch and returns an actionable error message rather than only `500 Internal Server Error`.
- File-level commit failures are persisted directly on the import file instead of reusing the shared BulkWriter after a file write/flush error.
- Fundbazaar string/numeric fields are hardened against blank/invalid values; missing preview fingerprints are rejected with a clear re-analyse instruction.
- Once the primary holding writes have succeeded, a derived Portfolio Snapshot or Daily Coverage refresh failure is returned as a warning/partial result instead of incorrectly turning the already-committed import into an opaque HTTP 500.
- Daily Portfolio Update displays failed file names and server messages, and uses an amber partial-success state when attention is required.

## Data integrity boundary

This release does not change Fundbazaar matching, folio identity, holding valuation calculations, exit detection, goal allocation preservation, duplicate fingerprint rules or the accepted Client Wise Valuation format. Portfolio Ledger remains unsupported for daily Fundbazaar updates.

## Operational verification

1. Upload the normal Fundbazaar Client Wise Valuation file and Analyse.
2. Confirm/verify the investor mapping.
3. Select **Update Ready Portfolios**.
4. If holdings import cleanly, the batch completes normally.
5. If snapshot/coverage refresh fails, holdings remain applied and the screen shows the exact warning instead of a generic 500.
6. If the core file commit itself fails, the screen shows the file name and exact import error; the import batch stores the failure stage for server diagnosis.
