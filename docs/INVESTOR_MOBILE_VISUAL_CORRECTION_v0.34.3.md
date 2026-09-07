# GrowVest Investor Mobile Visual Correction v0.34.3

## Purpose

v0.34.3 is a screenshot-led correction pass on the v0.34.2 Signature Mobile UI. The goal is not another redesign. It aligns the implemented phone experience more closely with the approved reference while preserving the existing routes, data model, security, API boundaries and desktop/tablet experience.

Primary QA viewport: **393px mobile width**, matching the device screenshots used during review.

## Corrections included

### Navigation
- Every secondary Investor screen now has a consistent slim back control.
- Root sections opened from the mobile app return to Home.
- Goal Detail returns to Bucket List.
- Holding Detail returns to Portfolio.
- Monthly Review Detail returns to Monthly Review.
- Login & Security returns to Profile.
- The floating GrowVest centre navigation action is reduced so it remains distinctive without dominating every screen.

### Home
- The official GrowVest combined logo is forced to a full white knockout on Royal Trust Blue so the blue symbol inside the source SVG cannot disappear into the hero background.
- The oversized decorative GrowVest watermark is removed.
- Hero height and vertical spacing are tightened.
- Privacy remains available beside the wealth value.
- Refresh is moved into the update line rather than floating as a competing circular action.
- Snapshot movement no longer displays a potentially misleading percentage when the change may include contributions as well as market movement.
- Goal progress below 1% displays as `<1%` rather than `0%`.

### Portfolio
- Portfolio-level Gain / Loss is aligned to the two source-of-truth totals shown to the investor: **Current Value minus Amount Invested**.
- The authenticated Investor App API uses the same portfolio-level calculation so dashboard and portfolio totals remain internally consistent.
- The chart uses all points available in the selected calendar range rather than silently limiting rendering to 12 points.
- Sparse history is labelled honestly as `Limited verified history available`.
- Date anchors are displayed under the chart.
- The performance line is visually lighter.
- Supporting metric labels are clarified as `Amount Invested` and `Gain / Loss vs invested`.

### Bucket List
- Search and status controls are adaptive. They no longer occupy half the page when the investor only has one or a few goals.
- Goal progress below 1% displays as `<1%`.
- A non-zero goal receives a minimum visible progress sliver without changing the underlying percentage.
- Positive progress states such as SIP running/on track use the primary GrowVest blue rather than an attention-looking yellow treatment.

### Goal Detail
- Progress below 1% displays as `<1%` instead of `0%`.
- Unsupported statements such as `This goal is progressing well` are removed when a target date is missing or the planning state cannot support that conclusion.
- Missing target dates now lead with `Set a target date to measure progress`.
- The redundant `All goals` link is removed because the global back control already provides navigation.
- Connected investments show four rows initially, with an explicit `View all` action for longer lists.
- Repeated `100% allocated` metadata is suppressed when it adds no information.
- Long official scheme names are visually truncated in the goal summary; the full holding remains available on drill-down.

### Profile
- Investor identity spacing is tightened.
- Financial Privacy is available directly inside Profile as well as the GrowVest action sheet.
- Advisor imagery is used when an advisor photo field is available; initials remain the fallback.
- The decorative black brand promo block is removed from the mobile Profile to reduce unnecessary visual noise.

## Brand rules retained

- Royal Trust Blue: `#1F4ED8`
- Deep Premium Black: `#0B0B0F`
- Strategic Red: `#E53935`
- Insight Yellow: `#F5B301`
- Soft Gray: `#F4F6F9`
- Medium Gray: `#6B7280`
- White: `#FFFFFF`
- Slim Lucide outline icons remain the interaction icon language.
- Financial green is semantic-only for positive investment values and is not treated as a GrowVest brand colour.

## Scope boundary

This release corrects the phone Investor App presentation only. It intentionally does not change investor permissions, portfolio import rules, report-generation logic, Firebase security, staff workflows or desktop/tablet information architecture.
