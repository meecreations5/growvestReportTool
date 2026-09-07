# GrowVest Report Tool v0.34.3 - Release Validation

## Release metadata

- Application version: `0.34.3`
- Investor PWA cache: `growvest-investor-v0.34.3-visual1`
- Page cache: `growvest-pages-v0.34.3-visual1`
- Primary phone QA width: `393px`

## Scope

This release is a visual-correction and investor-trust pass based on actual device screenshots of v0.34.2. It preserves the existing system architecture while correcting implementation drift from the approved GrowVest mobile reference.

## Verified release intents

- Consistent back navigation across Investor secondary/root phone screens.
- Complete readable GrowVest home logo on Royal Trust Blue.
- Tighter Home composition with no oversized decorative watermark.
- Reduced centre-navigation dominance.
- Portfolio Current Value / Amount Invested / Gain-Loss consistency.
- Honest sparse-history chart treatment.
- Adaptive Bucket List controls.
- `<1%` goal progress instead of visually incorrect `0%` for non-zero progress.
- Planning-aware Goal Detail guidance.
- Shorter connected-investment presentation.
- Cleaner Profile with Financial Privacy access.

## Validation commands

Run locally after dependency installation:

```bash
npm ci
npm run qa
npm run lint
npm run build
```

The source package intentionally excludes `node_modules`, `.next`, `.env` and `.env.local`.

## Validation completed in this release workspace

- `npm run qa` equivalent (`node scripts/qa/release-audit.mjs`): **308 passed, 0 warnings, 0 failures**.
- Changed Investor JSX files parsed with the available TypeScript parser: **0 diagnostics**.
- Server/config JavaScript syntax checks (`node --check`): **passed** for the Investor app-data route, release audit, service worker and Next.js config.
- Package cleanliness check: no `node_modules`, `.next`, `.git`, `.env` or `.env.local` included.

## Environment limitation

A full dependency-backed `npm ci`, `npm run lint` and `npm run build` was not executed in this workspace because project dependencies are not installed here and npm package retrieval is unavailable. Run the commands above on the normal development machine before deployment.
