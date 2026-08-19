# Full Portfolio Reset - v0.33.2

## Purpose

`Full Portfolio Reset` is the destructive fresh-start workflow for an Investor whose portfolio must be rebuilt from the beginning. It is deliberately separate from the existing controlled cleanup workflow.

After a successful reset, GrowVest must behave as though the Investor has never had operational portfolio data uploaded before. The Investor record itself is preserved.

## Access and confirmation

- Role: **Super Admin only**.
- Individual path: `Investors -> Investor -> Portfolio Administration -> Full Portfolio Reset`.
- Central path: `Portfolio -> Portfolio Administration -> Full Portfolio Reset`.
- Individual confirmation text: `RESET PORTFOLIO`.
- Bulk confirmation text: `RESET N INVESTOR` / `RESET N INVESTORS` based on the selected count.
- A reset reason of at least five characters is mandatory before the destructive action is enabled.
- Bulk Full Portfolio Reset is capped at 25 Investors per operation.

## Deleted portfolio state

The reset removes Investor-scoped records from:

- `portfolioPositions`
- `investmentTransactions`
- `ulipPolicies`
- `tradingTransactions`
- `tradingMonthlySummaries`
- `portfolioSnapshots`
- `portfolioSnapshotPositions`
- `portfolioImportFiles` attributable to the Investor
- `portfolioImportChanges`
- `portfolioImportChangeItems`
- `portfolioFileFingerprints`
- `externalInvestorMappings`
- `sipFundingSchedules`
- `sipFundingCycles`
- portfolio-specific `activityLogs`
- SIP/holding-linked `investorActions`
- linked `investorActionEvents`
- SIP-linked `clientQueries`
- SIP/action-linked `notifications`

The following Investor Portfolio Master fields are removed when present:

- `latestPortfolioSnapshotId`
- `latestPortfolioSnapshotDate`
- `latestPortfolioValue`
- `latestPortfolioInvested`
- `latestPortfolioGainLoss`
- `latestPortfolioMonthlySip`
- `latestPortfolioReconciliationStatus`
- `latestPortfolioIssueCount`
- `latestPortfolioNewHoldingCount`
- `latestPortfolioExitedHoldingCount`
- `latestPortfolioUnassignedCount`
- `latestPortfolioUpdatedAt`
- `fundbazaarDailyTrackingEnabled`

`portfolioImportMappingProfiles` are intentionally preserved because they are global reusable file-layout definitions, not Investor mappings.

## Shared import batches

A `portfolioImports` batch can contain files for multiple Investors. Full Portfolio Reset therefore does not blindly delete a batch.

For a selected Investor:

1. Delete only the attributable `portfolioImportFiles`.
2. Remove those file IDs from the shared batch.
3. Rebuild remaining file/source/status counters from the surviving files.
4. Remove the selected Investor from `missingInvestors` when present.
5. Preserve other Investors' `missingInvestors` coverage entries when a shared batch still carries them.
6. Delete the batch document only when no valid files and no other-Investor missing-coverage references remain.

Bulk reset reloads each Investor's reset context immediately before deletion. This prevents one selected Investor from restoring stale file IDs after another selected Investor has already modified the same shared batch.

## Preserved data

Full Portfolio Reset does **not** delete:

- Investor profile and identity record
- KYC information
- Investor documents
- DOB and family information
- Advisor assignment
- meetings and MOMs
- Goal/Bucket List definitions
- published Monthly Reports and their immutable versions
- unrelated Advisor Follow-ups or Service Requests
- unrelated notifications
- global portfolio import column-mapping profiles

Holding-to-goal allocations are removed automatically because the old holdings themselves are deleted. Goal definitions remain available for reassignment after fresh upload.

## Post-reset state

The expected operational status is:

| Field | State |
| --- | --- |
| Portfolio Status | No portfolio data |
| Last Update | Never |
| Daily Update | Not started |
| Fundbazaar Mapping | Not mapped |
| Import History | No imports |
| Snapshots | No snapshots |
| Trading | No trading data |

