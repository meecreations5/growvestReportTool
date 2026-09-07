# v0.34.0 Goals Build Hotfix

## Issue
Next.js 16.2.10 / Turbopack failed to parse `src/app/investor/goals/page.js` with `Expression expected` around the compact non-featured mobile goal-card JSX.

## Root cause
The non-featured goal card contained one extra closing `</div>` in a compressed single-line JSX return. This caused the JSX tree to close incorrectly immediately before `</article>`.

## Fix
- Rebuilt the non-featured mobile goal card as clearly nested multiline JSX.
- Removed the extra closing `div`.
- Preserved the v0.34.0 mobile design, progress bar, GrowVest colors, search/filter behaviour and data logic.

## Verification
A syntax-only JSX parser pass was run across all JavaScript/JSX files under `src` using the TypeScript parser:
- 406 files parsed
- 0 JSX parse errors

The existing v0.34.0 release audit still reports the same 14 design-regression expectation failures that were already present in the working build; this hotfix does not modify those audit expectations.
