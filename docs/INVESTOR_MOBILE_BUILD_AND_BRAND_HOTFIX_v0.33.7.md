# v0.33.7 - Investor Mobile Build & Brand Hotfix

This hotfix closes three issues found during phone UAT after the professional UI release.

## Meetings build error

The desktop fallback render branch in `src/app/investor/meetings/page.js` contained an unbalanced nested JSX conditional. Turbopack therefore failed with `Expression expected` near the empty-state branch. The conditional is now fully parenthesized and formatted into explicit loading, summary, meeting-list and empty-state branches.

## Official GrowVest logo in the phone Home app bar

The Home header was using `growvest-wordmark-dark.svg`. That asset intentionally contains the `gro` and `est` word segments with a centre gap intended for the GrowVest symbol, so using it by itself rendered as `gro  est`.

The phone Home app bar now uses `growvest-logo-dark.svg`, which contains the complete official GrowVest lockup including the blue GrowVest symbol.

## Thinner hero watermark

The official-icon-derived outline watermark used on mobile hero cards has been refined from a `0.65` SVG stroke to a `0.28` stroke. At the normal hero render size this produces an approximately one-pixel visual line instead of a heavy outline.

The installed-PWA cache is bumped to `v0.33.7-ui2` so the corrected outline asset and app-shell changes are refreshed in installed Investor Apps.
