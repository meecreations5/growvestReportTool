# GrowVest v0.34.16 - Release Validation

## Release

**PDF Encoding & Opening Verification Stability**

This release closes the remaining first-report stability issues found during Investor App launch testing while preserving the locked GrowVest Signature report design from v0.34.14/v0.34.15.

## Issues addressed

### 1. `WinAnsi cannot encode "\\n" (0x000a)` during secure PDF generation

**Root cause:** text passed to `pdf-lib` StandardFonts could still contain newline, tab or other control characters when sent directly to `page.drawText()`.

**Fix:**
- Added `src/lib/server/pdfTextSanitizer.js`.
- `pdfSafeLine(...)` now produces single-line WinAnsi-safe text for direct drawing.
- C0 and C1 control characters are removed from direct text.
- Common Unicode punctuation and the rupee symbol are normalised before StandardFonts receive text.
- Unsupported Unicode is replaced safely rather than reaching WinAnsi encoding.
- `pdfSafeMultiline(...)` preserves intentional paragraph breaks only for wrapping functions that split and draw one safe line at a time.
- Wealth Review and MOM wrapping paths now use the multiline-safe boundary explicitly.

### 2. Opening holdings incorrectly shown as monthly new holdings

**Root cause:** the Opening Wealth Review used the same holding-difference presentation as a normal Monthly Wealth Review, so a first verified portfolio could appear as many "new holdings".

**Fix:**
- Opening Review holdings establish the investor's starting GrowVest portfolio baseline.
- New/exited comparison is not applied to the Opening Wealth Review.
- Report verification uses the label **Opening portfolio holdings**.
- New Holdings and Exited Holdings cards display **N/A** for an Opening Wealth Review.
- Holding-movement comparison starts with the next Monthly Wealth Review after an opening baseline exists.

### 3. Portfolio reconciliation showed only a generic issue count

**Root cause:** Portfolio Intelligence already generated detailed issue rows, but Report Verification reduced them to an aggregate status/count.

**Fix:**
- Detailed reconciliation issues are normalised into `block`, `warn` and `info` severities.
- When detailed issues exist, their severity is authoritative for Report Verification.
- Blocking issues remain hard blockers.
- Warning issues require review/acknowledgement but are not incorrectly promoted to a hard block by a stale aggregate status.
- Informational issues do not block the report.
- The Report Form now displays the actual issue title and description with **Must fix** or **Review** treatment.
- Legacy snapshots without detailed issue rows continue to use the aggregate reconciliation status as a safe fallback.

## Opening Review verification behavior

For an Opening Wealth Review:

- verified report-date snapshot: validated normally;
- source freshness: validated normally;
- real duplicate/valuation/integrity errors: still block;
- source review warnings: remain review warnings;
- opening holdings: treated as the starting baseline;
- new holdings: N/A;
- exited holdings: N/A;
- prior-period performance: not inferred;
- opening-period transactions: retained as activity but not used to manufacture a prior-period return.

This does **not** bypass financial-integrity controls to make a report publishable.

## Automated validation

- Release audit: **435 passed, 0 warnings, 0 failures**.
- PDF WinAnsi encoding fixture: **passed**.
- Opening Portfolio Verification stability fixture: **passed**.
- Opening Wealth Review goal reconciliation fixture: **passed**.
- Exact goal fixture remains: current corpus `24298`, target `1000000`, progress `2.4%`, Active SIP `3000`, status `SIP Running`, invalid goal allocations `0`.
- `node --check` passed for all changed non-JSX JavaScript/MJS files in this patch.
- `ReportForm.js` JSX syntax parse through the installed TypeScript parser: **passed**.
- Secure PDF renderer version: **2.4.4**.
- Installed Investor PWA cache: **v0.34.16-pdf-stability1**.

## Visual-design regression boundary

The user-approved **GrowVest Signature locked visual direction is unchanged** in this release. v0.34.16 changes PDF text safety and verification behavior only; it does not reinterpret the cover, page composition, palette, typography direction, charts or investor-report information architecture.

## Environment limitation

The clean source tree intentionally does not include `node_modules`, and `pdf-lib` / the complete Next.js dependency tree is not installed in this execution environment. Therefore a full `npm run lint`, `npm run build`, and a live secure report route using the project's installed `pdf-lib` package were **not** executed here.

The pure PDF text-boundary fixture, Opening Verification fixture, release audit and syntax checks all pass, but deployment should still run the normal dependency-backed build and one real secure-PDF smoke test before publishing investor reports at scale.

## Deployment smoke test

1. Run `npm ci`.
2. Run `npm run lint` and `npm run build`.
3. Open a first-time investor and create an **Opening Wealth Review**.
4. Confirm Opening Portfolio Verification shows **Opening portfolio holdings** and New/Exited as **N/A**.
5. If Portfolio Intelligence has issues, confirm each issue is visible with **Must fix** or **Review** severity.
6. Confirm only genuine blocking issues prevent completion/publication.
7. Generate the secure PDF using text that includes multi-line commentary/notes and confirm no WinAnsi newline error occurs.
8. Compare browser Preview and secure downloaded PDF; the locked GrowVest Signature visual design must remain unchanged.
