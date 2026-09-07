# GrowVest Report Tool v0.34.4 — Release Validation

Date: 07 September 2026
Release: **GrowVest Brand Color System & Screen Refinement**

## Automated project audit

`npm run qa`

- **318 passed**
- **0 warnings**
- **0 failures**

The audit includes the v0.34.4 contracts for Home attention logic, navigation/icon mapping, Portfolio range wiring, full-history All view, allocation colors/donut weight, Bucket List/Goal Detail icon consistency, Holding Detail snapshot emphasis, Monthly Review brand treatment, Protection status semantics, PWA cache/version metadata and packaged release documentation.

## Portfolio period filter functional check

`filterTrendByRange()` was executed with dated sample snapshots and verified to return distinct actual calendar ranges:

- 1M -> latest one-month history
- 3M -> latest three-month history
- 6M -> latest six-month history
- 1Y -> latest twelve-month history
- All -> complete supplied verified history

The Portfolio UI is bound to the selected range through `setRange()` + `filterTrendByRange(rawTrend, range)` and exposes `aria-pressed` for the active period.

## Source-level checks

Node syntax checks passed for the changed non-JSX/runtime files including:

- `scripts/qa/release-audit.mjs`
- `public/sw.js`
- `src/lib/utils/investorExperience.js`
- `src/lib/constants/investorNavigation.js`
- `src/components/investor/goalVisuals.js`

Additional source assertions confirmed:

- no stale undefined Portfolio allocation `colors[index]` reference remains;
- mobile Monthly Review summaries no longer use the legacy emerald positive accent;
- package version is `0.34.4`;
- Investor PWA caches are `v0.34.4-brand1`.

## Dependency-backed build limitation

A complete `npm ci -> npm run lint -> npm run build` could not be executed in this environment because npm registry DNS is unavailable (`EAI_AGAIN`) and the local npm cache does not contain every required package (`ENOTCACHED` for `scheduler`).

On the development machine, complete the final dependency-backed verification with:

```bash
npm ci
npm run lint
npm run build
```

This limitation is environmental and is not recorded as a passed build.
