# GrowVest v0.34.23 - Release Validation

## Release
**Report Alignment & Cover Clarity Reconciliation**

## Included
- Re-render review of the supplied 9-page Opening Wealth Review identified the remaining issues on pages 1, 2, 7 and 9.
- Tightened and vertically balanced the Starting Point callout.
- Reduced and vertically centred the Performance information callout.
- Standardised Protection callout icon/text insets.
- Rebalanced the final Grow and Invest With Us banner and icon/text baselines.
- Re-centred the custom leaf vector inside report badges.
- Applied a stronger non-generative detail-recovery pass to the locked cover photograph without changing crop/composition.
- Bumped secure PDF renderer metadata to `2.4.9`.
- Refreshed installed PWA caches to `v0.34.23-report-align1`.

## Required deployment QA
1. Generate a **fresh** Opening Wealth Review after deployment; do not judge a previously generated/stored PDF.
2. On page 1, verify the investor/backpack and mountain edges are visibly clearer and the cover image is not stretched.
3. On page 2, verify the Starting Point icon, heading and paragraph form one vertically centred group with balanced top/bottom padding.
4. On page 7, verify the monthly-performance information strip is compact and the icon/text share the same visual centre line.
5. On page 9, verify the Protection strip uses the same left inset rhythm as other callouts.
6. On page 9, verify the closing banner has a compact height, centred icon and correctly centred title/subtitle.
7. Confirm Asset Allocation remains a solid donut and all v0.34.22 corrections remain intact.
8. Confirm Rupee orientation/baseline from v0.34.20 remains correct.
9. Confirm all report financial values and calculations are unchanged.
10. Run `npm ci`, `npm run qa`, `npm run qa:opening-review`, `npm run qa:opening-verification`, `npm run qa:pdf-encoding`, `npm run lint`, and `npm run build` in the deployment environment.

## Environment note
The release ZIP excludes `node_modules` and build output. In this isolated review environment, full dependency installation is not reliable, so deployment QA must perform the clean install/lint/build checks.
