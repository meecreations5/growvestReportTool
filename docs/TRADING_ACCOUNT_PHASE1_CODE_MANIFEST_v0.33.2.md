# Trading Account Phase 1 - Code Manifest v0.33.2

Base package: `growvestReportTool_portfolio_reporting_v0.33.2_manual_portfolio_management_full.zip`

This phase changes/adds 20 files relative to that base.

## Modified

1. `README.md`
2. `firestore.rules`
3. `scripts/qa/release-audit.mjs`
4. `src/app/api/portfolio/administration/route.js`
5. `src/app/api/portfolio/imports/[batchId]/recovery/route.js`
6. `src/app/api/portfolio/imports/fundbazaar/commit/route.js`
7. `src/app/api/portfolio/imports/preview/route.js`
8. `src/components/portfolio/CentralPortfolioAdministration.js`
9. `src/components/portfolio/InvestorPortfolioAdministration.js`
10. `src/components/portfolio/PortfolioImportCentre.js`
11. `src/lib/constants/navigation.js`
12. `src/lib/constants/portfolio.js`
13. `src/lib/server/portfolioImportParser.js`
14. `src/lib/server/portfolioReset.js`
15. `src/services/portfolioService.js`

## New

16. `src/app/(portal)/portfolio/trading/page.js`
17. `src/app/api/portfolio/trading/accounts/route.js`
18. `src/components/portfolio/TradingAccountCentre.js`
19. `docs/TRADING_ACCOUNT_BROKER_IMPORTS_v0.33.2.md`
20. `docs/TRADING_ACCOUNT_PHASE1_CODE_MANIFEST_v0.33.2.md`

## Scope

- Bajaj Broking native Client Holding Report valuation snapshots
- Angel One digital DP Transaction Cum Holding PDF
- broker account identity and dated snapshots
- DP movement ledger separate from trades
- broker-aware delivery positions
- preserved/explicitly pending cost basis
- Trading Accounts workspace
- Broker Delivery administration scope
- recovery, Firestore rules and Full Portfolio Reset integration
- regression QA for native broker contracts
