# v0.34.16 - PDF Encoding & Opening Verification Stability

## Purpose

This release closes two launch-stability gaps found while testing the first GrowVest investor Opening Wealth Reviews:

1. Native secure PDF generation could fail when a newline/control character reached a `pdf-lib` StandardFont `drawText()` call (`WinAnsi cannot encode "\\n" (0x000a)`).
2. Opening Portfolio Verification could describe the investor's entire starting portfolio as monthly "new holdings" and could show only a generic reconciliation count instead of the actual issues and their severity.

The locked GrowVest Signature visual reference remains unchanged.

## PDF text safety

`src/lib/server/pdfTextSanitizer.js` is the single-purpose text boundary for native StandardFont PDF output.

- `pdfSafeLine(value)` is for direct `page.drawText()` content. It normalises the rupee symbol and common punctuation, transliterates decomposable Latin accents, replaces unsupported Unicode, removes C0/C1 control characters, collapses whitespace and guarantees no newline/tab reaches a direct StandardFont draw call.
- `pdfSafeMultiline(value)` is for narrative content that intentionally contains paragraph breaks. It preserves newline boundaries only long enough for the report/MOM wrapping functions to split the content. Each resulting rendered line is already `pdfSafeLine()` safe.
- `pdfSafeText(value)` remains the backwards-compatible shared helper but is now intentionally single-line safe.

This protects both the Wealth Review renderer and MOM renderer because both use the shared shell/sanitizer.

## Opening Portfolio Verification

For `reportType === "opening"`:

- Holdings from the verified closing snapshot establish the Opening GrowVest baseline.
- The verification row is named **Opening portfolio holdings**.
- It passes when the baseline holdings are available; they are not described as monthly additions.
- New holdings and Exited holdings summary cards display **N/A**.
- No prior-period market movement is inferred.
- Opening-period transactions remain visible as activity but are not treated as evidence of a previous-period return.

For subsequent Monthly Wealth Reviews, normal New/Exited comparison resumes when an opening/previous snapshot exists.

## Reconciliation severity

When Portfolio Intelligence provides detailed `issues[]`, those issue severities are authoritative:

- `block`, `error`, `critical`, `fatal` -> **Must fix / Blocked**
- `warn`, `warning`, `review`, `needs_review` -> **Review required**
- `info` -> informational only and does not block

The older aggregate status (`mismatch`, `stale`, `missing_source`, etc.) is used only as a fallback when detailed issue rows are not available. This prevents a stale aggregate flag from hiding the real reason or incorrectly hard-blocking a report whose current detailed issues are warning/info only.

The Report Form displays each actionable issue with its title, description and **Must fix** / **Review** classification directly under Portfolio reconciliation.

## What still blocks publication

This release does not weaken financial-integrity controls. Examples that remain blocking include:

- duplicate active holdings that can inflate totals;
- valuation mismatches against units/quantity x NAV/rate;
- critical stale data where Portfolio Intelligence marks the issue as blocking;
- invalid goal allocation above 100%;
- missing/invalid verified portfolio snapshot;
- any other reconciliation issue explicitly classified as blocking.

Review-only source-date/freshness warnings can be acknowledged by responsible GrowVest staff without changing Portfolio Master data.

## Visual design

No redesign is introduced in v0.34.16. The v0.34.14 locked GrowVest Signature reference remains the mandatory visual direction for new/unpublished investor reports. v0.34.15 cover-quality and stale report-ID recovery fixes are preserved.

## Release metadata

- App version: `0.34.16`
- Secure PDF renderer: `2.4.4`
- PWA asset cache: `growvest-investor-v0.34.16-pdf-stability1`
- PWA page cache: `growvest-pages-v0.34.16-pdf-stability1`
