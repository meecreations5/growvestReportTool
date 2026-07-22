# Phase 5 — Manual Monthly Portfolio Report Generator

## Implemented

- Monthly report dashboard with search, year and status filters
- Create report from an Investor Profile
- One report per investor per month
- Copy the latest or selected previous report into the next month
- Manual portfolio summary and headline KPIs
- Holdings breakdown with automatic percentages
- Advisor monthly note and highlighted observation
- Multiple Bucket List goals with progress calculations
- Current versus target allocation with automatic variance
- Multiple fund/instrument rows linked to Bucket List goals
- Multiple next steps, ownership, due dates and statuses
- Next review date, mode and note
- Default editable disclaimer
- Save Draft and Complete Report workflows
- Report versions and activity logs
- Investor Profile report history
- Structured report data preview and browser print
- Firestore security and composite indexes

## Report lifecycle

`Draft -> Completed -> Phase 6 branded HTML/PDF -> Published to Investor`

Phase 5 deliberately keeps `investorVisible` false by default. Phase 7 will add controlled publication and investor notifications.

## Main routes

- `/reports`
- `/reports/create`
- `/reports/[reportId]`
- `/reports/[reportId]/edit`
- `/reports/create?investorId=...`
- `/reports/create?investorId=...&copyFrom=...`

## Firestore document

Collection: `monthlyReports`

The document stores report identity, portfolio summary, holdings, Advisor note, goals, allocation, funds, next steps, next review and disclaimer in one monthly snapshot.

## Required deployment

```bash
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Test sequence

1. Open an Investor Profile.
2. Click **Create monthly report**.
3. Select month, year and statement date.
4. Enter portfolio summary.
5. Add holdings and allocation.
6. Update Bucket List values.
7. Add fund-wise details and next steps.
8. Save as Draft.
9. Reopen and complete the report.
10. Use **Copy to next month** and verify that the new period is selected.
11. Confirm report history appears inside the Investor Profile.

## Next phase

Phase 6 converts the completed structured report data into the approved six-page GrowVest HTML report and downloadable A4 PDF.
