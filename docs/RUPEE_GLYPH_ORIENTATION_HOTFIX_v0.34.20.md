# GrowVest v0.34.20 - Secure PDF Rupee Glyph Orientation Hotfix

## Problem

Downloaded secure Wealth Review PDFs could show the Indian Rupee symbol vertically mirrored. The report values themselves were correct, but the custom vector glyph used by the `pdf-lib` renderer was sourced from a font-outline coordinate system where Y increases upward. `drawSvgPath()` interprets SVG path coordinates with the opposite vertical orientation, so the glyph rendered upside down / vertically mirrored while the browser preview remained correct.

## Correction

- Rebuilt the custom Rupee vector path into normal SVG coordinates by vertically reflecting the original outline around the glyph height.
- Re-anchored the vector to the financial-number text baseline so the upright symbol sits beside the amount instead of dropping below it.
- Kept the vector approach so the secure PDF remains independent of WinAnsi/StandardFont Unicode support.
- Preserved the existing money sizing, right alignment, tabular layout, compact `K/L/Cr` formatting and all report calculations.
- The browser/A4 preview continues to use the native `₹` symbol and requires no visual change.
- PDF renderer version advanced to `2.4.7`.
- Installed PWA caches advanced to `v0.34.20-rupee-glyph1`.

## Scope

Presentation-only secure-PDF fix. No portfolio, goal, SIP, report-period, reconciliation, publishing or investor-access business logic is changed.

## QA

The original and corrected vector outlines were rendered independently. The original path reproduces the vertically mirrored glyph visible in the submitted downloaded PDF; the corrected path renders an upright Indian Rupee symbol. Release-audit checks protect the corrected orientation from regression.
