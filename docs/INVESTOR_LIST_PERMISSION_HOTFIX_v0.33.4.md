# v0.33.4 Investor List Permission Hotfix

## Symptom
Opening **Investors** could fail with `FirebaseError: Missing or insufficient permissions` even for an authorised staff user.

## Root cause
The Investor directory was still loaded with a browser-side Firestore collection listener. That made the screen depend on deployed browser rules, query-shape proof, legacy advisor ownership fields and the `isDeleted` field being present on older Investor documents.

## Fix
- Added authenticated `GET /api/investors` using Firebase Admin on the server.
- Super Admin/Admin receive all non-deleted Investor profiles.
- Advisors receive the union of `assignedAdvisorUid` and legacy `advisorUid` ownership, de-duplicated server-side.
- Older Investor profiles without an `isDeleted` field remain visible; only `isDeleted === true` is excluded.
- Removed the Investor directory's direct browser Firestore list subscription.
- Removed the misleading "deploy Firestore indexes" message for permission failures.

Individual Investor documents continue to use existing secured flows; this hotfix changes only the directory/list hydration path.
