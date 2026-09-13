# GrowVest v0.34.15 - Signature Render, Cover Quality & Report Recovery Hotfix

## Why this release exists

The approved GrowVest Signature visual reference existed in the source, but report rendering still depended on the report's selected/frozen template metadata. An older draft using Premium Blue, Executive Minimal, Detailed Portfolio or a custom template could therefore continue to render the legacy layout after the visual direction had been locked.

## Fix

- Every **new or unpublished** Opening/Monthly Wealth Review is forced onto the GrowVest Signature visual renderer.
- Existing unpublished drafts are migrated in the Report Form to `growvest-signature`.
- Browser Preview and secure server PDF use the same visual-lock decision.
- Signature pages force Signature header/footer chrome even when stale template metadata is present on the report.
- Signature output uses the packaged GrowVest logo and lifestyle cover asset, preventing stale remote branding URLs from reverting the approved design.
- Official palette is hard-locked in the Signature renderer: `#1F4ED8`, `#0CC0DF`, `#0B0B0F`, `#E53935`, `#F5B301`, `#F4F6F9`, `#6B7280`, `#FFFFFF`.
- Template selection for an unpublished launch report exposes only **GrowVest Signature** and explains that the visual is locked.
- Historical already-published reports preserve their frozen historical template unless they were already created with GrowVest Signature.

## Additional launch fixes

### Cover image quality

The browser cover was previously stretching the portrait lifestyle source across the full A4 page. That forced an unnecessary zoom/crop and made the person and mountain artwork look soft. The Signature cover now keeps the photograph proportional on the right 78% of the page, uses a higher-quality packaged 1200 x 2400 source, and lets the white readability wash sit over the image rather than stretching it. The secure PDF uses the same proportional right-side treatment.

### Wealth Review not found recovery

A draft can be moved to a canonical report ID while an older edit URL remains in browser history. `getMonthlyReport(...)` now resolves `migratedFromReportId` and canonical Opening/Monthly route hints. `ReportForm` adopts the recovered report ID and corrects the edit URL immediately. Truly deleted reports still show a clear recovery message instead of silently recreating a duplicate.

## Result

The locked visual reference is no longer merely an available template. It is the mandatory rendering path for investor-launch reports.
