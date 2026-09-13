# GrowVest v0.34.18 - Release Validation

## Release
**Locked Report Visual Parity: Icons & Numeric Alignment**

## Validation summary
- Release audit: **456 passed, 0 warnings, 0 failures**.
- `reportPdf.js`: Node syntax check passed.
- `reportServer.js`: Node syntax check passed.
- `release-audit.mjs`: Node syntax check passed.
- `GrowVestSignatureReportDocument.js`: TypeScript JSX parser reported **0 parse diagnostics**.
- Opening Wealth Review goal-reconciliation fixture passed.
- Opening Portfolio Verification fixture passed.
- PDF WinAnsi encoding fixture passed.
- Visual QA PDF rendered at 150 DPI and inspected for icon visibility, KPI grid consistency, goal-number alignment, GrowVest View icons and numbered Next Steps.

## Visual parity changes validated
- KPI cards use separate Portfolio, Invested, Gain/Loss and SIP icons.
- Starting Point and closing CTA use a GrowVest-style leaf role.
- Goal card uses target iconography.
- Performance uses a chart/performance icon instead of a generic minus marker.
- GrowVest View uses Binoculars, Compass and Gear visual roles.
- Protection and upcoming-review callouts use Shield and Calendar visual roles.
- Browser numeric columns use tabular/lining numerals.
- Browser allocation, goal and investment numeric columns are right-aligned.
- Secure PDF table secondary numeric details follow the same right edge as their parent numeric column.
- Secure PDF renderer version is **2.4.6**.
- Installed PWA cache is **v0.34.18-visual-parity1**.

## Business logic
No portfolio, goal, SIP, reconciliation, Opening Review, publishing, or historical-report calculation was intentionally changed in this release.

## Environment limitation
The clean release does not include `node_modules`. An `npm ci --ignore-scripts` attempt in this isolated environment timed out, so the full Next.js `npm run lint` / `npm run build` pipeline could not be executed here. Run `npm ci`, `npm run lint`, and `npm run build` in the normal project/deployment environment before production deployment.

## Deployment QA
After deployment, generate one real Opening Wealth Review and compare the browser Preview PDF and secure downloaded PDF. Specifically confirm KPI icons, GrowVest View icons, table number right edges, Rupee rendering, cover quality and page count before bulk-generating investor reports.
