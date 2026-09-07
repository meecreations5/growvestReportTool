# v0.33.5 Investor Mobile Brand UI Refinement Hotfix

This hotfix refines the **phone-only Investor App experience below 768px**. Tablet and desktop layouts remain unchanged.

## GrowVest mobile design language

The phone UI now uses the published GrowVest palette consistently:

- **Royal Trust Blue** `#1F4ED8` for primary actions, active navigation and key information.
- **Growth Cyan** `#20B8CD` for supporting highlights and secondary financial information.
- **Insight Yellow** `#F5B301` for attention/withdrawal information where a warning accent is appropriate.
- Existing semantic green/red states remain reserved for verified/success and negative/error states.

The colors are driven through the existing dynamic branding variables so future Branding Settings changes continue to flow through the Investor App.

## Documents mobile redesign

The Documents page is now app-first on phones:

- Replaces the large always-open upload explainer with a compact expandable **How document upload works** panel.
- Replaces three oversized KPI cards with one contained status strip for Action, Review and Verified counts.
- Ensures status badges, filenames and file icons stay inside the document card at narrow phone widths.
- Uses a clear action hierarchy: **View** is the primary Royal Trust Blue action, **Download** is the secondary Growth Cyan action, and **Replace file** is tertiary.
- Keeps the existing desktop document workflow unchanged at 768px and above.

## Portfolio Intelligence mobile redesign

Portfolio Intelligence now uses a stronger app hierarchy on phones:

- Month-on-month movement is the lead card.
- Holding changes and largest asset class are supporting cards.
- Largest holding uses a full-width row so long investment names can wrap instead of being truncated.
- Previous value, fresh investment, withdrawals and investment movement use compact 2-column app cards with GrowVest brand accents.
- NAV/price movement names wrap safely on phones while retaining desktop truncation behavior.

## Mobile overflow hardening

The Investor App mobile design system now explicitly constrains `main`, sections, articles and media to the phone viewport, adds reusable wrapping/containment helpers and prevents component widths from escaping the app shell.

This addresses the right-side clipping seen on narrow phone screenshots without changing tablet or desktop behavior.

## PWA cache

The Investor PWA cache key is bumped to `v0.33.5-ui2` so installed apps receive the mobile CSS/component refinement after update.
