# GrowVest v0.34.15 - Release Validation

## Release

**GrowVest Signature Render Lock, Cover Quality & Report Recovery Hotfix**

This release addresses the production issue where the approved GrowVest Signature report design was present in the source code, but a live report could still render an older report layout when the saved report carried a legacy `templateId` / `templateSnapshot`.

## Root cause confirmed

The v0.34.14 browser print path selected `GrowVestSignatureReportDocument` only when the resolved saved template contained `appearance.designVariant === "growvest-signature"`. Older drafts could still contain `premium-blue`, `executive-minimal`, `detailed-portfolio` or custom template metadata, so the old renderer remained active even though GrowVest Signature had become the default template.

The same template dependency existed in the secure server PDF dispatch.

## Hotfix behavior

- New reports receive `visualDesignVersion: growvest-signature-2026-09`.
- Every new or unpublished report is rendered with the locked GrowVest Signature design.
- Existing unpublished drafts are migrated to `growvest-signature` when loaded into Report Form.
- The report Template step exposes only GrowVest Signature for unpublished launch reports.
- Browser A4 Preview and secure server PDF use the same `shouldUseGrowVestSignatureDesign(...)` decision.
- Signature pages force Signature document chrome even when stale draft metadata exists.
- Browser Signature output locks the approved palette and packaged GrowVest logo/cover artwork.
- Secure PDF output uses the same packaged artwork for renderer parity.
- Historical already-published reports preserve their frozen historical design unless they were originally Signature reports.

## Locked visual palette

- Royal Trust Blue: `#1F4ED8`
- Electric Sky-Blue: `#0CC0DF`
- Deep Premium Black: `#0B0B0F`
- Strategic Red: `#E53935`
- Insight Yellow: `#F5B301`
- Soft Gray: `#F4F6F9`
- Medium Gray: `#6B7280`
- White: `#FFFFFF`

## Additional defects closed

### Distorted / blurred Opening cover

- Root cause: the browser A4 renderer stretched a tall `900 x 1800` lifestyle source across the entire A4 page. The aspect mismatch caused extra zoom/cropping and visible softness.
- Fix: packaged cover artwork is now `1200 x 2400`, displayed proportionally on the right `78%` of the cover with the white readability wash layered above it.
- Secure PDF uses the matching proportional right-side cover treatment instead of a stretched image.
- Installed-PWA cache was advanced to `v0.34.15-signature-lock2` so the corrected artwork is not hidden behind the previous cached asset.

### `Wealth Review was not found` on edit

- Root cause: an unpublished report can have its Firestore document ID migrated to a canonical period ID while browser history or an older link still points at the previous ID.
- Fix: report loading now resolves `migratedFromReportId`, plus canonical Opening/Monthly route hints for legacy drafts.
- `ReportForm` switches `workingReportId` to the recovered ID and replaces the stale URL before any further save.
- A genuinely deleted report still returns a clear not-found/reopen message; the UI does not silently create a duplicate.

## Automated validation

- Release audit: **424 passed, 0 warnings, 0 failures**.
- Opening Wealth Review goal reconciliation fixture: **passed**.
- Exact launch fixture: current corpus `24298`, target `1000000`, progress `2.4%`, Active SIP `3000`, status `SIP Running`, invalid goal allocations `0`.
- Changed JS/JSX parse validation through the TypeScript parser: **10/10 passed**.
- Secure PDF renderer version: **2.4.3**.
- PWA cache version: **v0.34.15-signature-lock2**.

## Visual verification

The locked nine-page reference PDF was re-rendered at 150 DPI using the PDF QA renderer. Cover, Bucket List & Wealth Goals, and Your Next Steps pages were inspected with no clipping, overlap or broken glyph issues observed. The visual specification itself is unchanged from the user-approved locked v0.34.14 reference; v0.34.15 fixes the live routing/migration so that this design is actually selected in code.

## Deployment verification

After deployment:

1. Open an existing **unpublished** report created before v0.34.15 and confirm its Template step shows GrowVest Signature as the locked launch design.
2. Open **Preview PDF** directly and confirm the lifestyle cover and blue/cyan Signature pages appear without first re-saving the report.
3. Save the draft, complete it, and generate the secure PDF.
4. Compare browser Preview and secure downloaded PDF before publishing the first investor report.
5. Historical already-published reports may retain their older frozen visual by design.
