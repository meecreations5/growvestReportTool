# GrowVest Monthly Report Dashboard UI/UX

## Scope

This update redesigns only the staff dashboard route:

- `/dashboard`
- `src/components/dashboard/DashboardOverview.js`

Existing authentication, Firestore services, report creation, publication, PDF generation, email delivery, Investor Portal, leads, meetings, MOM, servicing, users and settings remain unchanged.

## Dashboard information hierarchy

1. Reporting period and primary actions
2. Monthly reporting KPIs
3. Priority report issues
4. Report workflow progress
5. Recent monthly reports
6. Completion analytics
7. Aggregated portfolio overview
8. Recent report activity

## Data mapping

The dashboard uses existing Firestore data and does not require a migration.

- Total Investors: Investor profiles visible to the signed-in user
- Reports Due: Investors without a report for the selected month
- Draft Reports: `status === "draft"`
- Under Review: `status === "locked"` or `reviewStatus === "under_review"`
- Approved Reports: `status === "completed"`
- Reports Sent: `lastEmailStatus` is `sent`, `delivered`, `opened`, or `clicked`
- Data Issues: Missing report context, portfolio values, holdings, detailed funds, statement date, or commentary; failed delivery is also flagged
- Pending Delivery: Completed reports without a successful email status
- PDF Ready: `pdfStoragePath` is available

## Responsive behaviour

### Desktop

- Four compact KPI cards per row
- Horizontal report workflow
- Workflow and attention queue displayed side by side
- Operational report table
- Completion and portfolio analytics displayed side by side

### Tablet

- Two KPI cards per row
- Vertical workflow
- Attention queue above workflow
- Report table remains available from medium widths

### Mobile

- Two compact KPI cards per row
- Priority issues shown before the workflow
- Workflow converted to vertical connected steps
- Reports displayed as structured cards
- Sticky Import and Generate Report actions
- No horizontal dashboard overflow

## Existing data model limitations

The current report model has three primary statuses: Draft, Completed and Locked. The dashboard presents more operational labels by deriving them from existing publication, PDF and email fields. A future approval workflow can replace these derived mappings without redesigning the dashboard.

## Installation

No new package, Firestore rule, Firestore index or environment variable is required.

```powershell
npm install
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

## Test routes

```text
/dashboard
/reports
/reports/create
```

## Responsive test widths

```text
390px
768px
1280px
1440px
```

## Acceptance checklist

- The dashboard title is Monthly Report Dashboard
- Reporting month and financial year are visible
- Generate New Report is the primary action
- KPI cards remain compact on mobile
- Attention items link to the affected report or Investor
- Workflow is horizontal on desktop and vertical on mobile
- Recent reports use cards on mobile and a table on desktop
- Loading, empty and section-level error states are visible
- Indian currency formatting is retained
- Existing Firebase and report functionality is unchanged
