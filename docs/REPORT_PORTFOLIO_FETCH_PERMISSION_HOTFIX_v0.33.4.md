# v0.33.4 Monthly Report Portfolio Fetch Permission Hotfix

## Problem

During Monthly Report creation, Step 3 (Portfolio Data) could remain on **Checking** with zero holdings while the browser console reported `FirebaseError: Missing or insufficient permissions`.

The report builder was reading `portfolioSnapshots`, `portfolioSnapshotPositions`, `investmentTransactions`, `manualPortfolioCashLedger`, `investorActions`, and `tradingMonthlySummaries` directly from browser Firestore. That made report generation dependent on the deployed client Firestore rules for every Portfolio Master source collection.

## Fix

- Added authenticated server endpoint `GET /api/portfolio/report-source`.
- The endpoint verifies the signed-in GrowVest staff member and validates current Investor ownership/assignment.
- Portfolio Master source records are read with Firebase Admin on the server and filtered to the selected report cutoff.
- Month-end 1-5 day capture grace logic remains intact and will not backdate post-cutoff market values.
- Manual PMS cash flows, confirmed Investor Action cash movements, provisional-withdrawal de-duplication, opening snapshot and Trading Account monthly summary remain part of the source payload.
- Monthly Report investor selection now uses the authenticated `/api/investors` directory instead of a direct browser collection query.
- A source-load failure now changes verification to **Blocked** with the actual error instead of leaving the screen indefinitely on **Checking**.

## Security

No Portfolio Master collection is made public and no Firestore browser rule is relaxed by this hotfix.
