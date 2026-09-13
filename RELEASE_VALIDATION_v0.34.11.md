# GrowVest v0.34.11 - Release Validation

## Release scope

Monthly Report module review plus premium A4/PDF presentation and browser/secure-renderer parity improvements.

## Automated release audit

Run:

```bash
npm run qa
```

Validated in this package: **379 passed, 0 warnings, 0 failures**.

## Source syntax validation

Server JavaScript is checked with Node syntax validation. Changed JSX files are parsed with the locally available TypeScript JSX parser to catch structural JSX syntax errors without requiring a full Next.js dependency install.

## A4 visual QA

A representative seven-page report was rendered as A4 PDF using the implemented browser-side visual system and rendered back to page images for inspection.

Checked:

- no clipped text
- no page overlap
- cover content remains within safe bounds
- KPI/stat grids remain aligned
- trend chart stays within its panel
- tables remain legible
- goal cards remain separated
- action/commentary panels remain within page bounds
- footer remains clear of body content

## Deployment QA required

Because npm package installation timed out in this environment, run the following in the normal project environment before production release:

```bash
npm install
npm run lint
npm run build
```

Then generate at least one real secure PDF from the Report review page and compare it with **Preview PDF**.

## Functional regression checklist

- [ ] Create a Monthly Report
- [ ] Save and Preview
- [ ] Complete Report
- [ ] Generate secure PDF
- [ ] Regenerate after a report/template edit
- [ ] Verify stale PDF behavior
- [ ] Publish report
- [ ] Verify immutable published version
- [ ] Open published report as Investor
- [ ] Download/open secure PDF as Investor
- [ ] Verify report history / previous versions
- [ ] Verify no-goal Investor shows General Wealth Corpus
- [ ] Verify large holdings/transactions paginate correctly
- [ ] Verify each production report template renders its intended cover pattern/style

## Guided Tour

The app-wide Product Tour / Guided Experience is intentionally deferred until this Report PDF work is accepted.
