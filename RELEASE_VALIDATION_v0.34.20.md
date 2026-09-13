# GrowVest v0.34.20 - Release Validation

## Release

**Secure PDF Rupee Glyph Orientation Hotfix**

## Reported defect reproduced

The downloaded Opening Wealth Review submitted for Nikhil Dalvi renders the custom Indian Rupee glyph vertically mirrored and below the amount baseline on multiple pages, including Wealth at a Glance, Asset Allocation, Bucket List, Investment Portfolio and Performance.

## Root cause

The secure `pdf-lib` renderer used a custom vector outline copied from a font-coordinate system (Y-up). `drawSvgPath()` consumes SVG-oriented path coordinates, producing a vertical mirror. The path was also anchored at the text baseline as though the path origin were its baseline, causing the symbol to drop below the numeric text.

## Fix

- Vertically transformed the Rupee outline into normal SVG coordinates.
- Re-anchored the glyph to `y + 0.8em` so it aligns beside the amount.
- Kept the vector solution, avoiding WinAnsi / StandardFonts Unicode limitations.
- No financial calculations, report data, responsive viewing or locked report layout were changed.
- Secure renderer version: **2.4.7**.
- App/package version: **0.34.20**.
- PWA caches: **v0.34.20-rupee-glyph1**.

## Validation

- Release audit: **470 passed, 0 warnings, 0 failures**.
- `node --check src/lib/server/reportPdf.js`: PASS.
- `node --check src/lib/server/reportServer.js`: PASS.
- Independent SVG render confirms the previous outline is vertically mirrored and the replacement outline is upright.

## Deployment QA

After deployment, regenerate one secure Opening Wealth Review PDF and verify the Rupee symbol on the cover, KPI cards, asset allocation center value, goal values, investment table and performance figures. The browser preview should remain unchanged.
