# v0.34.24 Report Renderer Root Reconciliation

This release fixes the recurring visual drift in the GrowVest Signature Wealth Review at the renderer level rather than applying another page-specific offset patch.

## Root cause confirmed

The uploaded v0.34.23 PDF was generated after deployment and contains the current 1800x3600 packaged cover image, so the persistent result was not an old browser/PWA cache. The secure PDF renderer itself used different hard-coded coordinates for the Starting Point callout, Performance information strip, Protection strip, and closing banner. The source cover photograph also remained intrinsically soft even though it was embedded at full resolution.

## Secure PDF changes

- Introduces one `drawSignatureCallout()` geometry for compact investor-facing callouts.
- Starting Point, Performance note, no-policy Protection note, and the Protection page callout now share the same vertical-centre and text-inset rules.
- Introduces `drawSignatureClosingBanner()` for a fixed icon/text centre line.
- Uses packaged official GrowVest icon PNGs instead of the hand-drawn leaf path for Starting Point and the closing banner.
- Uses a new versioned cover asset path: `/brand/growvest-wealth-review-cover-v03424.jpg`.
- The new cover file uses the strongest clean detail-recovery candidate that avoids the obvious geometry distortion seen in prior attempts. The renderer continues to use proportional cover/crop math and does not stretch the photograph.
- PDF metadata now exposes `GrowVest Investor Wealth Report Generator 2.4.10` plus keyword `pdf-renderer-2.4.10`, so future uploaded PDFs can be verified unambiguously.

## Browser exact-design changes

- Starting Point now uses the official GrowVest icon asset.
- Starting Point, performance information, protection inline and closing banner spacing are tightened to the same compact grid used by the secure PDF.
- Cover uses the same versioned v0.34.24 asset.

## What is not changed

Portfolio values, goals, allocation, holdings, SIP, report snapshot logic, publication logic and Investor App Guide behavior are unchanged.
