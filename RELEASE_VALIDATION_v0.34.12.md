# GrowVest v0.34.12 Release Validation

## Release

**v0.34.12 - Asset Allocation Chart PDF Hotfix**

## Scope

This release fixes the missing Asset Allocation circular chart in Monthly Report print/PDF output and keeps Preview and secure PDF rendering aligned.

## Validation completed

- `ReportDonutChart.js` no longer uses CSS `conic-gradient` for the allocation ring.
- Browser/A4 report uses inline SVG allocation segments.
- Portfolio Allocation page explicitly renders Asset Allocation plus Current vs Target.
- Secure PDF renderer includes native vector allocation chart logic.
- Secure PDF renderer version is `2.2.1`.
- Package and package-lock versions are `0.34.12`.
- Installed PWA caches use `v0.34.12-report-asset1`.
- JavaScript source syntax checks completed for modified renderer files.
- Project release audit completed successfully.

## Release audit result

**384 passed, 0 warnings, 0 failures**

## Visual PDF QA

A representative 7-page Monthly Wealth Review sample was generated and rendered to PNG for inspection.

The corrected Portfolio Performance / Asset Allocation page confirms:

- the multi-colour allocation ring is visible;
- the ring matches the legend colours;
- the total portfolio value is legible in the centre;
- the allocation table remains visible and aligned;
- no clipping or overlap is present on the corrected page.

The before/after sample PDFs were also processed through the PDF render comparison workflow.

## Remaining deployment UAT

The local environment does not contain the project's installed `pdf-lib` npm dependency tree, so the full live Next.js secure-PDF route could not be executed end-to-end here. After deployment, generate one real report and verify **Preview PDF vs Downloaded Secure PDF** before publishing to an Investor.
