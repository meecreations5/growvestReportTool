# GrowVest v0.34.10 - Monthly Report PDF Review & How-To-Use Code Manifest

## Scope

Adds an in-app **How to use** guide to the Monthly Report Create / Edit workspace, documents the current PDF design architecture, and fixes one secure-PDF parity issue for investors who do not yet have Bucket List goals.

## Updated files

```text
package.json
package-lock.json
public/sw.js
README.md
scripts/qa/release-audit.mjs
src/components/reports/create/ReportWorkflowShell.js
src/lib/server/reportPdf.js
src/lib/server/reportServer.js
```

## New documentation

```text
docs/MONTHLY_REPORT_HOW_TO_USE_v0.34.10.md
docs/REPORT_PDF_DESIGN_REVIEW_v0.34.10.md
docs/MONTHLY_REPORT_HOW_TO_USE_CODE_MANIFEST_v0.34.10.md
RELEASE_VALIDATION_v0.34.10.md
```

## UI behaviour

A **How to use** button now appears in the Monthly Report workspace header.

It opens a responsive modal / mobile bottom-sheet containing:

- the correct 10-step Monthly Report workflow
- the recommended Create / Edit -> Save & Preview -> Complete -> Generate / Regenerate PDF -> Verify -> Publish -> Send sequence
- stale-PDF regeneration guidance
- published-version immutability guidance
- pre-completion validation reminders

## PDF correction

The secure PDF renderer now mirrors the browser preview when a report has no Bucket List goals:

- cover summary shows **General Wealth Corpus** rather than **Overall Goal Progress**
- executive summary shows corpus instead of a meaningless goal-progress percentage
- the goal progress bar is omitted when no goals exist

`pdfRendererVersion` is now `2.1.1` so newly generated artifacts record the corrected renderer.

## Preserved behaviour

No changes were made to:

- Portfolio Master calculations
- report schemas
- report completion validation
- PDF storage paths
- publication logic
- report version history
- Investor access rules
- email delivery

## Testing

1. Open `/reports/create`.
2. Confirm **How to use** is visible in the header on desktop and mobile widths.
3. Open the guide and verify all 10 steps are visible.
4. Close using the X button, backdrop and **Got it** button.
5. Open an existing `/reports/[reportId]/edit` report and repeat.
6. Confirm Copy Previous remains available for new reports on desktop.
7. Confirm normal report editing and autosave continue unchanged.
8. Generate a report with goals and confirm the secure PDF still shows overall goal progress.
9. Generate a report with no goals and confirm both Preview and Downloaded PDF show **General Wealth Corpus**.
10. Complete -> generate PDF -> verify -> publish, then confirm the published version remains immutable.
