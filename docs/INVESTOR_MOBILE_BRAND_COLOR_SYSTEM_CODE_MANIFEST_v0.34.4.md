# v0.34.4 Code Manifest — GrowVest Brand Color System & Screen Refinement

## Primary changed files

- `src/components/investor/MobileInvestorDashboard.js`
  - full-bleed Home hero hook
  - up to two data-driven attention priorities
  - SIP `daysUntilDebit` support
  - portfolio reconciliation and missing-target-date attention
  - consistent goal icon mapping
  - Royal Trust Blue / Insight Yellow / Strategic Red attention surfaces

- `src/components/investor/goalVisuals.js`
  - shared goal-category icon mapping
  - shared status tone semantics

- `src/lib/constants/investorNavigation.js`
  - Portfolio navigation aligned to the same slim chart icon used on Home

- `src/components/investor/InvestorShell.js`
  - slimmer, consistent bottom-navigation icon size/stroke treatment
  - existing v0.34.3 back navigation retained

- `src/components/portfolio/InvestorPortfolioPanel.js`
  - full verified history available to All range
  - visible range/date context and `aria-pressed` state
  - positive mobile emphasis moved to Royal Trust Blue
  - brand-led asset allocation colors
  - larger allocation donut

- `src/components/investor/mobile/MobileFinanceCharts.js`
  - thicker mobile donut ring

- `src/app/investor/goals/page.js`
  - shared category icons
  - Bucket List summary strip
  - adaptive planning insight
  - semantic goal-status colors

- `src/app/investor/goals/[goalId]/page.js`
  - shared category icon with listing/Home
  - Blue goal identity, Yellow planning gap, Red critical state
  - context-colored Plan at a glance icons

- `src/app/investor/portfolio/[positionId]/page.js`
  - highlighted Investment snapshot treatment

- `src/app/investor/reports/page.js`
  - Deep Premium Black Monthly Review summary retained
  - positive summary movement uses a brand-blue accent

- `src/components/reports/InvestorReportDetailClient.js`
  - brand-blue positive emphasis within the black mobile Monthly Review summary

- `src/components/insurance/InsuranceProtectionPanel.js`
  - Blue normal / Yellow warning / Red critical operational semantics

- `src/app/globals.css`
  - v0.34.4 full-bleed dashboard hero rule
  - reusable semantic brand insight surfaces

- `public/sw.js`
  - Investor PWA cache bumped to `v0.34.4-brand1`

- `package.json`
- `package-lock.json`
  - version bumped to `0.34.4`

- `scripts/qa/release-audit.mjs`
  - v0.34.4 release-contract assertions

## Audited but intentionally kept restrained

- `src/app/investor/profile/page.js`
  - existing neutral Profile treatment already matches v0.34.4 color rules; no decorative recoloring was introduced.

## Scope deliberately not changed

- portfolio import parsers/commit architecture
- admin portfolio management workflows
- report generation/PDF engine
- insurance data model
- Firestore data architecture
- authentication/permissions model
