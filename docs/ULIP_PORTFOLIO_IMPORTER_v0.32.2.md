# GrowVest v0.32.2 — ULIP Portfolio Importer & Policy Tracking

## Purpose

v0.32.2 adds ULIP as an enabled source in **Daily Portfolio Update** while preserving the difference between a ULIP policy and its underlying investment funds. One policy may contain one or many fund positions; GrowVest therefore stores the policy once and keeps each fund as a separate portfolio position.

## Data model

### Policy level — `ulipPolicies`

A policy record can contain:

- Investor ownership and assigned Advisor
- Insurance company / provider
- Policy number
- Plan name
- Policy start date
- Premium amount and frequency
- Total premium paid
- Maturity date
- Sum assured
- Policy status
- Current total fund value
- Number of underlying funds
- Latest NAV date
- Source import/file metadata

The policy-level premium is counted once. It is not duplicated across every fund in the policy.

### Fund level — `portfolioPositions`

Each underlying ULIP fund can contain:

- Policy number and plan name
- Fund name and optional fund code
- Units
- NAV
- NAV date
- Current fund value
- Optional explicit fund-level cost basis
- Goal/Bucket List allocation
- Previous NAV/value for movement visibility
- Source freshness/import metadata

A fund position is identified within the investor by policy number plus fund code/name. Multiple funds under the same policy remain separate positions but link back to the same policy.

## Supported import signatures

The importer accepts a single-investor ULIP table with a safe combination of fields such as:

- Investor/Client Name, PAN or Client Code when supplied
- Insurer / Insurance Company
- Policy Number
- Plan Name
- Fund Name and optional Fund Code
- Units
- NAV and NAV Date, or Current/Fund Value
- Policy Start Date
- Premium Amount / Frequency
- Total Premium Paid
- Maturity Date
- Sum Assured / Policy Status
- Optional Goal / Bucket List

`.xls`, `.xlsx` and `.csv` are supported by the unified import surface when the workbook can be safely parsed. Detection uses file contents and column signatures rather than filenames.

A workbook that mixes unrelated provider sources without using a supported standard structure is not silently guessed into Portfolio Master; GrowVest asks for separate source files instead.

## Investor matching and ownership protection

The matching hierarchy is:

1. Existing verified ULIP external mapping.
2. PAN match to the GrowVest Investor Profile.
3. Provider/client-code match when configured.
4. Verified policy-number identity mapping.
5. Exact/similar investor-name suggestion requiring confirmation.
6. Manual investor selection.

A policy number already owned by another GrowVest investor is treated as an ownership conflict and the import is blocked until staff resolves it.

After confirmation, available ULIP identity keys are saved for future matching. Aadhaar is never used for portfolio matching.

## Goal / Bucket List persistence

ULIP fund Goal/Bucket assignments belong to the permanent portfolio position, not to the daily file. A later ULIP import can update units, NAV and fund value without resetting the existing Goal/Bucket assignment.

For a genuinely new fund, an imported goal is applied only when it matches exactly one existing GrowVest goal. Otherwise the fund remains **General Wealth / Unassigned** for Admin/Advisor review.

## Return and premium treatment

ULIP provider reports frequently expose policy-level premium while fund values are split across multiple funds. GrowVest does not assign the full policy premium to every fund and does not manufacture a fund-level return.

- Policy premium / total premium paid is tracked once at policy level.
- Current portfolio value is the sum of current fund values.
- Fund-level gain/return is shown only when a reliable explicit fund-level cost basis is present.
- When cost basis is unavailable, the Investor Portal clearly treats fund-level return as unavailable instead of displaying a misleading zero or inferred gain.

## Snapshot and Monthly Report integration

ULIP fund positions participate in the verified Portfolio Master snapshot. Snapshot rows retain policy number, plan, fund/fund code, insurer, units, NAV/date, maturity/premium metadata and Goal/Bucket allocation.

The Investor Portal includes a **ULIP Policy Tracking** section for policy-level information and shows underlying fund positions with NAV/source freshness.

Monthly Reports continue to use the latest verified snapshot on or before the report as-of date. ULIP fund and policy identifiers flow through to the report while published report versions remain frozen.

## Duplicate and recovery controls

A file fingerprint prevents an exact ULIP file from being imported twice. ULIP imports use the existing recovery journal and include:

- ULIP fund portfolio positions
- Policy-level `ulipPolicies` records
- External identity/policy mappings
- File fingerprint and import-file state

Admin/Super Admin can therefore use **Reprocess**, **Correct Investor**, and **Rollback**. Recovery is blocked if a newer import has changed the same policy/position/mapping.

When correcting an import to another investor, Goal/Bucket assignments from the wrong investor are not copied automatically.

## Conservative safety boundary

Until a real insurer export proves that a report always represents the complete authoritative list of policy funds, GrowVest does **not** interpret a previously known fund that disappears from a later file as an automatic switch-out or exit. This prevents an incomplete provider report from silently closing a valid holding.

Provider-specific aliases should be validated against actual insurer exports before production sign-off. v0.32.2 ships the GrowVest ULIP standard shape plus defensive common field aliases.

## Firestore security

`ulipPolicies` can be read only by:

- Super Admin/Admin
- the assigned Advisor when the record belongs to that Advisor
- the authenticated Investor when `investorId` belongs to that Investor

Browser create/update/delete is denied. ULIP policy writes occur through authenticated server import/manual-position routes.

## Deployment

v0.32.2 adds Firestore rules for `ulipPolicies`. Deploy the current rules/index configuration:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Then restart the application cleanly:

```bash
rm -rf .next
npm run dev
```

## UAT checklist

1. Add PAN to a test Investor Profile.
2. Upload a single-investor ULIP file containing at least Policy Number, Fund Name, Units plus NAV or Fund Value.
3. Verify detection as **ULIP → ULIP Portfolio** and confirm policy/fund counts, premium paid and fund value.
4. Confirm PAN/saved mapping or manually select the investor.
5. Commit and verify one policy appears in **Investor → Portfolio → ULIP Policy Tracking**.
6. Verify every underlying fund appears as a separate ULIP holding with units, NAV, NAV date and current fund value.
7. Test one policy containing two or more funds and verify the policy premium is counted once rather than once per fund.
8. Assign an underlying fund to a Goal/Bucket List, upload a newer ULIP report, and verify the assignment persists.
9. Upload the exact same file again and verify it is skipped as a duplicate.
10. Verify a fund without explicit fund-level cost basis does not show a fabricated investment return.
11. Generate a Monthly Report and verify ULIP policy/fund details come from the verified portfolio snapshot.
12. Test Reprocess, Correct Investor and Rollback on a test ULIP import.
13. Verify an Investor account can read only its own ULIP policy/fund data.
14. Upload a later report that omits one prior fund and verify GrowVest does not automatically mark it exited.

## Production sign-off requirement

Before enabling a specific insurer format for live operations, validate at least one real export from that insurer. Confirm the exact column/header aliases, whether the report is a complete fund snapshot, how fund switches are represented, and whether premium/cost values are policy-level or fund-level.
