# UI/UX — Create Monthly Report Workspace

## Scope

This update redesigns the existing `/reports/create` and `/reports/[reportId]/edit` experience into a guided monthly-report workflow while preserving the existing Firebase, Firestore, validation, report, PDF, publication, and delivery logic.

## Implemented workflow

1. Investor
2. Reporting Period
3. Portfolio Data
4. Review Calculations
5. Commentary
6. Goals & Allocation
7. Template
8. Preview & Approval
9. Generate PDF
10. Deliver Report

Only one workflow step is visible at a time. Steps are unlocked progressively according to report readiness.

## Main improvements

### Workspace shell

- Compact report header with investor, reporting period, draft status, and save status
- Desktop progress rail
- Mobile and tablet progress drawer
- Responsive report-summary panel on large screens
- Sticky contextual workflow actions
- Locked-step explanations
- Existing report lock state retained

### Step 1 — Select Investor

- Search by investor name, client code, email, mobile, or Advisor
- Quick-select investor profiles
- Responsive investor cards
- Selected-investor confirmation panel
- Portfolio value, Advisor, email, and Investor Portal status
- Investor profile data continues to populate the report using the existing logic

### Step 2 — Reporting Period

- Reporting month
- Report year
- Derived financial year
- Suggested month-end statement date
- Report title
- Data-source status
- Previous-report summary
- Copy-previous-month action
- Duplicate monthly-report detection with link to the existing report

### Existing report content

The existing report data and form functionality remain available in the guided workflow:

- Portfolio summary
- Asset-class holdings
- Fund-wise details
- Advisor commentary and highlights
- Bucket List goals
- Current versus target allocation
- Next steps and next review
- Disclaimer and completion validation

### Review calculations

- Entered corpus
- Asset-class total
- Fund-wise total
- Reconciliation difference
- Clear reconciled or attention-required state

### Responsive behaviour

#### Desktop

- Progress rail on the left
- Main step workspace in the centre
- Report summary on wide screens
- Sticky workflow actions

#### Tablet

- Progress rail is replaced by a top progress control
- Report summary is hidden to protect workspace width
- Form fields reflow to two columns where appropriate

#### Mobile

- Full-screen step drawer
- Single-column investor and report forms
- Compact sticky Back, Save, and Continue actions
- Safe-area spacing
- No desktop table compression

## New files

- `src/components/reports/create/InvestorSelectionStep.js`
- `src/components/reports/create/ReportingPeriodStep.js`
- `src/components/reports/create/ReportWorkflowShell.js`

## Updated files

- `src/components/reports/ReportForm.js`
- `src/app/globals.css`

## Routes

- `/reports/create`
- `/reports/[reportId]/edit`

## Test checklist

### Create flow

1. Open `/reports/create`.
2. Search and select an investor.
3. Confirm the selected-investor summary.
4. Continue to Reporting Period.
5. Confirm the suggested statement date.
6. Change month and year and verify the title updates.
7. Confirm previous-report information is shown when available.
8. Select a month with an existing report and verify the duplicate warning.
9. Save the draft after Investor and Reporting Period are complete.
10. Continue through Portfolio Data and the remaining report steps.

### Edit flow

1. Open an existing report using `/reports/[reportId]/edit`.
2. Confirm Investor, month, and year remain protected.
3. Confirm save status and completion progress load correctly.
4. Save changes without leaving the editor.
5. Complete the report from Preview & Approval.

### Responsive widths

- 390px
- 768px
- 1280px
- 1440px

## Deployment impact

- No new environment variables
- No Firestore rule changes
- No Firestore index changes
- No Firebase Authentication changes
- No data migration
