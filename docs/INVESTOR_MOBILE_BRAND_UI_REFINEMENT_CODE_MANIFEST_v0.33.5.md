# v0.33.5 Investor Mobile Brand UI Refinement - Code Manifest

## Updated files

- `src/app/globals.css`
  - Phone-only viewport containment and wrapping helpers.
  - GrowVest Royal Trust Blue, Growth Cyan and Insight Yellow mobile surface utilities.
  - Compact mobile status-strip styling.

- `src/app/investor/documents/page.js`
  - Compact expandable upload guidance on phones.
  - One-row document status summary.
  - Overflow-safe document cards.
  - Mobile action hierarchy for View, Download and Replace/Upload.
  - Desktop/tablet workflow retained.

- `src/components/portfolio/InvestorPortfolioPanel.js`
  - Phone-first Portfolio Intelligence hierarchy.
  - Full-width long holding name treatment.
  - GrowVest-branded movement/cash-flow cards.
  - Safer NAV/price movement wrapping.

- `src/components/investor/InvestorShell.js`
  - Active mobile navigation and phone back-button surfaces aligned to dynamic GrowVest brand colors.

- `public/sw.js`
  - PWA cache bump to `v0.33.5-ui2`.

- `scripts/qa/release-audit.mjs`
  - Regression checks for the phone-only brand/overflow refinement.

- `README.md`
  - Release note for this hotfix.
