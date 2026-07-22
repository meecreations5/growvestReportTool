# Phase 4 — Meetings, MOM and Notifications

## Delivered scope

Phase 4 adds a complete meeting-to-MOM workflow linked to a Lead or Investor.

### Meetings

- Schedule meetings from the Meetings module or directly from an Investor profile.
- Link a meeting to an Investor, Lead or internal discussion.
- Manual Microsoft Teams, Google Meet, Zoom or other online meeting link.
- Physical, phone and WhatsApp-call meeting modes.
- Multiple attendees.
- Agenda and meeting instructions.
- Reschedule, complete and cancel a meeting.
- Assigned Advisor ownership and role-aware access.
- Meeting history inside the Investor profile.
- Investor Portal meeting list and joining link.

### Email communication

- Brevo SMTP transactional email.
- Email to Investor/Lead and assigned Advisor.
- Additional attendee invitations.
- `.ics` calendar attachment.
- Meeting scheduled, rescheduled, reminder and cancellation templates.
- Advisor reply-to address.
- Optional Advisor-specific sender when the sender is configured in Brevo.
- Communication logs stored by the server.

### WhatsApp

- Individual WhatsApp chat opens through `wa.me`.
- Meeting and MOM messages are prefilled.
- The Advisor reviews and manually presses Send.
- Opening WhatsApp is written to the activity timeline.
- No automatic WhatsApp delivery/read status is claimed.

### In-app notifications

- Notification bell for Staff and Investors.
- Unread count.
- Mark one or all as read.
- Deep links to Meetings, MOMs or Investor Portal records.
- Meeting, MOM, action-item and follow-up events.

### Minutes of Meeting

- MOM linked to a completed or scheduled meeting.
- Discussion summary and client-facing summary.
- Goals, investments and liabilities discussed.
- Advisor observations and internal notes.
- Multiple decisions.
- Multiple action items with owner, priority, due date and status.
- Client-visible flags.
- Optional next follow-up creation.
- Publish MOM to Investor Portal.
- Brevo email and manual WhatsApp sharing.
- Browser Print / Save as PDF.

### Reminders

A protected cron endpoint is included:

```text
GET /api/cron/meeting-reminders
Header: x-cron-secret: <CRON_SECRET>
```

It checks meetings due in the next 26 hours and processes:

- 24-hour reminder
- 1-hour reminder
- Email to Investor/Lead and Advisor
- In-app reminder notifications

Invoke this endpoint every 15 to 30 minutes using the hosting provider scheduler, Cloud Scheduler or another trusted scheduler.

## Environment configuration

Copy `.env.example` to `.env.local` and add server-only values:

```env
FIREBASE_ADMIN_PROJECT_ID=growvest-reporttool
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="<FIREBASE_ADMIN_PRIVATE_KEY>\n"

BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=...
BREVO_SMTP_PASSWORD=...
BREVO_DEFAULT_SENDER_NAME=GrowVest
BREVO_DEFAULT_SENDER_EMAIL=cwp@growvest.info
BREVO_REPLY_TO_EMAIL=cwp@growvest.info
BREVO_ALLOW_ADVISOR_SENDERS=false

CRON_SECRET=use-a-long-random-value
```

Do not use `NEXT_PUBLIC_` for SMTP, Firebase Admin or cron secrets.

The SMTP credential previously shared in conversation should be revoked and replaced before use.

## Advisor sender behaviour

Default safe configuration:

```text
From: Advisor Name from GrowVest <cwp@growvest.info>
Reply-To: advisor@growvest.info
```

After each Advisor address is configured as an allowed Brevo sender, set:

```env
BREVO_ALLOW_ADVISOR_SENDERS=true
```

The email then uses the Advisor's `@growvest.info` address as From where available.

## Firebase deployment

```bash
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

New collections include:

```text
meetings
meetingMinutes
followUps
notifications
communicationLogs
notificationPreferences
```

## Testing checklist

1. Schedule a meeting from an Investor profile.
2. Paste a valid Teams or Google Meet link.
3. Confirm the meeting appears in `/meetings`.
4. Confirm Investor and Advisor in-app notifications are created.
5. Confirm Brevo sends both emails and the `.ics` attachment.
6. Open the WhatsApp button and verify the individual chat and prefilled message.
7. Reschedule and confirm the updated email.
8. Cancel a meeting and confirm the cancellation email.
9. Mark a meeting completed.
10. Create a MOM with decisions and action items.
11. Publish the MOM and confirm Investor Portal visibility.
12. Confirm internal notes do not appear in Investor Portal or client email.
13. Run the reminder endpoint with `x-cron-secret`.
14. Verify Firestore security with Admin, Advisor and Investor accounts.
15. Run `npm run lint` and `npm run build` locally.

## Deliberate MVP boundaries

- Meeting links are entered manually.
- There is no Microsoft Graph or Google Calendar API integration.
- WhatsApp is manual click-to-chat, not an automated WhatsApp Business API.
- Background browser push through Firebase Cloud Messaging is not included yet; in-app notifications are included.
- Brevo delivery webhooks are not wired yet. The system logs send success/failure returned by SMTP.
