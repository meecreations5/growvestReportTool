# v0.34.20 Code Manifest - Rupee Glyph Orientation Hotfix

## Changed files

- `src/lib/server/reportPdf.js`
  - Replaced the vertically mirrored custom Rupee outline with its upright SVG-coordinate equivalent.
  - Re-anchored the glyph to the amount baseline (`y + 0.8em`) so it aligns with financial figures.
- `src/lib/server/reportServer.js`
  - Secure PDF renderer version `2.4.7`.
- `package.json`
- `package-lock.json`
  - Version `0.34.20`.
- `public/sw.js`
  - Installed PWA cache refresh `v0.34.20-rupee-glyph1`.
- `scripts/qa/release-audit.mjs`
  - Current release metadata checks and Rupee-path regression assertions.
- `docs/RUPEE_GLYPH_ORIENTATION_HOTFIX_v0.34.20.md`
- `docs/RUPEE_GLYPH_ORIENTATION_HOTFIX_CODE_MANIFEST_v0.34.20.md`
- `README.md`
