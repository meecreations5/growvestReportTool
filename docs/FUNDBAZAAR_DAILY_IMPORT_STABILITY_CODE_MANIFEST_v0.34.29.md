# v0.34.29 Code Manifest — Fundbazaar Daily Import Stability

- `src/app/api/portfolio/imports/fundbazaar/commit/route.js`
  - commit-stage diagnostics
  - safe Fundbazaar field defaults / finite-number guards
  - explicit stale-preview fingerprint validation
  - direct file-level failure persistence
  - non-opaque snapshot / coverage post-commit warnings
  - batch failureStage / importError persistence
- `src/components/portfolio/PortfolioImportCentre.js`
  - amber partial-success state
  - failed file and derived refresh warning visibility
- `public/sw.js`
  - installed PWA cache refresh for v0.34.29
