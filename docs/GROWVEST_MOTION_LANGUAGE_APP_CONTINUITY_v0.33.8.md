# v0.33.8 - GrowVest Motion Language & Website-to-App Continuity

## Purpose

The Investor mobile experience now carries the GrowVest brand motion into the app so the public website, Investor Login and installed Investor App feel like one continuous GrowVest experience.

The motion deliberately uses the official GrowVest SVG assets already supplied by the brand team. The app does not introduce a replacement logo or a generic fintech loader.

## Motion language

### 1. Investor entry / loading

On phones below 768px, the first authenticated Investor App entry in a browser session presents a short branded handoff:

1. the thin official GrowVest icon outline forms,
2. a cyan/white light sweep travels through the mark,
3. the official filled icon settles,
4. the official white GrowVest logo and `Your Conscious Wealth Partner` appear,
5. `Preparing your wealth view...` and the branded progress line complete the transition,
6. the screen fades into the Investor dashboard.

The entry is shown once per browser session instead of on every tab change so normal app navigation remains immediate.

### 2. Portfolio refresh

The Home dashboard keeps the familiar refresh control, but while Portfolio Master data is being refreshed the generic spinning icon is replaced by the animated GrowVest mark.

### 3. Monthly report preparation

When an Investor requests a Monthly Review PDF, the preparation state uses the same compact GrowVest motion mark. This visually connects report generation with the loading/refresh language rather than introducing a separate spinner.

### 4. Static brand continuity

The thin GrowVest outline watermark already used in Home, Portfolio, Goals, Reports and other key brand surfaces remains the static state of the same identity. Motion is therefore reserved for meaningful transitions rather than placed on every card.

## Accessibility

`prefers-reduced-motion: reduce` is respected. In reduced-motion mode the icon and wordmark are shown without drawing, sweep or looping drift effects and the first-entry handoff is shortened.

## Scope

- Investor App phones below 768px: enhanced motion language and once-per-session entry handoff.
- Investor tablet / desktop: no new blocking entry animation.
- Staff / Admin: unchanged.
- Portfolio, calculations, permissions and data models: unchanged.

## PWA

Installed Investor App caches are bumped to `v0.33.8-motion1` so the motion components and current official SVG assets refresh cleanly.
