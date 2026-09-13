# GrowVest v0.34.21 - Locked Wealth Review Design Verification

## Verification scope
The GrowVest Signature Wealth Review remains the locked launch design for new and unpublished reviews. Both the browser exact-design viewer and the secure downloadable PDF continue to select the signature renderer.

## Confirmed design locks
- Default template: `growvest-signature`.
- Locked visual version: `growvest-signature-2026-09`.
- Brand palette remains Royal Trust Blue `#1F4ED8`, Electric Sky-Blue `#0CC0DF`, Deep Premium Black `#0B0B0F`, Strategic Red `#E53935`, Insight Yellow `#F5B301`, Soft Gray `#F4F6F9` and Medium Gray `#6B7280`.
- Browser preview uses the packaged GrowVest logo, cover artwork and cover wash rather than mutable remote branding URLs.
- Secure PDF uses the same packaged logo, cover artwork and cover wash for the signature design.
- The cover photograph is rendered proportionally with cover/crop behavior in both renderers; there is no width/height stretch path in the locked signature cover.
- Browser report pages remain fixed A4 pages and the mobile viewer scales the same A4 composition rather than reflowing it.
- KPI icon roles, numeric right alignment, tabular browser numerals, goal presentation, allocation table and holdings layout remain locked from v0.34.18-v0.34.20.
- Secure PDF retains renderer `2.4.7` and the upright vector Indian Rupee glyph from v0.34.20.

## Cover-image quality finding
The packaged `public/brand/growvest-wealth-review-cover.jpg` is `1800 x 3600` at `240 DPI` and is not being geometrically distorted by the current code. However, visual inspection of the source file shows that the photograph itself is soft/blurred, especially around the person and mountain detail. The renderer cannot restore detail that is absent from the source image.

For a genuinely sharper final cover, replace this asset with a sharper original of the same composition (preferably the original export/source image, not a re-saved screenshot). The current proportional rendering should then use it without a layout change.

## Typography parity note
The browser exact-design renderer uses the GrowVest web font stack, while the secure `pdf-lib` file uses PDF-safe standard fonts plus native vector icons/rupee rendering. Layout, hierarchy, spacing intent and brand treatment are aligned, but font outlines are not byte/pixel-identical between the two rendering engines. This is an existing renderer constraint, not introduced by v0.34.21.

## Validation fixtures
- Opening Wealth Review goal reconciliation fixture.
- Opening Portfolio Verification stability fixture.
- PDF WinAnsi sanitization fixture.
- Release-audit assertions for the locked signature render path and app guide integration.
