# v0.34.3 Code Manifest - Investor Mobile Visual Correction

## Primary changed files

- `src/components/investor/InvestorShell.js`
  - Global phone back-navigation rules.
  - Royal Trust Blue home logo knockout correction.
  - Reduced GrowVest centre-action size.

- `src/components/investor/MobileInvestorDashboard.js`
  - Tighter Home hero proportions.
  - Removed giant hero watermark.
  - Moved privacy/refresh controls into calmer positions.
  - Removed snapshot movement percentage from Home.
  - `<1%` goal-progress treatment.

- `src/components/portfolio/InvestorPortfolioPanel.js`
  - Portfolio-level current/invested/gain consistency.
  - Sparse-history messaging and chart date anchors.
  - Clearer investor-facing metric labels.

- `src/components/investor/mobile/MobileFinanceCharts.js`
  - Render all range-filtered trend points.
  - Slimmer performance line.

- `src/app/api/investor/app-data/route.js`
  - Portfolio gain/loss derives from current value minus invested amount when a live portfolio is available.

- `src/app/investor/goals/page.js`
  - Adaptive filter/search controls.
  - `<1%` progress label.
  - Non-zero progress visibility.
  - Calmer positive status colour treatment.

- `src/app/investor/goals/[goalId]/page.js`
  - Planning-aware goal guidance.
  - `<1%` progress label.
  - Target-date setup state.
  - Connected-investment list compaction.

- `src/app/investor/profile/page.js`
  - Privacy control.
  - Advisor photo support.
  - Reduced decorative branding.

- `src/lib/constants/investorNavigation.js`
  - Release comment alignment.

- `public/sw.js`
  - Investor/Page cache refresh for installed PWAs.

- `scripts/qa/release-audit.mjs`
  - v0.34.3 regression contracts.

- `package.json`
- `package-lock.json`
  - Application version `0.34.3`.

## Release metadata

- Application: `0.34.3`
- Investor PWA cache: `growvest-investor-v0.34.3-visual1`
- Page cache: `growvest-pages-v0.34.3-visual1`
