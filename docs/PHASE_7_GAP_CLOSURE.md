# Phase 7 Gap Closure

This update closes the gaps identified during Phase 7 verification.

## 1. Investor login methods

The Investor login page now supports three controlled login methods:

- Username & Password
- Mobile Login using Firebase OTP
- Google Login using a pre-authorised Google email

Google login is not public registration. Staff must enable it from the Investor Profile > Portal Access and authorise the exact Google email. The first successful Google login claims the alias and creates the linked Investor user profile.

### Firebase setup

Enable these providers under Firebase Authentication > Sign-in method:

- Email/Password
- Phone
- Google
- Microsoft (staff only)

Add both localhost and the production domain to Firebase Authentication authorised domains.

## 2. Client Servicing module

The previous placeholder screen has been replaced with a functional SOP 3 workspace containing:

- Client Servicing Master
- 11-rule TAT monitor
- Query Log with 8/4/2/1-hour limits
- Monthly WhatsApp and email update log
- Quarterly review, recap and rebalancing log
- Renewal tracker with 60-day flag and 45-day conversation dates
- Addendum A deadline-miss and escalation log
- Recurring servicing checklist

Records are restricted by Advisor ownership. Admin and Super Admin can view all records.

## 3. Branding and system settings

The Settings screen now stores reusable configuration in `reportSettings/global`:

- Company name, logo, watermark and contact details
- Report title, colours, footer and disclaimer
- Email and WhatsApp preferences
- Meeting reminders
- Lead sources, advisory areas and reusable masters
- SOP 3 servicing rules and TAT limits

Only Admin and Super Admin can save system settings.

## 4. Firestore index-building fallback

The requested composite index for:

```text
monthlyReports
investorId ASC
reportMonthKey DESC
```

is included in `firestore.indexes.json`.

Firestore can temporarily return an index-building error after deployment. Report history, latest-report lookup and Investor report lists now fall back to a simpler `investorId` query and sort/filter the result in the application while the composite index is building.

The composite index should still be deployed and allowed to finish building for production query performance.

## 5. Deploy and test

```bash
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
npm install
npm run build
npm run dev
```

### Investor login test

1. Open an Investor Profile.
2. Open Portal Access.
3. Enable one or more login methods.
4. For Google Login, enter the exact authorised Google email.
5. Open `/investor-login` and test all enabled methods.

### Client Servicing test

1. Open `/servicing`.
2. Add an Investor to Client Master.
3. Create a query and verify its TAT deadline.
4. Add monthly WhatsApp/email dates.
5. Add a quarterly review and recap.
6. Add a renewal date.
7. Log an Addendum A miss.
8. Complete a servicing checklist.

### Settings test

1. Open `/settings` as Admin or Super Admin.
2. Update Branding, Report Defaults and Servicing Rules.
3. Save settings.
4. Refresh and confirm the values persist.
