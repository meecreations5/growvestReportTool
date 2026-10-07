# GrowVest v0.34.30 Release Validation — Multiple Daily Portfolio Files

## Scope
This release hardens Daily Portfolio Update when staff select multiple portfolio reports in one bulk upload.

## Validated rules
1. Preview supports one physical file per request while retaining one shared batch ID.
2. Global upload order is preserved through `uploadOffset`.
3. The preview batch remains processing until the final selected file is analysed.
4. Commit supports a selected `fileIds` subset and a `finalizeBatch` flag.
5. Ready reports are committed sequentially from the browser rather than in one monolithic request.
6. Each committed report uses its own Firestore BulkWriter.
7. A file-level write failure is isolated to that report and does not poison later reports.
8. Final batch totals are recomputed across the complete batch.
9. Fundbazaar daily coverage refresh runs only after the final file is committed.
10. Existing single-file upload remains backward compatible because preview/commit default to finalising when chunk controls are not supplied.
11. UI progress is visible for both `Analysing X/Y` and `Updating X/Y`.
12. Existing Fundbazaar valuation, folio matching, exit detection, goal allocation and duplicate-fingerprint rules remain unchanged.

## Production check
After deployment, select at least 3 current Fundbazaar Client Wise Valuation files together. Confirm that all files analyse, the progress moves file by file, ready reports update sequentially, and one bad/unmatched file does not stop the other verified files.
