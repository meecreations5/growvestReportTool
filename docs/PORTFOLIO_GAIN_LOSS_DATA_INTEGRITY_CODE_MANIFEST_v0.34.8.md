# v0.34.8 — Portfolio Gain/Loss Data Integrity Code Manifest

## New file

- `src/lib/portfolioPerformance.js`
  - Central cost-basis-aware portfolio performance calculation
  - Investment-type reconciliation totals
  - ULIP premium de-duplication
  - Missing-cost and cash handling

## Updated files

- `src/components/portfolio/InvestorPortfolioPanel.js`
  - Total/Known Invested and Gain/Loss integrity labels
  - Investment Type Totals on desktop and mobile
  - Mutual Fund, Equity Delivery, ULIP and other category reconciliation
  - Trading / Derivatives shown separately with turnover and net realised P&L
  - Holding-level Return Pending state when cost basis is unavailable

- `src/app/api/investor/app-data/route.js`
  - Investor App/Home totals use the same cost-basis-aware source of truth
  - Top holdings expose performance availability

- `src/app/api/portfolio/investor-view/route.js`
  - Exposes latest partial-performance metadata to the portfolio client

- `src/app/api/portfolio/positions/manual/route.js`
  - Preserves known purchase cost during valuation-only edits
  - Persists cost-basis availability metadata

- `src/app/api/portfolio/investors/[investorId]/manual-import/route.js`
  - Merge-mode valuation updates preserve existing invested amount / average purchase rate
  - Persists cost-basis availability metadata

- `src/app/api/portfolio/imports/fundbazaar/commit/route.js`
  - Generic valuation updates preserve previous cost basis
  - Missing cost no longer becomes artificial profit

- `src/lib/server/manualPortfolioWorkbook.js`
  - Uses central performance summary
  - Cash is explicitly excluded from investment performance
  - Missing-cost metadata preserved

- `src/lib/server/portfolioCoverage.js`
  - Portfolio coverage/import status understands cost-basis completeness

- `src/lib/server/portfolioImportParser.js`
  - Import parsers mark cost-basis availability and partial gain/loss

- `src/lib/server/portfolioServer.js`
  - Verified snapshots store cost-basis-aware summary values
  - Investor master latest-portfolio fields store partial-performance state

- `src/app/investor/portfolio/[positionId]/page.js`
  - Holding detail avoids showing a misleading return when cost basis is pending

- `src/lib/constants/report.js`
  - Monthly report data carries partial-performance metadata

- `public/sw.js`
  - Investor PWA cache bumped to `v0.34.8-portfolio-integrity1`

- `package.json`
- `package-lock.json`
  - Release version bumped to `0.34.8`

- `scripts/qa/release-audit.mjs`
  - v0.34.8 integrity and investment-type-total release assertions
