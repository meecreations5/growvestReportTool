# GrowVest v0.32.7 — Fundbazaar Client Wise Standardization + Import Cleanup + Profile/Document Status

## Locked Fundbazaar operating rule

GrowVest daily Fundbazaar updates now use **Client Wise Valuation Report.xlsx only**.

- `Client Wise Valuation Report.xlsx` → supported daily Portfolio Master source.
- Fundbazaar `Portfolio Ledger` → not applicable and rejected before commit.
- HTML/web-wrapper `.xls` valuation files → rejected with an instruction to use a real `.xlsx` workbook.
- A client/investor may be uploaded multiple times on the same day when the file content is new.
- Duplicate protection is based on the SHA-256 content fingerprint, not investor/date/filename.
- Same investor + different content → allowed.
- Same filename + different content → allowed.
- Exact same content → skipped as an exact duplicate.

Daily coverage counts an investor once and uses Client Wise Valuation imports only. Multiple successful uploads update the same Portfolio Master positions and retain separate snapshots/audit history.

## Wrong investor / wrong import recovery

Import History → Manage supports:

- **Rollback** for imports with a recovery journal.
- **Correct Investor** for supported imports with a recovery journal.
- **Reprocess** for supported imports with a recovery journal.
- **Remove Ledger Import** for historical Fundbazaar Ledger imports. Ledger is rolled back, not reassigned/reprocessed.
- **Clean wrong import** for legacy imports that pre-date recovery journals, when the current records still point to that old import.

Legacy cleanup:

1. Removes portfolio/trading/ULIP records that still identify the selected legacy file as their source.
2. Removes snapshots created by that import where identifiable.
3. Releases the exact-file fingerprint if it still belongs to that import.
4. Removes the stale external mapping only when that import is still the mapping's last successful import.
5. Creates a corrected current snapshot from the remaining Portfolio Master.
6. Writes an audit/activity record.
7. Does not modify already-published Monthly Reports.

If an exact duplicate is shown during Daily Portfolio Update, **Manage previous import** opens the original import directly so Admin can correct/rollback/clean it instead of manually touching Firestore.

## Investor profile/KYC/document status

The Investor list now shows operational status for:

- Profile
- KYC
- Required Documents

The standard required profile-document checklist is:

- PAN Card
- Aadhaar Card
- Cancelled Cheque
- Photograph
- Address Proof
- Signature

The Investor Documents panel shows each document individually as Missing / Requested / Uploaded / Verified / Rejected / Expired.

Profile completion uses core profile fields (name, mobile, email, city, DOB, occupation, PAN). Aadhaar remains optional for profile completion and the full Aadhaar value remains encrypted/server-only.

KYC status prioritizes PAN profile data plus PAN Card upload/verification. Document status is calculated separately from the full required-document checklist.

## UAT

### Fundbazaar

1. Upload a real `Client Wise Valuation Report.xlsx` → Ready / Confirm Investor / Auto Matched.
2. Import it → Portfolio Master and snapshot update.
3. Upload a newer report for the same investor → allowed and applied.
4. Upload a file with the same filename but changed content → allowed.
5. Upload the exact same file bytes → Already Imported; use Manage previous import if correction is required.
6. Upload Portfolio Ledger → Needs Attention with “not applicable” guidance; it must not commit.
7. Upload an HTML/web-wrapper `.xls` → Needs Attention and request a real `.xlsx`.

### Wrong investor correction

1. Import a Client Wise `.xlsx` into the wrong test investor.
2. History → Manage → Correct Investor → select correct investor + reason.
3. Verify wrong investor is restored/rebuilt, correct investor receives the import, and goal allocations from the wrong investor are not copied.
4. Roll back a test import and verify its exact-file duplicate lock is released.
5. For a historical Ledger import, use Remove Ledger Import / Clean wrong import. Then upload Client Wise `.xlsx`.

### Profile / documents

1. Open Investors list → Profile/KYC/Documents columns should populate.
2. Open Investor → Access & Documents → verify the six-document checklist.
3. Upload PAN Card → status changes to Uploaded.
4. Verify PAN Card → status changes to Verified and KYC status updates.
5. Upload/verify other required documents → document count/status updates.
6. Update profile fields/KYC → profile/KYC status refreshes.
