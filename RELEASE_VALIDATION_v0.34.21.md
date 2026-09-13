# GrowVest v0.34.21 - Release Validation

## Release
**Investor App Guide Tour + Locked Report Design Verification**

## Included
- Added a phone-only first-run Investor App guide.
- Added a permanent replay entry under **GrowVest -> App guide**.
- Preserved the approved five-position mobile navigation and locked Home composition.
- Verified the locked GrowVest Signature selection path in both browser and secure PDF renderers.
- Verified that the cover is proportionally cropped rather than stretched.
- Identified the remaining cover softness as a source-image quality issue, not a current sizing/distortion bug.
- Preserved the v0.34.20 upright Rupee vector hotfix and secure PDF renderer `2.4.7`.
- Refreshed installed PWA caches to `v0.34.21-app-guide1`.

## Required deployment QA
1. Login as a real Investor on a phone-width viewport below 768px.
2. Confirm the existing GrowVest entry motion completes before the guide appears.
3. Complete all guide steps and verify the spotlight moves across Home, Portfolio, GrowVest, Bucket List and Reports.
4. Reopen **GrowVest -> App guide** and confirm replay works.
5. Refresh/reopen the app and confirm the guide does not auto-open again for the same Investor profile.
6. Generate one Opening Wealth Review and compare browser exact-design view with secure downloaded PDF.
7. Confirm Rupee orientation/baseline, cover crop, KPI icons, numeric alignment, page breaks and PDF opening.
8. Replace the current cover JPG only if a sharper original source is available; do not resize/stretch the current asset as a quality workaround.

## Environment
The release package intentionally excludes `node_modules`. Run `npm ci`, `npm run lint`, and `npm run build` in the normal deployment environment before production deployment.
