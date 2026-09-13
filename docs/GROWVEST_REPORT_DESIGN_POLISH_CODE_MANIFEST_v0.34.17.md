# v0.34.17 Code Manifest - Investor Wealth Review Design Polish

## Primary implementation files

- `src/components/reports/GrowVestSignatureReportDocument.js`
  - target allocation `Not set`
  - balanced six-holding page distribution
  - opening baseline date
  - conditional Protection page
  - non-duplicated GrowVest View
  - single-action / no-protection closing treatment

- `src/app/globals.css`
  - larger A4 typography and KPI hierarchy
  - 66% proportional cover-photo region
  - smooth cover wash support
  - enlarged allocation/goal/table/performance treatments
  - single-action and inline-protection layouts

- `src/lib/server/reportPdf.js`
  - secure Signature vector Rupee glyph
  - smooth packaged cover wash
  - enlarged Allocation/Goal/Performance treatments
  - target-allocation `Not set`
  - balanced holding pagination and secondary Goal/Corpus labels
  - conditional Protection page
  - GrowVest View de-duplication
  - compact no-protection note on Next Steps

- `src/services/marketCommentaryService.js`
  - default wording changed from `disciplined contributions` to `consistent contributions`

- `public/brand/growvest-wealth-review-cover.jpg`
  - higher-resolution 1800 x 3600 portrait cover artwork

- `public/brand/growvest-cover-wash.png`
  - smooth full-A4 white-to-transparent cover wash

- `public/sw.js`
  - v0.34.17 PWA cache refresh
  - cover wash added to app shell

- `src/lib/server/reportServer.js`
  - secure renderer version bumped to `2.4.5`

- `package.json`, `package-lock.json`
  - version `0.34.17`

- `scripts/qa/release-audit.mjs`
  - v0.34.17 design-polish release assertions
