# GrowVest Investor Mobile Brand Color System v0.34.4

## Release intent

v0.34.4 applies the GrowVest brand palette as a meaning system rather than as decoration. It refines the phone Investor App on top of the v0.34.3 screenshot-led navigation and visual corrections without changing portfolio import, reporting, insurance, admin, or database architecture.

## Locked brand roles

- **Royal Trust Blue `#1F4ED8`** — GrowVest identity, active navigation, primary actions, progress, performance charts and normal/active financial states.
- **Deep Premium Black `#0B0B0F`** — primary wealth values, high-emphasis typography and Monthly Review summary surfaces.
- **Insight Yellow `#F5B301`** — reminders, planning gaps, due-soon states and GrowVest insight that needs attention but is not a failure.
- **Strategic Red `#E53935`** — overdue, failed, expired, lapsed, negative or genuinely urgent states only.
- **Soft Gray `#F4F6F9`** — neutral background/snapshot surfaces.
- **Medium Gray `#6B7280`** — supporting labels, dates and metadata.
- **White `#FFFFFF`** — primary content and breathing space.

The app deliberately avoids using all brand colors on every screen. Blue leads; Black and neutral surfaces create the premium structure; Yellow and Red appear only when they carry meaning.

## Home / Dashboard

- The Royal Trust Blue wealth hero now breaks through the phone shell gutter so it reads edge-to-edge beneath the blue app header.
- The four Home shortcuts use a locked slim outline mapping: Portfolio, Bucket List, Reports and Protection.
- Goal-category icons are shared with Bucket List/Goal Detail, so a Home Purchase uses the Home icon consistently.
- **What needs your attention** is data-driven and can surface up to two current priorities from:
  - actual SIP funding schedule/date,
  - protection renewal timing,
  - portfolio reconciliation/review state,
  - missing goal target date,
  - near-term GrowVest meeting,
  - newly available Monthly Review.
- Attention semantics are consistent: Blue = normal action, Yellow = planning/due-soon, Red = overdue/critical.

## Portfolio

- 1M / 3M / 6M / 1Y / All remains bound to `filterTrendByRange`, which filters by actual dates anchored to the latest verified snapshot.
- The old 24-snapshot cap has been removed so **All** can use the full available verified history.
- The selected range exposes `aria-pressed` and the chart displays the actual verified date range/point count.
- Positive portfolio emphasis uses Royal Trust Blue; Strategic Red remains reserved for negative values.
- Asset Allocation uses a thicker donut and a restrained GrowVest-led palette. Red is intentionally not used as a normal allocation category color.

## Bucket List and Goal Detail

- Bucket List now uses a compact summary strip for Goal corpus, Overall progress and Monthly plan so low-goal-count pages do not feel unfinished.
- Search/filter controls remain adaptive and stay out of the way when only a few goals exist.
- A planning insight appears when a target date or goal attention is missing; Insight Yellow is used for planning gaps rather than a generic warning red.
- Goal category icons come from one shared mapping and remain the same between Home, Bucket List and Goal Detail.
- Goal identity remains Royal Trust Blue; goal status is shown separately with Blue/Yellow/Red semantics.
- Non-zero progress below 1% continues to display `<1%`.

## Holding Detail

The **Investment snapshot** is now a deliberate highlighted surface using a light Royal Trust Blue tint. It surfaces the holding's core value/investment context without turning the entire page into a colored card layout.

## Monthly Review

Deep Premium Black remains the signature Monthly Review summary surface. Positive summary movement uses a light Royal Trust Blue accent rather than introducing an unrelated green brand treatment; negative movement remains Strategic Red.

## Protection

- Normal/active policy states use Royal Trust Blue.
- Expiring Soon, Premium Due and Grace Period use Insight Yellow.
- Expired, Lapsed and Cancelled use Strategic Red.
- An upcoming renewal more than 30 days away remains a normal Blue state; due-soon changes to Yellow; overdue changes to Red.

## Profile

Profile remains intentionally restrained: White, Deep Premium Black and Medium Gray dominate; Royal Trust Blue is reserved for identity, privacy controls and actionable links. No additional decorative color was added.

## Icon language

- Slim Lucide outline family.
- Bottom navigation: 19px, 1.4 stroke inactive / 1.55 active.
- Typical mobile feature/action icons: approximately 20–23px, 1.5–1.55 stroke.
- Same function and same goal category use the same icon across screens.
- The official GrowVest mark remains the center navigation action.

## Navigation preserved

The v0.34.3 back-navigation system remains intact. Home has no back button; secondary screens have a consistent slim back control with specific parent routes for Goal Detail, Holding Detail, Report Detail and Login & Security.
