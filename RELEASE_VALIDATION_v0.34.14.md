# GrowVest v0.34.14 Release Validation

Release: **v0.34.14 - GrowVest Signature Locked Visual Investor Report**  
Validation date: **11 September 2026**

## Release outcome

The v0.34.14 source is ready for deployment QA. The approved GrowVest Signature nine-page report direction is frozen as the visual reference and is implemented in both the browser/A4 renderer and the secure server PDF renderer. The first-report Opening Wealth Review protection from v0.34.13 remains in place.

## Automated validation

- Release audit: **410 passed, 0 warnings, 0 failures**.
- Opening Wealth Review reconciliation fixture: **passed**.
- Changed JS/JSX/MJS parse check: **15 passed, 0 failed**.
- Static A4 design sample: **9 pages rendered and visually inspected at 150 DPI**.
- PDF visual regression comparison completed against the earlier v0.34.14 sample. All nine pages changed as expected because the locked visual reference was intentionally applied.

### Reconciliation fixture

The launch fixture validates the reported investor case:

- Goal: General Wealth / Corpus Creation
- Current corpus: Rs 24,298
- Target: Rs 10,00,000
- Progress: 2.4%
- Active monthly SIP: Rs 3,000
- Status: SIP Running
- Invalid goal allocations: 0

## Locked visual implementation

The approved visual reference is frozen in the release at:

`docs/reference/growvest_signature_locked_reference_v0.34.14.png`

Key design rules:

- GrowVest Royal Trust Blue `#1F4ED8`, Electric Sky-Blue `#0CC0DF`, Deep Premium Black `#0B0B0F`; Strategic Red and Insight Yellow are reserved for meaningful status/attention accents.
- Lifestyle Opening Wealth Review cover with a packaged local fallback asset.
- Large financial hierarchy and 2 x 2 Wealth at a Glance KPI composition.
- Large print-safe Asset Allocation donut and compact current-vs-target table.
- Dedicated Bucket List & Wealth Goals hero card with corpus, target, progress and Active SIP.
- Investment Portfolio table retains goal/corpus allocation context.
- Opening Review Performance page uses Starting Position instead of fabricated monthly comparison.
- Protection Overview uses the concise four-column layout.
- GrowVest View uses the approved three-part hierarchy.
- Your Next Steps is limited to three primary actions and includes the GrowVest closing treatment.
- Investor-facing terminology uses GrowVest / Conscious Wealth Partner language rather than Advisor positioning.

## First-report workflow protection

For an investor with no prior published investor-facing report, Create Report resolves report history first and automatically selects **Opening Wealth Review**. Save/autosave is blocked until this check has finished. The server-side Opening-first guard remains as a second safety layer.

After a published Opening Wealth Review exists, subsequent valid reporting periods use **Monthly Wealth Review**.

## Renderer parity

- Browser/A4 renderer: `src/components/reports/GrowVestSignatureReportDocument.js`
- Browser print router: `src/components/reports/MonthlyReportPrintDocument.js`
- Secure server PDF renderer: `src/lib/server/reportPdf.js`
- Shared secure PDF shell: `src/lib/server/pdfDocumentShell.js`
- Secure renderer version: **2.4.1**
- Investor PWA cache family: **v0.34.14-signature-report2**

The packaged cover fallback is:

`public/brand/growvest-wealth-review-cover.jpg`

Both report renderers reference the packaged fallback when a custom approved cover image is not stored in the frozen report branding/template snapshot.

## PDF visual QA

The final static reference sample was rendered through the PDF QA workflow and inspected. No clipped text, overlapping sections, broken currency glyphs, or missing pages were observed in the nine-page sample.

A compatibility fallback was added to the final closing banner so PDF engines that do not support the blue-to-cyan CSS gradient still render a Royal Trust Blue banner with readable white content.

Reference QA artifacts generated outside the source package:

- `GrowVest_v0.34.14_Locked_Visual_Reference_SAMPLE.pdf`
- `GrowVest_v0.34.14_Locked_Visual_Reference_Design_Preview.png`
- `gv03414_locked_diff/summary.json`

## Deployment QA still required

This environment intentionally does not contain project `node_modules`, so a full Next.js production build and a live Firebase-backed secure report route were not executed here. After source checkout/deployment, run:

```bash
npm ci
npm run lint
npm run build
```

Then create **one real investor Opening Wealth Review** and compare these four surfaces before mass publishing:

1. Create Report screen values
2. Browser/A4 Preview PDF
3. Downloaded secure PDF
4. Investor App published report

Portfolio Value, Total Invested, Gain/Loss, Active SIP, Goal/Corpus progress, holdings and report period must reconcile across all four surfaces.
