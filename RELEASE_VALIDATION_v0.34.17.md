# GrowVest v0.34.17 Release Validation

**Release:** Investor Wealth Review Design Polish  
**Version:** 0.34.17  
**Secure PDF renderer:** 2.4.5  
**PWA cache:** `v0.34.17-report-polish1`

## Scope validated

This release keeps the approved GrowVest Signature visual direction locked and corrects implementation gaps observed in the real Nikhil Dalvi Opening Wealth Review:

- proportional high-resolution cover treatment with smooth wash
- Indian Rupee presentation in the secure Signature PDF without WinAnsi encoding risk
- larger A4 KPI / chart / table hierarchy
- `Not set` target allocation behaviour when no target has been configured
- balanced six-holding portfolio pages and secondary Goal / Corpus labels
- explicit Opening Review baseline date
- no dedicated empty Protection page
- de-duplicated GrowVest View and approved `consistent contributions` wording
- rebalanced one-action Next Steps page

## Release audit

`npm run qa`

**Result: 447 passed, 0 warnings, 0 failures.**

## Functional fixtures

- `npm run qa:opening-review` - PASS
  - General Wealth / Corpus Creation: ₹24,298
  - Target: ₹10,00,000
  - Progress: 2.4%
  - Active SIP: ₹3,000
  - Status: SIP Running
  - Invalid allocations: 0

- `npm run qa:pdf-encoding` - PASS
  - WinAnsi control-character boundary remains protected for StandardFont text.
  - GrowVest Signature financial amounts additionally use a vector Rupee glyph in the secure PDF renderer.

- `npm run qa:opening-verification` - PASS
  - Opening holdings establish a baseline.
  - New / Exited holding comparison is not applied to the Opening Wealth Review.
  - Warning and blocking reconciliation severity remain distinct.

## Syntax checks

`node --check` passed for changed non-JSX JavaScript/MJS files including:

- `src/lib/server/reportPdf.js`
- `src/services/marketCommentaryService.js`
- `src/lib/server/reportServer.js`
- `scripts/qa/release-audit.mjs`

The clean release does not include `node_modules`, so a full Next.js `lint` / `build` was not executed in this packaging environment.

## PDF visual QA

A 9-page Nikhil Dalvi Opening Wealth Review reference was generated from the supplied report data and rendered to PNG at 160 DPI.

Visual inspection covered:

- cover composition and full closing line
- KPI hierarchy
- Asset Allocation donut and `Not set` target state
- Bucket List / Wealth Goal page
- balanced Investment Portfolio pages
- Opening baseline date
- GrowVest View without duplicated commentary
- compact protection note and rebalanced single-action closing page

PDF preflight:

- 9 pages
- openable
- not encrypted
- searchable / non-scanned
- no XFA

A render comparison was also produced against the supplied 10-page Nikhil Dalvi report. Page count is intentionally reduced from 10 to 9 when no Protection policy data exists.

## Changed implementation surface from v0.34.16

- `README.md`
- `package.json`
- `package-lock.json`
- `public/sw.js`
- `public/brand/growvest-wealth-review-cover.jpg`
- `public/brand/growvest-cover-wash.png` (new)
- `src/app/globals.css`
- `src/components/reports/GrowVestSignatureReportDocument.js`
- `src/lib/server/reportPdf.js`
- `src/lib/server/reportServer.js`
- `src/services/marketCommentaryService.js`
- `scripts/qa/release-audit.mjs`
- `docs/GROWVEST_REPORT_DESIGN_POLISH_v0.34.17.md` (new)
- `docs/GROWVEST_REPORT_DESIGN_POLISH_CODE_MANIFEST_v0.34.17.md` (new)

## Deployment gate

After merging into the normal development environment:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. deploy to staging/preview
5. hard refresh or reopen the installed PWA because report artwork/cache changed
6. generate one real Opening Wealth Review
7. compare browser Preview PDF and secure downloaded PDF before bulk investor generation

The locked visual direction should not be reinterpreted during that QA pass; only implementation defects should be corrected.
