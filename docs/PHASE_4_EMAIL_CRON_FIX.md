# Phase 4 Email, WhatsApp and Cron Fix

## Issues found

1. The meeting communication API returned HTTP 200 even when Brevo delivery failed. The form therefore redirected without showing the failure.
2. Meeting creation did not open WhatsApp. WhatsApp was available only on the meeting detail page.
3. The meeting detail page wrote the activity log before opening WhatsApp. The asynchronous delay could cause browsers to block the popup.
4. The cron secret only protects the endpoint; it does not invoke the endpoint automatically.
5. Reminder windows were narrow, so a delayed scheduler run could miss a reminder.
6. Missing SMTP and Firebase Admin environment variables were not easy to diagnose.

## Fixes included

- Email API now returns an error status when any Brevo delivery fails.
- Exact SMTP errors are stored on the meeting record as `lastEmailError`.
- Meeting details display the latest email status and error.
- Investor email falls back to the primary attendee email when required.
- Meeting creation pre-opens WhatsApp during the user click and navigates it after the meeting is saved.
- Meeting detail WhatsApp opens before the activity-log write.
- Added `/api/communications/health`.
- Added `/api/communications/test-email`.
- Added Settings > Brevo SMTP diagnostics UI.
- Cron reminder windows are tolerant of delayed scheduler runs.
- Added forced single-meeting reminder testing.

## Required `.env.local`

```env
FIREBASE_ADMIN_PROJECT_ID=growvest-reporttool
FIREBASE_ADMIN_CLIENT_EMAIL=service-account-email
FIREBASE_ADMIN_PRIVATE_KEY="<FIREBASE_ADMIN_PRIVATE_KEY>\n"

BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=your-brevo-smtp-login
BREVO_SMTP_PASSWORD=your-new-smtp-key
BREVO_DEFAULT_SENDER_NAME=GrowVest
BREVO_DEFAULT_SENDER_EMAIL=cwp@growvest.info
BREVO_REPLY_TO_EMAIL=cwp@growvest.info
BREVO_ALLOW_ADVISOR_SENDERS=false

CRON_SECRET=<32-plus-character-random-secret>
```

`BREVO_SMTP_USER` must be the SMTP login displayed by Brevo. It is often different from the sender email.

Restart Next.js after changing `.env.local`.

## Test Brevo

Open **Settings** and use:

1. Check connection
2. Send test email

The test email is sent to the email stored in the signed-in staff user's Firestore profile.

## Test automatic meeting email and WhatsApp

1. Confirm that the selected Investor has both `email` and `contactNo`.
2. Create a meeting.
3. Keep **Email investor / lead** selected.
4. Keep **Prepare WhatsApp message** selected for the primary attendee.
5. Allow popups for localhost or the production domain.
6. Click **Schedule and notify**.

Expected result:

- Meeting is saved.
- WhatsApp opens with the prepared message.
- Investor and Advisor emails are sent.
- Meeting detail displays the email result.

## Test cron authentication

```powershell
$headers = @{
  "x-cron-secret" = "YOUR_CRON_SECRET"
}

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/cron/meeting-reminders" `
  -Method GET `
  -Headers $headers
```

A successful request can still show `processed: 0` when no reminder is due.

## Force-test one meeting reminder

Copy the Firestore meeting document ID and run:

```powershell
$headers = @{
  "x-cron-secret" = "YOUR_CRON_SECRET"
}

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/cron/meeting-reminders?meetingId=MEETING_DOCUMENT_ID&force=1_hour" `
  -Method GET `
  -Headers $headers
```

Use `force=24_hours` to test the 24-hour template.

The forced mode is intended only for controlled testing.

## Production scheduler

The endpoint must be invoked every 15 to 30 minutes by the hosting scheduler or another cron service. `CRON_SECRET` and `x-cron-secret` authenticate the request; they do not create a schedule by themselves.
