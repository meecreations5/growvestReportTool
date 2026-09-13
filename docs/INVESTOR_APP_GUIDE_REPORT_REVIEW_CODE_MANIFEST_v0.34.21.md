# GrowVest v0.34.21 - Code Manifest

## Added
- `src/components/investor/InvestorAppGuideTour.js`
  - first-run phone Investor App guide
  - real bottom-navigation spotlight targeting
  - local completed state and replay support
- `docs/INVESTOR_APP_GUIDE_TOUR_v0.34.21.md`
- `docs/REPORT_DESIGN_VERIFICATION_v0.34.21.md`

## Modified
- `src/components/investor/InvestorShell.js`
  - mounts the App Guide
  - marks mobile nav targets
  - adds **App guide** replay inside the GrowVest action sheet
- `src/lib/constants/investorNavigation.js`
  - adds stable tour target keys to the four standard mobile navigation items
- `public/sw.js`
  - installed-PWA cache refresh `v0.34.21-app-guide1`
- `package.json`, `package-lock.json`
  - release version `0.34.21`
- `scripts/qa/release-audit.mjs`
  - v0.34.21 guide/report-review assertions
- `README.md`
  - v0.34.21 release summary

## Intentionally unchanged
- report financial calculations
- report publishing/version history logic
- secure PDF renderer version `2.4.7`
- locked report visual version and signature template
- Firestore rules/indexes
- Investor app tablet/desktop UI
