# GrowVest Investor Profile UI/UX Redesign

## Route

`/investors/[investorId]`

## Purpose

The Investor Profile is now a financial relationship workspace rather than a generic contact profile. It brings together investor identity, latest monthly-report data, Bucket List goals, assessment context, meetings, documents and activity without changing the underlying Firebase data model.

## Main improvements

- Premium light profile header with clear GrowVest hierarchy
- Primary actions: Create Monthly Report, Meeting and Edit Profile
- Current portfolio value sourced from the latest monthly report, with assessment investments as fallback
- Monthly gain/loss, monthly return, YTD return, net contribution and reports-generated metrics
- Clear relationship status strip for advisor, portal, latest report and next review
- Responsive sticky profile tabs
- Stronger Overview hierarchy with financial journey, personal details and financial position
- Latest report, advisor, review and assessment cards in the right context rail
- Combined activity timeline built from reports, meetings and assessment versions
- Mobile report and meeting actions remain accessible in a safe-area-aware bottom action bar
- Existing Bucket List, portfolio, reports, meeting, assessment, portal and document functionality preserved

## Data notes

The dashboard metrics are derived from existing records:

- Current Portfolio: latest `monthlyReports.summary.totalCorpus`, falling back to Investor assessment investments
- Monthly Gain/Loss: latest `summary.investmentGain`
- Monthly Return: stored return where available, otherwise calculated from corpus, gain, new money and withdrawals
- YTD Return: derived from report history for the latest report year
- Net Contribution: latest new money minus latest withdrawals
- Reports Generated: Investor report-history count

No Firestore migration, index, rule or environment variable is required.

## Responsive behaviour

### Desktop

- Six compact financial metrics
- Sticky horizontal tabs
- Two-column Overview with contextual right rail
- Desktop tables for investments and liabilities

### Tablet

- Metrics reflow to three columns
- Context rail moves below the main Overview
- Tabs remain horizontally scrollable

### Mobile

- Two-column metrics
- Profile actions stack into a compact grid
- Tables become cards
- Sticky Meeting and Create Report actions
- Safe-area padding prevents controls from being hidden

## Testing

Test these routes and widths:

- `/investors/[investorId]`
- 390px
- 768px
- 1280px
- 1440px

Verify:

- Latest report metrics load correctly
- Tabs remain functional
- Create Report preselects the Investor
- Meeting creation preselects the Investor
- Reports, portal access and documents still load
- Mobile action bar does not cover final content
- No horizontal page scrolling
