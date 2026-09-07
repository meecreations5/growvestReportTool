# v0.33.5 Investor Mobile Scroll Recovery - Code Manifest

## Updated files

- `src/app/globals.css`
  - Replaces phone `overflow-x: hidden` with `overflow-x: clip`.
  - Leaves Investor wrapper/main vertical overflow visible.

- `src/components/documents/DocumentPreviewModal.js`
  - Stable close callback handling.
  - No body scroll lock on phones below 768px.
  - Existing tablet/desktop background lock retained.

- `src/components/investor/InvestorShell.js`
  - Clears stale mobile body overflow locks on app mount/route change.

- `public/sw.js`
  - Cache bump to `v0.33.5-ui3`.

- `scripts/qa/release-audit.mjs`
  - Adds regression assertions for mobile vertical-scroll safety and preview lock recovery.

- `README.md`
  - Adds hotfix release note.
