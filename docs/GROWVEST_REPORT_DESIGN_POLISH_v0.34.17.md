# GrowVest v0.34.17 - Investor Wealth Review Design Polish

## Purpose

v0.34.17 applies the approved, locked GrowVest Signature visual direction to the real investor Wealth Review and closes the visual gaps found in the first Nikhil Dalvi Opening Wealth Review generated from production-like data.

The visual direction remains locked. This release improves implementation fidelity; it does not introduce a new design concept.

## Locked visual system

- Royal Trust Blue `#1F4ED8`
- Electric Sky-Blue `#0CC0DF`
- Deep Premium Black `#0B0B0F`
- Strategic Red `#E53935` only for genuine negative/attention states
- Insight Yellow `#F5B301` only for relevant warning/status states
- Soft Gray `#F4F6F9`, Medium Gray `#6B7280`, White `#FFFFFF`

## Design and data-presentation corrections

### Cover
- Replaces the earlier stretched/soft cover treatment with an 1800 x 3600 portrait source.
- Keeps the photograph proportional on the right side of the A4 cover.
- Uses a single smooth packaged wash instead of multiple translucent vertical bands.
- Retains the full closing line: `A more confident tomorrow, together.`

### Currency
- Browser preview continues to use the Indian Rupee symbol.
- Secure `pdf-lib` Signature pages now draw a vector Rupee glyph and numeric value separately, avoiding StandardFonts/WinAnsi limitations without downgrading the investor-facing report to `Rs.`.

### Wealth at a Glance
- Larger KPI cards, values and opening-context panel improve A4 hierarchy and reduce unused space.

### Asset Allocation
- Enlarged donut and legend.
- If no target allocation is configured, Target Allocation displays `Not set` and Variance displays `-` rather than implying a 0% agreed target.

### Bucket List & Wealth Goals
- Larger goal hero, progress treatment and linked-investment table.
- Financial amounts use the secure Rupee vector renderer.
- Goal names remain sourced from the Goal Master; the renderer does not silently rename investor goals.

### Investment Portfolio
- Holdings are balanced across pages with a six-holding target rather than creating a dense first page and sparse continuation page.
- `Allocated to:` is rendered as secondary text under the investment name.
- Investment values and totals use the secure Rupee vector renderer.

### Performance
- Opening Wealth Review clearly shows `Baseline as of <statement date>`.
- Opening position amounts use the secure Rupee vector renderer.

### Protection
- A dedicated Protection page is produced only when policy data exists.
- When no protection data exists, the final Next Steps page carries a compact `Protection details not yet added` note instead of consuming an almost-empty A4 page.

### GrowVest View
- Generic commentary is sanitised to GrowVest language (`consistent contributions`, not `disciplined contributions`).
- Advisor/partner commentary is not duplicated when it is the same as the main observation.
- When there is no unique partner note, a compact Connect GrowVest strip is shown instead.

### Your Next Steps
- One-action reports use a larger, better-balanced action treatment.
- Closing GrowVest banner remains prominent without inventing additional actions.

## Renderer parity

The same decisions are implemented in:

- browser/A4 preview: `GrowVestSignatureReportDocument.js` + `globals.css`
- secure downloadable PDF: `reportPdf.js`

Published historical report snapshots continue to preserve their frozen report/template facts; the locked Signature path remains mandatory for new/unpublished launch reports.

## Validation expectation

Before full investor rollout:

1. Generate one real Opening Wealth Review.
2. Compare browser preview and secure downloaded PDF.
3. Confirm Rupee symbols, cover quality, target-allocation `Not set` treatment, balanced holding pages, no empty Protection page, no duplicated GrowVest View copy, and no clipping/overlap.
