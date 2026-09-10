# Release Validation — v0.34.7 Personalised Guest Investor Demo

## Locked behaviour

- Guest Demo remains Investor-only and synthetic/read-only.
- A guest is **not** added to Leads simply by starting or browsing the Demo.
- The exact conversion trigger is **Become part of GrowVest**.
- At CTA success, one normal `NEW` Lead is created immediately in the existing `leads` collection.
- `leadSource` is `Investor App Demo`.
- `originalLeadFlow` is `SOP 1 - Lead to Conversion`.
- Repeated CTA clicks are idempotent for the same Demo session.
- Optional details update the same Lead instead of creating a duplicate.
- Public enrichment does not overwrite staff-entered normal Lead fields.
- The existing Admin/Advisor Lead workflow continues after Lead creation.

## Deployment

No new Firebase Function is required for this refinement. The public prospect route runs in the Next.js application and writes through Firebase Admin credentials already used by the app.

Deploy the updated application normally. Firestore rules remain server-only for the demo submission helper collections.

## Production checks

1. Open Investor Login and start a new personalised Demo.
2. Confirm no Lead exists yet for that Demo session.
3. Select **Become part of GrowVest**.
4. Confirm a new Lead immediately appears under Leads with source `Investor App Demo` and status `NEW`.
5. Note the Lead code.
6. Return to the Demo and click **Become part of GrowVest** again.
7. Confirm no second Lead code is created.
8. Add email/city/interest/preferred contact on the enrichment screen.
9. Confirm the same Lead is updated.
10. Assign the Lead to an Advisor and continue the normal SOP 1 Lead to Conversion workflow.


## Guest Demo notification-session hotfix

- `NotificationBell` recognizes `demo_investor` as Investor mode and reads the existing synthetic `InvestorNotificationContext`.
- Demo sessions no longer call Firebase-authenticated notification polling when `auth.currentUser` is intentionally null.
- Staff notification polling requires an active Firebase user, preventing logout/demo transition races from starting staff polling.
- Installed PWA cache bumped to `v0.34.7-guest-demo3`.

- Personalised Demo hero no longer uses a black heading on Royal Trust Blue: the heading is white with a restrained Insight Yellow emphasis on `already yours.` and the demo badge uses the same accent only on the Sparkles icon.
