# v0.34.16 Code Manifest

## Added

- `src/lib/server/pdfTextSanitizer.js`
  - WinAnsi-safe `pdfSafeLine()` and deliberate `pdfSafeMultiline()` boundaries.
- `src/lib/reportVerification.js`
  - detailed reconciliation severity resolution;
  - Opening-vs-Monthly holding-change resolution.
- `scripts/qa/report-pdf-encoding-fixture.mjs`
  - verifies newline/tab/control/Unicode sanitisation.
- `scripts/qa/report-opening-verification-fixture.mjs`
  - verifies Opening holdings are baseline-only and reconciliation severity is respected.
- `docs/PDF_ENCODING_OPENING_VERIFICATION_STABILITY_v0.34.16.md`
- `docs/PDF_ENCODING_OPENING_VERIFICATION_STABILITY_CODE_MANIFEST_v0.34.16.md`
- `RELEASE_VALIDATION_v0.34.16.md`

## Updated

- `src/lib/server/pdfDocumentShell.js`
  - direct PDF text now resolves through the single-line safe boundary;
  - exports both single-line and multiline helpers.
- `src/lib/server/reportPdf.js`
  - paragraph wrapping uses `pdfSafeMultiline()` before drawing individual lines.
- `src/lib/server/momPdf.js`
  - MOM paragraph wrapping uses the same multiline-safe path.
- `src/lib/constants/report.js`
  - Opening holdings are not classified as monthly new/exited holdings;
  - reconciliation uses detailed issue severity and passes issue rows to the UI;
  - Opening transaction wording no longer implies prior-period performance.
- `src/components/reports/ReportForm.js`
  - shows actual reconciliation issue details;
  - marks blocking issues as **Must fix** and warnings as **Review**;
  - shows New/Exited holdings as **N/A** for Opening Wealth Reviews;
  - clarifies the Opening baseline description in Step 3.
- `src/lib/server/reportServer.js`
  - secure PDF renderer version bumped to `2.4.4`.
- `public/sw.js`
  - installed-PWA cache refresh to `v0.34.16-pdf-stability1`.
- `package.json`, `package-lock.json`
  - release version `0.34.16` and QA fixture scripts.
- `scripts/qa/release-audit.mjs`
  - current-version/cache expectations and v0.34.16 stability assertions.
- `README.md`
  - v0.34.16 release notes.
