# v0.33.4 Investor Portfolio Permission Hotfix

## Problem

Opening an Investor's **Portfolio** tab could throw `FirebaseError: Missing or insufficient permissions` even for an otherwise authorised GrowVest user. The Portfolio screen was still using browser-side Firestore list listeners for Portfolio Master collections such as `portfolioPositions`, `portfolioSnapshots`, `investmentTransactions`, `ulipPolicies`, `tradingTransactions`, and `manualPortfolioAccounts`. The Investor mobile Portfolio page also read the Investor document directly from browser Firestore.

Legacy ownership metadata, reassignment history, or Firestore list-query proof can make those client queries fail even when the user is legitimately authorised to view the Investor.

## Fix

A new authenticated server endpoint is used for the Investor Portfolio view:

`GET /api/portfolio/investor-view?investorId=<id>`

The endpoint verifies the Firebase session, resolves the requested Investor, and enforces the current access relationship before reading Portfolio Master collections with Firebase Admin.

Access rules are:

- Super Admin / Admin: permitted for any active Investor.
- Advisor: permitted only for an Investor currently assigned to that Advisor.
- Investor: permitted only for the Investor linked to the signed-in Investor Portal account, with portal access enabled.

The API returns only the portfolio-view data required by the UI: active positions, ULIP investment records, recent verified snapshot history, recent investment transactions, intraday trading history, Manual Portfolio accounts, and a limited Investor identity/Goal payload.

The Portfolio screen no longer depends on browser Firestore list access for these collections. Portfolio mutations continue to use their existing authenticated server APIs, and the Portfolio view refreshes after Goal reassignment, manual holding creation, delivery sale, intraday entry, or controlled cleanup.

The Investor mobile `/investor/portfolio` route also no longer performs a direct browser `getDoc()` against the Investor collection.

## Security

This hotfix does **not** loosen Firestore rules. The browser receives portfolio data only after the server verifies the authenticated actor and Investor relationship. A signed-in user cannot request another Investor's portfolio merely by changing the query-string Investor ID.

## UAT

1. Sign in as Super Admin and open an Investor → Portfolio tab.
2. Confirm no `Missing or insufficient permissions` error appears and holdings/snapshots load.
3. Sign in as the assigned Advisor and repeat for an assigned Investor.
4. Confirm the Advisor cannot load another Advisor's Investor by direct URL/API request.
5. Sign in through Investor Portal and open Portfolio → Investments.
6. Confirm only the linked Investor portfolio is shown.
7. Test Portfolio → Protection and confirm Insurance still loads.
8. As Admin, change a holding Goal/Bucket assignment and confirm the refreshed Portfolio reflects it.
9. Add a manual holding / intraday trade or record a delivery sale and confirm the Portfolio refreshes.
10. Confirm current Portfolio value remains separate from Insurance cover values.
