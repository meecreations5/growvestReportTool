# Phase 2 — Lead Detail, Follow-ups and TAT Engine

## Implemented routes

- `/leads` — searchable lead list with status and TAT filters.
- `/leads/create` — create a lead and redirect to its detail page.
- `/leads/[leadId]` — lead workspace with overview, TAT, follow-ups and activity.
- `/dashboard` — live lead KPIs and prioritised attention queue.

## Lead detail capabilities

- Live Firestore lead subscription.
- Advisor record-level access through Firestore rules.
- Contact and opportunity overview.
- Current pipeline status and next-action update.
- Follow-up form covering channel, summary, response, status after, lapse reason, next action and next due date.
- Follow-up history.
- Immutable activity timeline entries for creation, follow-ups and status updates.

## SOP 1 TAT rules implemented

- New lead opening contact: 2 hours from receipt.
- Qualification: 24 hours after entering Contacted.
- Consultation/proposal: 48 hours after Qualified or Warm.
- Proposal follow-up ladder: Day 2, Day 4, Day 7, Day 10 and final outcome Day 14.
- Converted lead onboarding: 1 hour unless an investor record is linked.
- Committed, long follow-up, lapse and recovered statuses use the manually selected next due date when available.

The TAT engine returns the next required action, deadline, days in current status and one of these states:

- `on_track`
- `breached`
- `complete`
- `not_set`

## Firestore additions

### `leadFollowUps`

Required ownership and tracking fields:

- `leadId`
- `leadCode`
- `leadName`
- `assignedAdvisorUid`
- `advisorName`
- `contactAt`
- `channel`
- `summary`
- `clientResponse`
- `statusBefore`
- `statusAfter`
- `nextAction`
- `followUpDue`
- `createdByUid`
- `createdByName`
- `createdAt`

### `activityLogs`

Lead activity is stored with:

- `recordType: "lead"`
- `recordId`
- `leadId`
- `advisorUid`
- `action`
- `title`
- `description`
- `metadata`
- actor and timestamp fields

## Required deployment

Deploy the updated rules and indexes before testing follow-ups:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

The new composite indexes cover:

- `leadFollowUps`: `leadId + contactAt desc`
- `activityLogs`: `recordType + recordId + createdAt desc`
