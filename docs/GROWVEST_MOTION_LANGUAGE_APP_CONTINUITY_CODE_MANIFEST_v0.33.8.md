# v0.33.8 Code Manifest - GrowVest Motion Language & Website-to-App Continuity

## New components

- `src/components/investor/mobile/GrowVestMotionMark.js`
  - official icon outline + filled icon layering
  - reusable full and compact brand-motion states
  - compact activity indicator for refresh/report preparation
- `src/components/investor/mobile/InvestorEntryMotion.js`
  - phone-only, once-per-session Investor App entry handoff

## Updated components

- `src/components/investor/mobile/InvestorAppSplash.js`
  - official GrowVest motion mark
  - logo/wordmark reveal
  - branded loading copy and progress treatment
- `src/components/investor/InvestorShell.js`
  - mounts the session-gated mobile entry motion
- `src/components/investor/MobileInvestorDashboard.js`
  - GrowVest animated mark during Portfolio Master refresh
- `src/app/investor/reports/page.js`
  - GrowVest animated mark while Monthly Review PDFs are prepared
- `src/app/globals.css`
  - motion keyframes, website-to-app handoff animation, compact activity motion and reduced-motion safeguards
- `public/sw.js`
  - Investor PWA cache bump to `v0.33.8-motion1`
- `package.json`, `package-lock.json`
  - release version `0.33.8`
- `scripts/qa/release-audit.mjs`
  - v0.33.8 regression assertions

## Documentation

- `docs/GROWVEST_MOTION_LANGUAGE_APP_CONTINUITY_v0.33.8.md`
- `docs/GROWVEST_MOTION_LANGUAGE_APP_CONTINUITY_CODE_MANIFEST_v0.33.8.md`
