# Assessment Save Fix — Undefined Firestore Fields

## Issue

Saving or completing a client assessment failed when an optional numeric field was left blank. Zod converted blank values to `undefined`, while Firestore rejects `undefined` values inside nested objects such as `investmentPreferences.lumpSumAmount`.

## Fix

`src/services/assessmentService.js` now sanitizes every assessment, lead update, activity log and investor write before it is sent to Firestore. Nested `undefined` values are converted to `null`, while Firestore sentinels such as `serverTimestamp()` are preserved.

This also allows a user to clear a previously entered optional value instead of silently retaining the old Firestore value.

## Verification

1. Open a lead assessment.
2. Leave Lump Sum Amount blank.
3. Save Draft.
4. Complete all mandatory fields and Complete Assessment.
5. Confirm the `clientAssessments/{leadId}` document stores `investmentPreferences.lumpSumAmount` as `null`.
