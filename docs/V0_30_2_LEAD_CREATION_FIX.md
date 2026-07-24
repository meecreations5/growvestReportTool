# GrowVest v0.30.2 — Lead Creation Reliability Fix

## Problem

Creating a lead could fail when optional numeric fields such as qualification score or indicative amount were left blank. The Zod schema intentionally returned `undefined` for those blank values, but Cloud Firestore does not accept `undefined` inside a document write. The application then displayed a generic Firebase configuration and rules message, which made the actual data problem difficult to identify.

## Correction

- Blank optional numeric fields are now saved as `null`.
- Blank optional text fields are normalised to empty strings.
- No `undefined` values are included in the lead document batch.
- Lead-form errors now distinguish permission, invalid-data, precondition and network failures.
- The PWA cache version was incremented so installed applications receive the corrected client bundle.

## Test

1. Sign in as Super Admin, Admin or Advisor.
2. Create a lead with Qualification Score and Indicative Amount left blank.
3. Confirm the lead is created and receives a `GV-LD-YYYY-####` code.
4. Repeat with both optional numeric fields populated.
5. Confirm the activity timeline contains the lead-created event.

No Firestore rules or database migration is required for this code correction. If a `permission-denied` message appears after deployment, verify the signed-in user's `users/{uid}` record has `status: "active"` and one of the supported staff roles, then deploy the included Firestore rules.
