# GrowVest v0.31.7 — Import Correction, Recovery and Investor KYC Identifiers

## 1. Import correction and recovery

The Daily Portfolio Update history now exposes **Manage** to Super Admin/Admin for imported batches. Recovery is intentionally server-side and does not grant browser write permission to Portfolio Master collections.

### Supported actions

- **Rollback** — restores the exact pre-import state captured by the recovery journal.
- **Reprocess** — rolls back the selected file, prepares a replacement import from the stored parsed report, and applies it again to the same investor.
- **Correct Investor** — rolls back the selected file, resets the incorrect Fundbazaar identity mapping when appropriate, and reprocesses the stored report against the selected investor.

### Safety rules

- Recovery is only available for files imported after v0.31.7 starts writing `portfolioImportChanges` / `portfolioImportChangeItems`.
- v0.31.6 and older batches are shown as **Legacy import · journal unavailable** because there is no trustworthy pre-import state to restore.
- A recovery is blocked if a newer import has already updated any holding, transaction, mapping, or fingerprint touched by the selected file.
- Every action requires a correction reason and is logged without financial-identifier values.
- Published monthly reports are not edited. The corrected Portfolio Master creates/rebuilds the current daily snapshot; existing published report versions remain frozen.
- Same-investor reprocessing preserves current Goal/Bucket List allocations. A wrong-investor correction does not copy goal allocation from the old investor to the new investor.

## 2. Investor PAN and Aadhaar

Investor Profile → Edit → Profile now includes PAN and Aadhaar.

### PAN

- Optional but validated as a standard 10-character PAN format.
- Stored uppercase as `panNumber` / `panNormalized` on the Investor document.
- PAN must be unique across active GrowVest Investors.
- Fundbazaar Portfolio Ledger PAN can directly auto-match an Investor Profile before falling back to name suggestions.

### Aadhaar

- Optional 12-digit input with checksum validation.
- Full Aadhaar is encrypted on the server using AES-256-GCM.
- Encrypted material is stored only in `investorKycSecure/{investorId}`.
- Browser clients cannot read or write `investorKycSecure` through Firestore rules.
- Investor documents contain only `aadhaarConfigured` and `aadhaarLast4` for masked display.
- Activity logs never contain the Aadhaar number.
- Aadhaar is not used as an import-matching key.

### Server environment

Configure a long, random server-only secret. Do not use a `NEXT_PUBLIC_` variable.

```bash
KYC_FIELD_ENCRYPTION_KEY=<strong-random-secret>
```

After adding/changing this server environment value, restart/redeploy the Next.js server.

## 3. Firestore deployment

v0.31.7 adds explicit deny rules for server-managed secure/recovery collections. Deploy the rules after updating the application:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

No new composite index is required by v0.31.7.

## 4. UAT checklist

1. Add a valid test PAN to an Investor Profile and save.
2. Confirm the Investor detail view shows PAN and masked Aadhaar state only.
3. Configure `KYC_FIELD_ENCRYPTION_KEY`, add a valid test Aadhaar, save, then reopen the profile. Only `XXXX XXXX 1234`-style masking should be visible.
4. Import a fresh Fundbazaar Portfolio Ledger after v0.31.7. Open Daily Portfolio Update → History → Manage; the file should show recovery available.
5. Assign one imported fund to a Goal/Bucket List, then use **Reprocess**. The goal assignment should remain.
6. Use a test import mapped to the wrong investor, then **Correct Investor**. The old investor should be restored and the replacement import should appear under the selected investor without copying the old investor's Goal/Bucket mapping.
7. Import a newer report and then try to recover an older touched import. GrowVest should block the recovery because newer data exists.
8. Verify the Investor Portal and published Monthly Reports continue to load without Firestore permission errors.
