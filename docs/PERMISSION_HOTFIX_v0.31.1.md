# GrowVest v0.31.1 — Portfolio permission hotfix

## Problem

Advisor users could receive `FirebaseError: Missing or insufficient permissions` when loading the new Portfolio Master or generating a report from a verified portfolio snapshot.

The Firestore rules correctly require advisor ownership, but the client queries only filtered by `investorId`. Firestore authorizes queries from their constraints, so it could not prove that every returned portfolio record belonged to the signed-in advisor.

## Fix

- Advisor queries now include `advisorUid == signed-in advisor UID`.
- Investor queries continue to use their mapped `investorId`.
- Admin / Super Admin access remains unchanged.
- Added composite indexes for advisor-scoped portfolio snapshots, trading history and report-source transactions.
- No portfolio collection write permissions were opened to the browser; writes remain server API only.

## Required deployment

After updating the application, deploy the Firebase rules and indexes from the project root:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If using a specific Firebase project alias, confirm the active project first:

```bash
firebase use
firebase deploy --only firestore:rules,firestore:indexes
```

Then sign out and sign back in before retesting the Portfolio page.
