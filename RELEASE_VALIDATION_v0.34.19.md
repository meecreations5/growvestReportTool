# GrowVest v0.34.19 - Release Validation

## Release
**Responsive Exact Report Viewer - Mobile + Desktop**

## Validation summary
- Release audit: **464 passed, 0 warnings, 0 failures**.
- `ResponsiveReportPreview.js`: TypeScript JSX parser reported **0 parse diagnostics**.
- `ReportPrintClient.js`: TypeScript JSX parser reported **0 parse diagnostics**.
- `InvestorReportDetailClient.js`: TypeScript JSX parser reported **0 parse diagnostics**.
- Opening Wealth Review goal-reconciliation fixture passed.
- Opening Portfolio Verification fixture passed.
- PDF WinAnsi encoding fixture passed.
- Locked secure PDF renderer remains **2.4.6**; no PDF financial or renderer logic changed.
- Existing PDF was re-rendered successfully to verify the canonical A4 design still renders normally.

## Responsive behavior validated in source
- Same fixed A4 report component is used on desktop and mobile.
- Viewer uses ResizeObserver to calculate fit-to-width scaling.
- Report pages never reflow into a different mobile template.
- Zoom controls affect only the viewer.
- Mobile horizontal scrolling is available when the user zooms beyond fit width.
- Print CSS resets the viewer to 100%, preserving A4 page geometry.
- Phone Investor Report now exposes **View exact report design** while preserving the existing interactive one-minute review.
- Print-preview toolbar is compact on narrow screens.

## Visual reference
A mobile/desktop comparison reference was created from the locked GrowVest Signature cover to demonstrate the intended behavior: the same visual composition is scaled, not redesigned.

## PWA
Installed cache is refreshed to:
- `growvest-investor-v0.34.19-responsive-report1`
- `growvest-pages-v0.34.19-responsive-report1`

## Environment limitation
The clean release does not package `node_modules`. Full `npm run lint` / `npm run build` should be run in the normal deployment environment after `npm ci`.

## Deployment QA
Test one published investor report on:
1. 390px phone viewport
2. 768px tablet viewport
3. 1366px+ desktop viewport
4. Browser Print / Save as PDF

Confirm that cover composition, icons, numeric alignment, chart placement, card proportions and page breaks remain identical to the locked visual reference at every viewport size.
