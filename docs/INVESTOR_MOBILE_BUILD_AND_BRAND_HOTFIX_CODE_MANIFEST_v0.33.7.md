# v0.33.7 Code Manifest - Investor Mobile Build & Brand Hotfix

Changed files:

- `src/app/investor/meetings/page.js`
  - repairs the unbalanced desktop JSX branch that caused the Turbopack `Expression expected` build error.
- `src/components/investor/InvestorShell.js`
  - uses the complete official `growvest-logo-dark.svg` lockup on the mobile Home app bar instead of the split wordmark asset.
- `public/brand/growvest-icon-outline.svg`
  - reduces the brand-outline stroke from `0.65` to `0.28` for a more premium hero watermark.
- `public/sw.js`
  - bumps Investor PWA caches to `v0.33.7-ui2`.
- `scripts/qa/release-audit.mjs`
  - aligns brand/cache regression checks with the corrected official logo lockup and refreshed cache.
- `docs/INVESTOR_MOBILE_BUILD_AND_BRAND_HOTFIX_v0.33.7.md`
- `docs/INVESTOR_MOBILE_BUILD_AND_BRAND_HOTFIX_CODE_MANIFEST_v0.33.7.md`
