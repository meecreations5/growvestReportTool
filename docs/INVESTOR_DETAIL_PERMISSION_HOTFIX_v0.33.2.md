# Investor Detail Permission Hotfix — v0.33.2

## Problem

After a portfolio import auto-matched an Investor, opening `/investors/[investorId]` could surface `FirebaseError: Missing or insufficient permissions` in development even when the Advisor was correctly assigned to that Investor.

The Investor document itself was not the problem. Three secondary browser subscriptions queried collections only by Investor/Lead ID, while Firestore Advisor read rules require the query to also constrain the persisted Advisor ownership field.

Affected subscriptions:

- Investor meeting history
- Monthly Report history
- Assessment version history

## Fix

- Investor meeting history now carries `advisorUid == currentUser.id` for Advisors.
- Monthly Report history now carries `advisorUid == currentUser.id` for Advisors.
- Assessment version history now carries `assignedAdvisorUid == currentUser.id` for Advisors.
- Investor-visible report/meeting constraints are applied when the current role is Investor.
- Permission-sensitive subscriptions fail closed until the authenticated user profile has loaded.
- Composite indexes were added for the primary sorted Advisor queries. Existing index fallbacks keep the UI operational while an index is still building.
- Firestore rules were not weakened.

## Expected result

An Advisor can open an Investor assigned to their book without a background permission error from Meetings, Monthly Reports or Assessment History. Admin and Super Admin access remains unchanged.

## Security note

This hotfix intentionally changes query shape rather than broadening Firestore read permissions. Cross-Advisor Investor data remains blocked.
