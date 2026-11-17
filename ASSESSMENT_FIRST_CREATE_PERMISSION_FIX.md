# GrowVest Assessment First-Create Permission Fix

## Scope

Based on `growvestReportTool(5).zip`, applied cumulatively to the subsequently delivered **Daily Portfolio Update** full project. Only Firestore assessment read security rules and the new-assessment UI error state are changed, plus one focused source-check fixture. Monthly reporting and daily Fundbazaar import implementation are untouched.

## Why assigned team members were denied

- `AssessmentPageClient` immediately subscribes to `clientAssessments/{leadId}`.
- For a newly created lead, that assessment document does not exist yet.
- Original Firestore `allow read` only checked `ownsAdvisorRecord(resource.data)`, which is not available for a missing document.
- Admins were permitted by `isAdmin()`. Assigned advisors could receive `permission-denied` before saving their first assessment.
- UI then had an indefinite loading state if the read callback errored.

## Changes

1. Separate single-document `get` from collection `list` for `clientAssessments`.
2. Authorize first-time `get` for the **assigned advisor**, by checking the existing lead document with the same ID. Keep existing-assessment access for prior owners; other advisors cannot read missing assessments. Query/list access stays unchanged.
3. Show meaningful permission errors instead of an endless spinner.
4. Leave create/update/delete authorization unchanged; no privilege broadening for writes.

## Installation

**Critical:** Replacing JavaScript code alone does **not** fix a Firestore permission rule. Deploy `firestore.rules` to the same Firebase project used by the running application.

On the exact current project, back up `firestore.rules` first. Apply the focused changed-files patch OR use the full cumulative project, not both. From its root:

```bash
npm run qa
node scripts/qa/assessment-first-create-permissions-fixture.mjs
npm run build
firebase deploy --only firestore:rules --project growvest-reporttool
```

Confirm `.firebaserc` project and your Firebase app env settings match **before** deploying. Deploy rules to a staging project first where feasible.

## Staging acceptance

1. Create lead under advisor A assigned to advisor A. Without any `clientAssessments/{leadId}` document, open `Start assessment` as advisor A. It must load the blank form without permission denied.
2. Save draft and complete assessment as A. Both operations must succeed and create version/activity records.
3. Open another lead assigned to advisor B as advisor A. A must be denied.
4. As admin, open both new and existing assessments.
5. Test adviser A assessment history, lead updates, and existing completed assessment read/edit. Verify no change to monthly reports, Fundbazaar imports, or current portfolio valuations.
6. If denial persists, inspect `users/{auth.uid}` status/role and `leads/{leadId}.assignedAdvisorUid` equality, then evaluate the exact denied Firestore path in the emulator/logs.

## Verification limits

Static regression assertions were added. Live Firebase rules deployment, emulator tests, account-specific data and Next.js build must be verified in your environment before production sign-off.
