# v0.34.5 — Exact Home Reference Code Manifest

Changed for the approved Home screenshot match:

- `src/components/investor/MobileInvestorDashboard.js`
  - Compact approved hero proportions.
  - Privacy beside wealth and icon-only refresh.
  - Rounded floating quick-action tray instead of one large curved content sheet.
  - One priority attention preview with in-place expansion.
  - Compact Bucket List preview.
  - Compact Deep Premium Black Monthly Review feature.
  - Compact GrowVest Partner row.
- `src/components/investor/InvestorShell.js`
  - Home header sizing aligned to the approved reference.
- `src/components/notifications/NotificationBell.js`
  - Compact Home bell treatment.
- `src/lib/constants/investorNavigation.js`
  - Uses Reports as the fifth persistent phone tab; Profile remains available from the Home avatar and GrowVest menu.
- `src/app/api/investor/app-data/route.js`
  - Exposes previous-snapshot movement percentage for the approved Home movement line.
- `src/app/globals.css`
  - Locks the full-bleed hero + floating rounded quick-action tray structure.
- `public/sw.js`
  - Installed-PWA cache bump to `v0.34.5-home-exact2`.
- `scripts/qa/release-audit.mjs`
  - Regression checks updated to the exact approved Home reference.
