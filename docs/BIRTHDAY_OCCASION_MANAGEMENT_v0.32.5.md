# GrowVest v0.32.5 — Birthday & Occasion Management

## Purpose

v0.32.5 turns the existing investor DOB field and basic birthday cron into a relationship-management module. The module is staff-facing. It never sends an Investor birthday/occasion message automatically; it creates internal reminders and lets the assigned Advisor record the completed touchpoint.

## Investor birthday profile

Investor Profile and Client Assessment support:

- Date of birth (`YYYY-MM-DD`).
- Automatic age calculation.
- Birthday reminder enabled/disabled.
- Multi-reminder schedule using any combination of 30, 14, 7, 3, 1 and 0 days before the birthday.
- Next birthday, days remaining and turning age on Investor Details.

Older `birthdayReminderDaysBefore` records remain compatible. When the new `birthdayReminderOffsets` field is absent, GrowVest falls back to the legacy single reminder value.

## Birthday & Occasion Centre

Staff navigation now includes:

`Advisory → Birthdays & Occasions`

The page provides:

- Today.
- Next 7 days.
- Next 30 days.
- Pending touchpoints.
- Completed touchpoints.
- All upcoming occasions (next 366 days).
- Search by Investor, family member, client code, relationship or occasion type.

Each row shows the Investor, person, relationship, date, days remaining, Advisor and current touchpoint status.

## Family and relationship occasions

Staff can add an occasion linked to an Investor with:

- Person name.
- Relationship: Spouse, Child, Parent, Sibling, Family Member or Other.
- Occasion type: Birthday, Anniversary or Other.
- Occasion date.
- Reminder schedule.
- Internal note.

Custom occasions are stored in `investorOccasions`. Investor DOB remains the source of truth for the Investor's own birthday.

## Touchpoint completion

The Advisor can record:

- Called.
- WhatsApp completed.
- Email completed.
- Wish completed / Other.
- Skip.
- Reopen.

Annual touchpoints are stored in `occasionTouchpoints` using a deterministic occasion + event-year identity. This allows the same recurring occasion to be tracked independently each year.

Every complete/skip/reopen operation also creates an `activityLogs` record.

## Reminder cron

Protected endpoint:

```text
GET /api/cron/birthday-reminders
x-cron-secret: <CRON_SECRET>
```

The endpoint should be invoked once daily by the hosting scheduler.

The job:

1. Uses `Asia/Kolkata` date boundaries.
2. Loads active Investors and active custom occasions.
3. Calculates each next annual occurrence.
4. Checks all configured reminder offsets.
5. Skips annual touchpoints already completed or skipped.
6. Creates one deterministic Advisor notification per occasion/year/reminder offset.
7. Never sends Investor email, WhatsApp or SMS automatically.

February 29 occasions use February 28 in non-leap years for reminder purposes.

## Dashboard

The staff Dashboard includes a `Birthdays & occasions` relationship-touchpoint card showing the next 7 days and linking to the full module.

## Security

`investorOccasions` and `occasionTouchpoints` are server-managed. Browser reads/writes are denied in Firestore rules. UI access is through authenticated staff API routes and Advisor access is restricted to accessible Investor records.

No new composite Firestore index is required.

## Deployment

Because Firestore rules add explicit server-only collection blocks, deploy rules after installing v0.32.5:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Configure the existing daily scheduler to invoke `/api/cron/birthday-reminders` once per day using the `CRON_SECRET` header.

## UAT

1. Add DOB to a test Investor and choose 7, 1 and 0 day reminders.
2. Verify Investor Details shows next birthday and turning age.
3. Open `Birthdays & Occasions` and verify the Investor appears in the appropriate date range.
4. Add a spouse/child birthday or anniversary.
5. Mark a test touchpoint as Called / WhatsApp / Email and confirm it becomes Completed.
6. Reopen and skip a touchpoint; verify activity history is created.
7. Invoke the cron with a test date/occasion due at a configured offset and confirm only the assigned Advisor gets an in-app notification.
8. Invoke the cron again and confirm the same reminder notification is not duplicated.
9. Confirm no Investor-facing message is sent automatically.
