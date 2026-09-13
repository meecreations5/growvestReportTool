# GrowVest v0.34.14 - Locked Visual Reference

## Status

The GrowVest Signature Wealth Review visual direction is **locked** for the investor-app launch. The implementation must reproduce the approved reference page-by-page as closely as the browser/A4 and native secure-PDF renderers allow. Business data remains dynamic; the presentation system is not to be reinterpreted without an explicit redesign decision.

Reference image:

`docs/reference/growvest_signature_locked_reference_v0.34.14.png`

## Official color system

- Royal Trust Blue: `#1F4ED8`
- Electric Sky-Blue: `#0CC0DF`
- Deep Premium Black: `#0B0B0F`
- Strategic Red: `#E53935` only for negative / attention states
- Insight Yellow: `#F5B301` only for due / review states
- Soft Gray: `#F4F6F9`
- Medium Gray: `#6B7280`
- White: `#FFFFFF`

Positive portfolio emphasis uses GrowVest blue/cyan instead of an unrelated green accent.

## Locked page composition

1. **Cover** - lifestyle landscape on the right with a light readable left field; large Opening/Monthly Wealth Review title, investor name, wealth card and statement date.
2. **Wealth at a Glance** - 2x2 KPI cards and one large contextual starting-point/month-in-context panel.
3. **Asset Allocation** - large donut, simple legend, then current-vs-target table.
4. **Bucket List & Wealth Goals** - dominant goal card, progress bar, four goal metrics, investments contributing to the goal and one concise status callout.
5. **Investment Portfolio** - readable statement-style table with Goal / Corpus allocation carried directly under each holding and a restrained GrowVest closing line.
6. **Performance** - dominant starting-position/monthly-movement panel; Opening Reviews do not manufacture month-on-month performance.
7. **Protection Overview** - concise protection table and a separate protection/wealth callout.
8. **GrowVest View** - three large visual insight rows: What We Observe, What Matters Now, What We Recommend Next.
9. **Your Next Steps** - three primary numbered actions, optional next-review cue, strong blue/cyan closing banner and compact legal note.

## Typography and spacing lock

- Use the report display heading scale from the reference; do not shrink section headings into dashboard labels.
- Keep generous white space, but content should occupy the page confidently rather than floating in the upper third.
- KPI values, goal corpus and portfolio values remain the strongest typographic hierarchy after the page title.
- Tables must remain readable in print; do not compress rows merely to keep a page count low.
- Rounded cards are restrained, not app-like. Avoid excessive borders, shadows or dashboard chrome.

## Cover asset

`public/brand/growvest-wealth-review-cover.jpg` is the packaged Signature cover fallback used when a custom approved report background is not supplied. Both renderers use the same fallback so preview and secure PDF do not drift.

## Renderer parity requirement

The locked design applies to both:

- Browser/A4: `src/components/reports/GrowVestSignatureReportDocument.js` + Signature CSS
- Secure native PDF: `src/lib/server/reportPdf.js` + `src/lib/server/pdfDocumentShell.js`

A change to one Signature renderer must be reflected in the other before release.
