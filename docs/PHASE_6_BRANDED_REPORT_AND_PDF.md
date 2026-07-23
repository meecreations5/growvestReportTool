# Phase 6 — Branded Monthly Wealth Report, A4 PDF and Publishing

## Objective

Phase 6 converts the structured Phase 5 monthly report data into:

1. An interactive Investor Portal web report based on the approved GrowVest design.
2. A dedicated A4 report layout for browser printing and a secure server-generated PDF stored in Firebase Storage.
3. A controlled report publication workflow with immutable report versions, Investor Portal visibility, in-app notification, Brevo email and manual WhatsApp sharing.

## Main routes

```text
/reports/[reportId]
/reports/[reportId]/edit
/report-print/[reportId]
/investor/reports
/investor/reports/[reportId]
```

Use the following route to open the browser print dialog automatically:

```text
/report-print/[reportId]?autoprint=1
```

## Interactive web report

The web report contains:

- Investor journey header and assigned Advisor card
- Total portfolio value and month-on-month movement
- Overall Bucket List progress
- Monthly SIP, new money, investment gain and active-goal KPIs
- Portfolio value trend derived from earlier monthly reports
- This Month at a Glance highlights
- Portfolio composition doughnut chart
- Advisor narrative, progress highlight, priority attention and portfolio opportunity
- Searchable and filterable Bucket List goal cards
- Portfolio health and current-versus-target allocation bars
- Asset allocation table and CSV export
- Fund-wise holdings table and CSV export
- Advisor-recommended actions
- Next portfolio review and `.ics` download
- Report reference, version and disclaimer

## A4 report

The print route and secure server renderer use aligned A4 portrait documents. They support:

- GrowVest cover page with published branding snapshot
- Executive portfolio summary and historical trend
- Month-on-month performance highlights
- Dynamic Bucket List pages
- Portfolio health, allocation summary and full allocation details
- Dynamic fund-wise holding pages
- Explicit or fund-derived transaction pages
- Advisor commentary and insight cards
- Recommended actions and next review
- Paginated report information and disclaimer
- Repeating page headers, legal footers, report references and watermarks

### Save as PDF

Click **Download / Save PDF**. The browser print dialog opens automatically. Select:

```text
Destination: Save as PDF
Paper size: A4
Margins: None / Default from report CSS
Background graphics: Enabled
```

The browser print document is provided for live A4 review. On generation or publication, the server also creates a private PDF binary, stores it in Firebase Storage and records its path, filename, size, renderer version and branding snapshot on the report/version record.

The HTML report, browser print document and secure PDF resolve the same saved template order, visibility and shared report-presentation data.

## Report publication workflow

```text
Complete report
→ Open report preview
→ Publish & Email
→ Investor Portal visibility enabled
→ Investor in-app notification created
→ Brevo publication email sent
→ Optional manual WhatsApp message opened by Advisor
```

The report can be unpublished by Admin or the assigned Advisor.

## Email settings

Phase 6 reuses the existing Brevo SMTP setup. Add the application URL so email links use the deployed domain:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Production example:

```env
NEXT_PUBLIC_APP_URL=https://reports.growvest.info
```

Existing Brevo variables remain required:

```env
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=
BREVO_SMTP_PASSWORD=
BREVO_DEFAULT_SENDER_NAME=GrowVest
BREVO_DEFAULT_SENDER_EMAIL=cwp@growvest.info
BREVO_REPLY_TO_EMAIL=cwp@growvest.info
BREVO_ALLOW_ADVISOR_SENDERS=true
```

## Firestore deployment

Phase 6 adds a composite index for Investor Portal report history and portfolio trend:

```text
investorId ASC
investorVisible ASC
status ASC
reportMonthKey DESC
```

Deploy the included rules and indexes:

```bash
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Test checklist

### Staff report workflow

```text
Create or edit monthly report
→ Add Advisor insights and custom highlights
→ Complete report
→ Open interactive report
→ Verify trend, goals, allocation and funds
→ Open Print Preview
→ Save as PDF
→ Publish & Email
→ Open WhatsApp sharing
```

### Investor workflow

```text
Investor login
→ Monthly Reports
→ View Report
→ Verify only published completed reports appear
→ Open Print Preview
→ Download / Save PDF
→ Check in-app notification
```

### Historical trend

Create at least two completed monthly reports for the same Investor. The report automatically builds its trend from `summary.totalCorpus` values ordered by `reportMonthKey`.

## Data additions

Phase 6 adds the following optional fields to `monthlyReports`:

```javascript
{
  advisorEmail: "",
  advisorPhone: "",
  advisorDesignation: "Relationship Manager",
  journeyDurationMonths: 0,

  advisorInsights: {
    narrative: "",
    progressHighlight: { title: "", description: "" },
    priorityAttention: { title: "", description: "" },
    portfolioOpportunity: { title: "", description: "" }
  },

  monthlyHighlights: [
    {
      id: "highlight-1",
      type: "success | info | warning | danger",
      title: "",
      description: ""
    }
  ],

  portfolioHealth: {
    observation: "",
    growthAssetClasses: ["Equity", "Trading", "Real Estate"],
    stableAssetClasses: ["Debt", "Liquid", "Cash", "Insurance", "Gold"]
  },

  nextSteps: [
    {
      title: "",
      description: "",
      owner: "Investor | Advisor | GrowVest | Joint",
      priority: "High | Medium | Planned | Future | Low",
      dueDate: "",
      status: "Pending | In Progress | Completed | Cancelled"
    }
  ]
}
```

All new fields are optional and existing Phase 5 report documents remain compatible. Missing insights and highlights are derived from existing goal, gain and allocation data.

## PDF consistency status

The browser A4 document and secure server-generated PDF are aligned for section order, visibility, branding, historical trends, transactions and pagination. Implementation and UAT details are documented in `docs/PDF_CONSISTENCY_PASS.md`.
