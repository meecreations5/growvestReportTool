# GrowVest v0.34.5 — Investor Experience Reconciliation

## Product position

The Investor App is reconciled around three investor questions:

1. **Where am I today?** — Portfolio and verified wealth.
2. **What am I building toward?** — Bucket List and goal-linked investments.
3. **What should I do next?** — Need Attention, SIP reminders, protection, meetings and Monthly Review.

The product is intentionally not positioned as another broker-style investment tracker. Its purpose is to connect the investor's complete wealth view with the life goals GrowVest is helping them plan and review.

## Home structure

The phone Home hero keeps the approved height but is now structurally edge-to-edge. `InvestorShell` removes the phone content gutter only for `/investor/dashboard`; the Royal Trust Blue hero owns the full width, while Quick Actions and all content below return to the normal 14px app gutter. This removes the clipped negative-margin breakout used by the previous version.

Home keeps the hierarchy: **Wealth → Need Attention → Bucket List → Monthly Review → GrowVest Partner**.

## Phone navigation

Persistent phone navigation is:

**Home | Portfolio | GrowVest | Bucket List | Reports**

Profile is intentionally removed from the permanent five-item rail. It remains one tap away from the Home avatar and the GrowVest centre action sheet.

## SIP-to-Home intelligence

Portfolio Master now retains the latest SIP transaction date and an inferred debit day for Mutual Fund SIP/Both holdings. If a holding has a monthly SIP but no manually configured SIP funding schedule, the authenticated SIP API can infer a reminder schedule from the latest SIP history.

Manual staff configuration remains authoritative. An existing staff-configured debit day is not overwritten by portfolio inference.

Home reads the resulting schedule and prioritises upcoming SIPs by proximity to the next debit date. SIP reminder API failures are no longer silently treated as "no SIP"; Home can surface a restrained recovery message instead.

## Verified daily portfolio notification

A Firebase Function watches `portfolioSnapshots`. A notification is created only when both:

- `verificationStatus === "verified"`, and
- `reconciliationStatus === "verified"`.

The Investor receives one in-app notification per investor/date. If web push is enabled and the **Portfolio updates** preference is enabled, the same event produces a push notification. The notification deep-links to `/investor/portfolio`.

Same-day snapshot corrections do not create duplicate notification noise.

## Notification preferences

Investor notification preferences now include:

- Portfolio updates
- SIP reminders
- Bucket List
- Monthly Review
- Meetings & MOM
- Documents
- Protection & renewals
- GrowVest updates

The existing global push switch remains available.

## Investor Add Bucket List

The Bucket List screen now includes **Add to My Bucket List**.

The investor can submit:

- goal / dream name,
- category,
- approximate target amount,
- desired target date or broad timeline,
- a note describing what the goal means to them.

A submitted request is deliberately **not** inserted into the active `bucketList` / `goals` arrays. The investor sees it as **Review with GrowVest** while it is being discussed.

Investor-facing workflow states are:

- Review with GrowVest
- Needs your input
- Confirmed
- Not proceeding

The internal workflow supports `submitted`, `discussion_required`, `needs_information`, `discussion_completed`, `confirmed` and `declined`.

## GrowVest review and confirmation

Admin, Super Admin or the currently assigned Advisor can review an investor-submitted Bucket List request from the Investor profile's **Goals & Bucket List** tab.

GrowVest can refine:

- goal name,
- category,
- target amount,
- target date,
- monthly contribution,
- priority,
- timeline,
- Advisor note.

Confirmation requires GrowVest to first mark the investor discussion complete, and then requires a target amount and target date. This is intentional: the investor can submit an aspiration with incomplete numbers, but it becomes part of the financial plan only after GrowVest has discussed and confirmed the planning assumptions.

Once confirmed, a stable goal is added to the Investor's active Bucket List and becomes eligible for portfolio assignment, corpus calculations and progress tracking. Until confirmation, it remains outside all active-goal calculations.

When the investor submits a request, the assigned Advisor receives an internal notification. If no Advisor is assigned, active Admin/Super Admin users are notified. When GrowVest changes the request status, the Investor receives an in-app notification; investor push preferences apply to those notifications.

## Profile completion

The phone Profile now exposes available Investor Master context without inventing missing data:

- email,
- mobile,
- city,
- date of birth,
- client code,
- masked PAN,
- masked Aadhaar last four digits when configured,
- risk profile,
- active Bucket List count,
- latest portfolio date,
- portfolio reconciliation status,
- monthly SIP plan,
- notification/security/privacy controls,
- GrowVest Partner details.

Full PAN/Aadhaar values are not exposed by the Investor App API.

## Brand and UI rules retained

- Royal Trust Blue = GrowVest / active / progress.
- Deep Premium Black = wealth / premium review.
- Insight Yellow = planning / pending attention.
- Strategic Red = urgent / negative / failure.
- Gray/White = structure and breathing space.
- Slim Lucide icon family remains the standard.
- Official GrowVest SVG identity remains the centre action.
- v0.34.3 back-navigation rules remain unchanged.

## PWA cache

Installed Investor PWAs use `v0.34.5-reconcile1` cache identities so the reconciled shell/navigation and new workflows refresh cleanly.
