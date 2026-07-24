# GrowVest v0.30.1 — Investor Mobile Width and Overflow Fix

## Issue
The Investor dashboard could become wider than the mobile viewport. The quick-access horizontal carousel contributed intrinsic width to the parent CSS grid, causing the hero, KPI cards and action buttons to be clipped on the right.

## Corrections
- Constrained the Investor shell, content grid and main area to the viewport width.
- Changed single-column grid tracks to `minmax(0, 1fr)` so horizontal carousels cannot widen the page.
- Contained the quick-access carousel inside its own scroll area.
- Removed the negative horizontal margin from the carousel.
- Constrained KPI grid columns and cards with `min-width: 0`.
- Constrained the hero content and its three action columns.
- Added a defensive Investor viewport overflow class.
- Updated the PWA cache version so installed apps receive the corrected layout.

## UAT
Test widths 320px, 360px, 390px, 412px and 430px. Confirm:
1. No page-level horizontal scrolling.
2. Hero text wraps normally.
3. Report, Goals and Review buttons are all visible.
4. Quick Access alone scrolls horizontally.
5. KPI cards remain fully inside the viewport.
6. Bottom navigation stays aligned.
