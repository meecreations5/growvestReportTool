# v0.34.26 Code Manifest

## Changed files

- `src/app/api/portfolio/investors/[investorId]/manual-import/route.js`
  - ignores the simple Excel `Valuation Date` input
  - uses import date as the effective Manual valuation/freshness date
  - defaults a newly created holding's Investment/Purchase Date to import date when Excel Investment Date is blank
  - preserves existing Investment/Purchase Date on update
  - relies on the existing position ID contract where folio/account/policy number is part of holding identity
- `src/components/portfolio/ManualPortfolioExcelPanel.js`
  - explains the optional Valuation Date rule and new-folio behavior in the UI
- `public/sw.js`
  - cache version bumped for v0.34.26
- `package.json`, `package-lock.json`
  - release metadata updated
- `scripts/qa/release-audit.mjs`
  - release checks updated and v0.34.26 controls added
