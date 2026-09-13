# v0.34.13 - Investor Launch Opening Wealth Review, Goal Reconciliation & Naming Standard

## Purpose

GrowVest is launching the Investor App to investors while many investors do not yet have a previously published GrowVest monthly report. v0.34.13 gives those investors an honest starting point instead of manufacturing a prior-month comparison from newer portfolio data.

The first investor-facing report is an **Opening Wealth Review**. It freezes the latest verified Portfolio Master snapshot available at launch and becomes the baseline for future **Monthly Wealth Reviews**.

## First-report rule

- If the investor has no previously published GrowVest Wealth Review, the Create Report workspace automatically selects **Opening Wealth Review**.
- The Opening Wealth Review uses the date/month of the verified Portfolio Master snapshot, not a forced previous-month cutoff.
- The Opening baseline period is locked to that snapshot and cannot be migrated to another month.
- Previous-period return, Money Added, Money Withdrawn and monthly investment gain are not inferred for the Opening Wealth Review.
- The Opening Wealth Review must be published before a new Monthly Wealth Review can be published.
- Monthly Wealth Reviews start from the month after the Opening baseline month.
- Existing investors with genuine legacy published Monthly Reports are not forced to create a retrospective Opening Wealth Review.

## Portfolio Master is authoritative for actual goal progress

Goal definition remains in Investor Master / Bucket List:

- goal name
- target amount
- target year / timeline
- priority and goal type

Actual progress comes from Portfolio Master:

- current corpus assigned to the goal
- active monthly SIP assigned to the goal
- linked investments
- portfolio-derived goal status

The application no longer treats a manually stored `bucketList.currentAmount` as authoritative when a current Portfolio Master exists.

### Example launch reconciliation

For the launch test case:

- Current Portfolio: INR 24,298
- Total Invested: INR 23,000
- Active Monthly SIP: INR 3,000
- Goal: General Wealth / Corpus Creation
- Target: INR 10,00,000
- All three Mutual Fund holdings allocated to that goal

GrowVest derives:

- Current Goal Corpus: INR 24,298
- Active Monthly SIP: INR 3,000
- Progress: 2.4%
- Status: SIP Running

Legacy links such as `General Wealth`, `General Wealth (Default)`, `general_wealth`, `General Wealth / Corpus Creation` and equivalent aliases are reconciled to the Investor's canonical General Wealth / Corpus Creation goal where applicable.

## Goal status convention

Actual portfolio state drives the investor-facing status:

- **Completed** - current goal corpus has reached/exceeded target
- **SIP Running** - an active monthly contribution exists
- **Invested / No Active SIP** - corpus exists but no active monthly SIP is recorded
- **Not Started** - no allocated corpus and no active monthly SIP

## Historical safety for Bucket List allocation

New position-to-goal allocation updates record `goalAllocationEffectiveFrom`. A verified Portfolio Master snapshot is created after the allocation update so historical snapshots retain the allocation state that existed at that time.

A current allocation is therefore not silently backdated into an earlier Wealth Review.

## Pre-publish reconciliation gate

Before publication, GrowVest validates the frozen report for internal consistency:

1. Investment-wise Current Value reconciles to the Portfolio total.
2. Investment-wise Active SIP reconciles to the report Active Monthly SIP.
3. Asset Allocation reconciles to the Portfolio total.
4. Goal / Bucket List current corpus reconciles to investments allocated to each goal.
5. Goal status and Active SIP agree with Portfolio Master allocations.
6. Goal-linked corpus plus General Wealth covers the full long-term portfolio.
7. Opening Wealth Review uses the same verified snapshot as its Opening baseline.
8. Portfolio Master verification is publication-ready.

Critical mismatches block publication rather than allowing an investor-facing PDF with contradictory numbers.

## Report naming standard

### App/module terminology

- Module: **Wealth Reviews**
- First report: **Opening Wealth Review**
- Ongoing report: **Monthly Wealth Review**

### Display titles

Opening:

`GrowVest Opening Wealth Review`

Monthly:

`GrowVest Monthly Wealth Review - September 2026`

### Report reference codes

Opening:

`GV-OWR-YYYYMMDD-{CLIENT_TOKEN}`

Example:

`GV-OWR-20260911-GV104`

Monthly:

`GV-MWR-YYYY-MM-{CLIENT_TOKEN}`

Example:

`GV-MWR-2026-10-GV104`

The code builder is centralised so Create/Edit and period migration do not create different reference formats.

### PDF filenames

Default investor-facing filenames do not expose internal revision numbers:

Opening:

`GrowVest_Opening_Wealth_Review_Investor_Name_2026-09-11.pdf`

Monthly:

`GrowVest_Monthly_Wealth_Review_Investor_Name_2026-10.pdf`

The configurable pattern is:

`{CompanyName}_{ReportType}_{InvestorName}_{ReportPeriod}.pdf`

Supported tokens include CompanyName, ReportType, ReportPeriod, AsOfDate, InvestorName, Month, Year, ClientCode, ReportCode and Version.

### Internal immutable version IDs

`{reportId}_v001`

`{reportId}_v002`

`{reportId}_v003`

Investor UI can display these as Version 1, Version 2, Version 3 while only the active published version is presented as the current review.

### Storage structure

The existing server-only `monthly-reports` Storage root is retained for backward-compatible Firebase Storage rules. New files are organised below it as:

`monthly-reports/{investorId}/opening/{YYYY-MM-DD}/v001/{filename}.pdf`

or

`monthly-reports/{investorId}/monthly/{YYYY-MM}/v001/{filename}.pdf`

## Investor App consistency

Live Investor App Goal/Bucket List data reconciles the Investor goal master against Portfolio Master goal totals and investment links. Where Portfolio Master exists, an unmatched goal displays zero current corpus rather than falling back to a stale manually stored current amount.

The staff Investor Profile uses the same principle so Profile, Portfolio, Bucket List and Wealth Review do not tell the investor different stories.

## Launch operating sequence

For each first-time investor:

1. Verify/import the latest Portfolio Master data.
2. Confirm goal/Bucket List definitions.
3. Confirm each long-term holding is allocated to the intended goal or General Wealth.
4. Create Opening Wealth Review.
5. Confirm the Opening baseline date matches the verified Portfolio snapshot.
6. Review the reconciliation checks.
7. Complete and generate the secure PDF.
8. Compare Preview with the downloaded secure PDF.
9. Publish the Opening Wealth Review.
10. Future reporting begins with the following Monthly Wealth Review.

Recommended launch QA is 3-5 representative investors before bulk rollout: Mutual Funds only, MF + Equity, Bucket List goals, no specific Bucket List, and Insurance/other investments.

## Compatibility boundaries

v0.34.13 intentionally preserves:

- existing `monthlyReports` Firestore collection name
- existing `monthly-reports` Storage root
- existing role/permission keys such as `advisor` and `reports`
- immutable published report-version history
- Investor visibility and secure PDF access controls
- Portfolio transaction and valuation logic

The release changes report type/baseline behavior, live goal reconciliation, publication validation and display/naming conventions without performing a destructive schema migration.
