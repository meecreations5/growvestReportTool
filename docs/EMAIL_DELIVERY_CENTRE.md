# Email & Delivery Centre

## Route

`/email-delivery`

## Purpose

The Email & Delivery Centre is the operational workspace for monthly Investor report communication. It combines report readiness, email composition, PDF attachment, scheduled delivery, retries and provider delivery events.

## Included capabilities

- Summary cards for Sent, Delivered, Opened, Failed, Scheduled and Pending reports.
- Search by Investor, client code, report code, email address and Advisor.
- Filters for reporting month, delivery status and Advisor.
- Desktop table and mobile delivery cards.
- Send now, schedule, retry and test email actions.
- Custom recipient, CC, BCC, subject and email message.
- Generated PDF attachment when a secure PDF exists.
- Delivery history and failure reason drawer.
- Download PDF and open report actions.
- Protected scheduled-delivery cron endpoint.
- Brevo transactional webhook endpoint for delivered, opened, clicked, bounced and blocked events.

## New collections

### `emailDeliveries`

Stores each report email attempt or scheduled delivery, including:

- Report and Investor identity
- Recipient, CC and BCC
- Subject and message snapshot
- PDF attachment information
- Schedule and send timestamps
- Provider message ID
- Delivery, opening and failure timestamps
- Advisor and audit fields

### `emailDeliveryEvents`

Stores deduplicated Brevo transactional webhook events.

## Environment variables

Add these to the deployed server environment:

```env
NEXT_PUBLIC_APP_URL=https://your-growvest-domain.example
CRON_SECRET=<32-plus-character-random-secret>
BREVO_WEBHOOK_TOKEN=<different-32-plus-character-random-secret>
```

Keep the existing Brevo SMTP and Firebase Admin variables configured. Never expose the webhook or cron secrets through `NEXT_PUBLIC_` variables.

## Brevo webhook configuration

Create a Brevo transactional webhook using:

```text
Notify URL: https://your-domain.example/api/webhooks/brevo
Authentication: Bearer token
Token: same value as BREVO_WEBHOOK_TOKEN
```

Recommended events:

```text
sent
delivered
opened
uniqueOpened
click
hardBounce
softBounce
blocked
invalid
deferred
spam
unsubscribed
```

The application sends a delivery ID and report ID through custom email headers so the webhook can map events to the correct record. Provider message ID matching is also supported.

## Scheduled delivery

Call the protected endpoint periodically:

```http
GET /api/cron/report-deliveries
x-cron-secret: YOUR_CRON_SECRET
```

A 10–15 minute schedule is suitable for normal monthly report delivery. The endpoint claims due scheduled records before sending to avoid duplicate processing.

## Deploy

```powershell
firebase deploy --only firestore:rules,firestore:indexes
npm install
npm run build
npm run dev
```

## Test flow

1. Complete and publish a monthly report.
2. Generate its PDF.
3. Open `/email-delivery`.
4. Choose Send on the report.
5. Review recipient, subject and message.
6. Send a test email to the signed-in staff user.
7. Send now or schedule a future delivery.
8. Confirm the status changes to Sent.
9. Trigger or wait for a Brevo delivery webhook.
10. Confirm Delivered or Opened appears in the centre.
11. Test a failed address and verify Retry and failure details.

## Current limitation

Provider-level Delivered, Opened and Clicked statuses require the Brevo webhook to be configured. Without it, successfully accepted emails remain in Sent status.
