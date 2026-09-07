# v0.33.9 - Investor Mobile App Recomposition

## Purpose

v0.33.9 rebuilds the Investor phone experience from first principles instead of continuing to layer visual treatment on top of the responsive portal. The goal is a calmer, more professional GrowVest wealth app with stronger information hierarchy, fewer competing gradient surfaces and clearer investor actions.

The redesign is phone-only below 768px. Tablet, desktop, staff and admin layouts remain on the established interface.

## Design principles

- One strong visual focal point per screen.
- White/light supporting surfaces after the primary wealth card.
- Fewer all-caps labels and less dashboard-style card stacking.
- Important investor questions first: current wealth, what changed, what needs attention and what is next.
- Official GrowVest SVG identity retained, with the icon-outline motif reduced to a subtle signature rather than decoration.
- Native-style navigation, compact filters and no horizontal clipping on phone widths.

## Mobile changes

### Loading / entry
- Simplified deep-navy loading screen using the official GrowVest SVG mark and logo.
- Faster website-to-app brand motion and a calmer progress treatment.
- Session key updated so the new motion is shown once per browser/PWA session.

### Home
- Shorter portfolio hero with a smaller chart and compact summary metrics.
- Quick Access remains four actions but with quieter card treatment.
- `Next for you` moves higher in the hierarchy.
- Financial Health is changed from four competing rings to a clear status list for Investments, Bucket List, Protection and Monthly Review.
- Priority goal, wealth mix and protection are retained as secondary surfaces.

### Portfolio
- Investments/Protection selector is now strictly phone-only below 768px.
- Shorter portfolio hero and chart.
- Portfolio movement is grouped into one `At a glance` card rather than four independent dashboard cards.
- Allocation donut is smaller and cleaner.
- Holdings remain fully accessible with View All.

### Bucket List
- The large gradient Bucket List hero is replaced by a compact white progress summary.
- Search and filters no longer depend on horizontally scrolling chips.
- All, On Track and Attention are always visible; complete filters remain in the native bottom sheet.
- Goal cards use quieter typography and tighter progress treatment.

### Protection
- Large blue hero and duplicate metric blocks are replaced by a compact Protection Health summary.
- Life, Health, Vehicle and Home are shown as a simple covered/not-added profile.
- Renewal timeline and active policies remain available without repeating the same values in multiple cards.

### Monthly Reviews
- Latest review becomes a calm white card with one blue wealth surface and a small trend visualization.
- Review history and report library use compact app rows.
- Monthly Review detail uses a smaller summary panel instead of another full-screen gradient hero.
- Report section navigation uses compact phone chips.

### Navigation / spacing
- Bottom navigation is slimmer, less visually dominant and uses a lighter active treatment.
- Mobile card shadows and borders are reduced.
- Section spacing is tightened for a more native app rhythm.

## Brand continuity

The GrowVest palette remains:
- Royal Trust Blue `#1F4ED8`
- Growth Cyan `#20B8CD`
- Deep Premium Black/Navy
- Insight Yellow `#F5B301`
- Strategic Red for genuine negative/overdue states only

The official SVG assets remain the source of truth for logo, icon and outline identity.

The guiding rule is one strong visual focal point per phone screen.
