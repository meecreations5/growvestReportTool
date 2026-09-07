# v0.34.0 - Investor Mobile Premium Reference Replication & Performance

## Scope

This release completes the phone-only GrowVest Investor App design pass based on the approved premium finance-app reference board. The new experience remains scoped to screens below 768px; Staff, Admin, tablet and desktop interfaces keep their existing workflows and layout.

## Premium mobile page system

The Investor App now follows one shared visual hierarchy across the approved reference pages:

1. **Splash / Loading** - official GrowVest SVG mark and logo, session-gated brand animation, subtle outline motif and a compact route skeleton after the initial app entry.
2. **Home** - calm greeting, one primary wealth card, privacy mode, portfolio trend, four quick actions, `Next for you`, primary Bucket List progress and GrowVest Partner access.
3. **Portfolio** - clean portfolio value hierarchy, period controls, line chart, asset allocation donut, insight card, top holdings and direct Holding Detail drill-down.
4. **Holding Detail** - current value, gain/loss, invested amount, units, NAV/price, allocation, Bucket List allocation, source and transaction history.
5. **Bucket List / Goals** - calm life-goal hierarchy, featured primary goal, search and compact filter system with full status filtering in a bottom sheet.
6. **Protection** - Protection Confidence, life/health/vehicle/home coverage and upcoming renewal visibility without mixing insurance cover into AUM.
7. **Monthly Review** - story-first review library and one-minute report view showing overall monthly change, money added, investment movement and money withdrawn before the detailed report.
8. **Documents** - compact secure document list with status filters and contextual View / Download / Replace actions.
9. **Notifications** - `Action Required` and `Updates` views with semantic icon colours and notification preferences in a bottom sheet.
10. **Profile / More** - minimal account/settings layout, verified investor identity, personal details, GrowVest Partner access and security routes.

## GrowVest motion language

The official `growvest-icon.svg`, `growvest-icon-outline.svg` and official logo SVGs remain the source of truth. The first Investor App entry in a browser/PWA session uses the branded mark animation and then transitions to the app. Route-to-route loading uses a lightweight compact GrowVest activity mark with skeleton placeholders instead of replaying the full splash.

The motion system respects `prefers-reduced-motion`.

## Page performance

v0.34.0 adds performance controls specifically for the Investor App:

- short-lived authenticated client response cache per Investor and section;
- in-flight request deduplication to prevent duplicate API calls during rapid rerenders;
- section-specific TTLs for Dashboard, Goals, Reports, Documents, Meetings, Profile and Security;
- explicit forced refresh when live portfolio/document data must bypass cache;
- lightweight server responses for utility sections so Documents, Meetings, Reports, Profile and Security do not load the full Portfolio Master unnecessarily;
- `content-visibility: auto` for selected below-the-fold phone sections;
- one-time-per-session full GrowVest entry animation, followed by compact route skeletons;
- Holding Detail data is loaded only when an investor opens a specific position.

All authenticated API responses remain private and are not relaxed through Firestore browser permissions.

## Design principles

- One strong visual focal point per screen.
- Royal Trust Blue and Growth Cyan are used selectively rather than across every card.
- Most supporting surfaces are calm white / soft grey.
- Financial numbers receive the strongest hierarchy.
- Tables are replaced by touch-friendly cards/lists on phones.
- GrowVest outline branding is intentionally subtle.
- Human language is preferred over database/admin terminology.
- Important investor decisions are surfaced through `Next for you` and action-oriented review stories.

## Brand palette

- Royal Trust Blue `#1F4ED8`
- Growth Cyan `#20B8CD`
- Deep Premium Black `#0B0B0F`
- Insight Yellow `#F5B301`
- Strategic Red `#E53935`
- Soft Gray `#F4F6F9`
- White `#FFFFFF`

## UAT focus

Test at 320, 360, 390 and 430px widths, Android Chrome/PWA and iPhone Safari. Verify scrolling, bottom safe areas, long instrument names, keyboard opening, document preview, Holding Detail access, report expansion, notification deep links, animated logo behaviour and route loading performance.
