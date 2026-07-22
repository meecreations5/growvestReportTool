# Reconciled Scope — GrowVest Advisor & Monthly Reporting Tool

## 1. Sources reviewed

The scope reconciles four operating sources:

1. Lead Tracker — lead master, pipeline status, follow-up log, qualification score, TAT breach and advisor dashboard.
2. SOP 1 Client Assessment — linked lead details, personal profile, goals, preferences, risk score, qualification score, advisor notes and proposal summary.
3. SOP 3 Tracker Pack v2 — client servicing master, TAT monitor, monthly updates, queries, quarterly reviews, renewals, Addendum A and servicing checklist.
4. GrowVest Monthly Portfolio Report reference — manual monthly portfolio data, six-page branded HTML/PDF report.

## 2. Final user roles

- Super Admin: full access, user management, reassignment, settings, audit and deletion.
- Admin: operational access across all leads, clients, MOMs, servicing and reports.
- Advisor: create and manage self-created or assigned leads, investors, MOMs, follow-ups and reports.
- Investor: read-only access to their linked profile, published reports and client-shareable MOMs.

No public registration. Staff use Microsoft 365. Investors use mobile OTP or username/password.

## 3. Final business journey

Lead capture → SOP follow-up → client assessment → qualification → lead conversion → investor profile → servicing → MOM/review → manual monthly portfolio report.

## 4. Modules

### 4.1 Authentication and RBAC
- Microsoft 365 login for Super Admin, Admin and Advisor.
- Mobile OTP or username/password for Investor.
- Controlled account creation with no public registration.
- Four-role and record-level access.
- Separate staff and investor portals.

### 4.2 Lead Management
- Auto lead code.
- Source, referrer, advisor, date/time received, status, score, service, amount, purpose and next action.
- Exact SOP statuses preserved.
- TAT rules: entry/opening message 2 hours, qualification 24 hours, consultation/proposal 48 hours, follow-ups Day 2/4/7/10, outcome Day 14.

### 4.3 Follow-ups
- One row per touchpoint.
- Channel, summary, response, status after, lapse reason and next action.

### 4.4 Client Assessment
- Linked details.
- Personal and financial profile.
- Primary/secondary goals.
- SIP/lump sum preference and advisory areas.
- Four-question risk score out of 20.
- Qualification score out of 5.
- Advisor override reason and notes.

### 4.5 Investor Profile
- Created from a converted lead or directly by authorised users.
- Permanent profile plus goals, existing investments, liabilities, documents, assessment and activity.

### 4.6 MOM
- Lead/investor linkage, meeting details, attendees, agenda, discussion, decisions, internal/client notes, action items and follow-up.

### 4.7 SOP 3 Client Servicing
- Client status: ACTIVE, AT RISK, STALLED, CHURNED, PENDING.
- Monthly update: WhatsApp Day 3, email Day 5.
- Query TAT: General 8h, Action 4h, Complaint 2h, Urgent 1h.
- Quarterly review: invite 7 days before, cycle 90 days, recap 24h, rebalancing 2 days.
- Renewal flag 60 days before and conversation 45 days before.
- Addendum A categories A/B/C and timed escalation.
- Servicing checklist and named TAT alerts.

### 4.8 Monthly Portfolio Report
- Manual monthly data entry.
- Portfolio summary, holdings, advisor note, goal progress, allocation, fund details, next steps and review date.
- HTML preview and branded six-page PDF.
- Copy prior month and retain report history.

## 5. MVP exclusions

- NAV, broker, bank or stock-market integrations.
- Automated transactions.
- AI-generated financial advice.
- Public registration.
- Mobile app.
- WhatsApp API and campaign automation.

## 6. Development sequence

1. Foundation, Microsoft staff auth, investor auth, RBAC and separate portal shells.
2. Lead management and follow-up ladder.
3. Assessment and investor conversion.
4. MOM and action items.
5. SOP 3 servicing and TAT logic.
6. Manual monthly report generator.
7. Branded report preview/PDF and settings.
8. Audit, testing and deployment.
