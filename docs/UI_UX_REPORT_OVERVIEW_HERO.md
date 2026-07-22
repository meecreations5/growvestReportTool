# UI/UX Update — Monthly Report Overview Hero

## Scope

This update improves the investor-facing report overview at the top of the Monthly Wealth Progress Report.

## Updated files

- `src/components/reports/MonthlyWealthReport.js`
- `src/components/reports/MonthlyReportPrintDocument.js`
- `src/lib/utils/reportPresentation.js`

## Improvements

- Forces the investor report title to remain readable on the dark cover.
- Uses the white/inverse GrowVest logo on dark surfaces.
- Falls back to the primary logo inside a white container when an inverse logo is not configured.
- Reduces the visual dominance of the Advisor card.
- Uses a clearer report-to-Advisor desktop ratio.
- Replaces heavy information blocks with compact bordered metadata cards.
- Replaces the unclear `GrowVest client` fallback with an investor-friendly relationship label.
- Prevents internal titles such as `Super Admin` or `Admin` from appearing in investor-facing web and PDF reports.
- Uses the configured legal company name in the Advisor identity.
- Improves mobile stacking and touch targets for Email, Call and Schedule.
- Keeps web report and printable report Advisor identity consistent.

## Investor-facing role mapping

These internal titles are displayed as `Relationship Advisor` in reports:

- Super Admin
- Super Administrator
- Administrator
- Admin
- System Admin
- System Administrator

Other configured professional designations remain unchanged.

## Logo behaviour

1. `whiteLogoUrl` is used when available.
2. If it is missing, `primaryLogoUrl` is placed on a white container for contrast.
3. If neither image is configured, the standard BrandLogo fallback is used.

## Test routes

- `/reports/[reportId]`
- Investor Portal report route using `MonthlyWealthReport`
- Print/PDF preview using `MonthlyReportPrintDocument`

## Responsive widths

- 390 px
- 768 px
- 1280 px
- 1440 px

## Validation

The modified JavaScript and JSX files passed TypeScript parser validation with JSX enabled. No dependencies, Firebase indexes, Firestore rules or environment variables were added.