Published Monthly Reports remain visible only as historical documents. They do not repopulate the live/current Portfolio Master display after reset. The Monthly Report creation workspace also refuses to seed a new report's current corpus, holdings or carry-forward portfolio actions from old published reports or legacy profile investments when no verified Portfolio Master exists.

## Fresh-start workflow

1. Run **Full Portfolio Reset**.
2. Investor portfolio becomes blank.
3. Upload the new verified Client Wise Valuation Report or other supported source file.
   - Normal Fundbazaar daily updates should use a real `Client Wise Valuation Report.xlsx` workbook.
   - For the first upload of a completely blank/newly reset Investor only, a readable legacy Fundbazaar `Client Wise Valuation Report.xls` / `HTML-XLS` export is accepted as a bootstrap source. GrowVest parses it, requires the Investor mapping again, and verifies that no prior resettable portfolio state remains before commit.
   - After that first successful bootstrap import, subsequent Fundbazaar updates must use `.xlsx`.
4. Map the Investor again.
5. Create the fresh Portfolio Master through the normal import commit.
6. Create the first new snapshot.
7. Future portfolio/import history starts from the new upload.

No corrected snapshot is created by Full Portfolio Reset itself.

## UAT

### Individual reset

1. Use an Investor with Fundbazaar holdings, transactions, snapshots, mapping, fingerprint and import history.
2. Open Investor Portfolio Administration as Admin and confirm **Full Portfolio Reset is not available**.
3. Open as Super Admin and confirm the impact preview shows holdings, transactions, snapshots, imports, mappings, fingerprints and trading/recovery/SIP/history counts.
4. Confirm a short/blank reason is rejected.
5. Confirm any text other than `RESET PORTFOLIO` is rejected.
6. Complete the reset.
7. Confirm Portfolio Status = No portfolio data, Last Update = Never, Daily Update = Not started, Fundbazaar Mapping = Not mapped, Import History = No imports, Snapshots = No snapshots, Trading = No trading data.
8. Confirm Goal/Bucket List definitions and published Monthly Reports still exist.
9. Confirm current portfolio displays do not use the old Monthly Report corpus as a fallback.
10. Start a new Monthly Report before re-upload and confirm current portfolio values remain blank/zero with the Portfolio Master verification warning instead of using the old report/profile portfolio as an opening corpus.
11. Upload the same verified source file again and confirm duplicate fingerprint protection does not block it because the old fingerprint was released.
12. Confirm the Investor must be mapped again and the new upload creates a fresh first snapshot.
13. For a reset Investor, upload a readable Fundbazaar Client Wise Valuation `.xls` / HTML-XLS export and confirm it is accepted for this first bootstrap import.
14. After the first import succeeds, try another legacy `.xls` / HTML-XLS Fundbazaar update and confirm GrowVest requires `Client Wise Valuation Report.xlsx` for the ongoing update.

### Shared batch safety

1. Create one import batch containing Investor A and Investor B files.
2. Full-reset only Investor A.
3. Confirm A files/history/mappings/fingerprints are removed.
4. Confirm B's import file, holdings and batch remain intact.
5. Confirm the shared batch no longer references A's deleted file IDs.
6. Full-reset Investor B.
7. Confirm the batch is deleted when no files remain.

### Bulk reset

1. Select multiple Investors in Central Portfolio Administration, including an Investor with history but no current holdings.
2. Confirm the preview includes all selected Investors and permanent-reset counts.
3. Confirm the required phrase is exactly `RESET N INVESTORS` (or singular for one Investor).
4. Complete the reset and confirm every selected Investor reaches the blank post-reset state.

## QA

Run:

```bash
npm run qa
npm run lint
npm run build
```

The release audit contains explicit checks for Super Admin authorization, typed confirmation, the reset deletion matrix, preservation of Monthly Reports/Goals, and central history-only bulk reset availability.
