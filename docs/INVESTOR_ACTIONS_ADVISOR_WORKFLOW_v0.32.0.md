# GrowVest v0.32.0 — Investor Action Requests & Advisor Workflow

## Purpose

v0.32.0 introduces one central workflow for investor requests, Advisor recommendations, monthly-report next steps and meeting/MOM actions. It is intentionally a tracking and consent workflow only; it does not place, redeem, switch or execute investments automatically.

## New workflow collections

### `investorActions`
Stores the current state of an action/request, including:

- investor and assigned Advisor
- action/request type
- title and description
- status and priority
- owner
- investor decision
- due/completion dates
- related Goal/Bucket List and investment IDs
- source monthly report / MOM references
- Investor Portal visibility
- audit/update metadata

### `investorActionEvents`
Append-only workflow timeline entries created by authenticated server API routes. Browser clients cannot create/update/delete these records.

## Supported status lifecycle

- Requested
- Recommended
- Under Review
- Discussion Required
- Approved
- In Progress
- Completed
- Deferred
- Rejected
- Cancelled

Completed, Rejected and Cancelled are treated as terminal for carry-forward logic. Deferred remains open so it can be revisited in a later review/report.

## Investor Portal

A new **Actions** page is available at `/investor/actions`.

Investors can:

- create a request
- link it to an investment or Goal/Bucket List
- request a discussion
- approve/defer/reject Advisor recommendations when a decision is requested
- add comments
- view status, owner, due date, source and audit timeline

Portfolio holdings now include **Discuss with Advisor**, and Goal/Bucket List cards include **Discuss goal** shortcuts that prefill the action request.

The UI explicitly states that requests/approvals do not execute financial transactions.

## Staff / Advisor workspace

A new **Investor Actions** workspace is available at `/actions`.

Admin/Super Admin can manage all actions. Advisors see only assigned-investor actions. Staff can:

- create an action for an investor
- filter open, overdue, awaiting-decision, completed or all actions
- update status, priority, owner, investor decision and due/completion dates
- add Advisor response/update text
- view the action audit timeline

The Investor detail page also includes an **Actions** tab with the investor's open-action count and recent actions.

## Monthly Report integration

When a non-autosave Monthly Report is saved/completed, `nextSteps` are synced into the central action workflow.

- Report-created actions remain internal while the report is a draft.
- Publishing the report makes linked actions visible in the Investor Portal.
- Existing central workflow status/decision is preserved when a report is saved again.
- Unresolved central actions are automatically carried into a newly created future Monthly Report for the investor.
- Completed, Rejected and Cancelled actions are not carried forward.

This preserves the frozen published report while allowing the live operational workflow to continue independently.

## Meeting / MOM integration

MOM action items are synced into `investorActions` after MOM create/update. Existing workflow state is preserved, with terminal MOM states reflected centrally. Client-visible MOM items can be shown in the Investor Portal when the MOM itself is Investor-visible.

## Monthly report discussion

When an investor acknowledges a published report and requests a discussion, GrowVest creates (or reuses) a central `Monthly Report Discussion` action and notifies the Advisor. Repeated discussion requests for the same still-open report action do not create duplicates.

## Security model

- Browser writes to `investorActions` and `investorActionEvents` are denied by Firestore rules.
- All workflow writes go through authenticated server API routes.
- Admin/Super Admin can read all actions.
- Advisors can read only actions assigned to them.
- Investors can read only their own actions/events when `investorVisible == true`.
- Internal report-draft actions stay hidden until publication.
- Event visibility follows the parent action visibility on subsequent updates.

## Deployment

Deploy the new Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Then clear the Next.js development cache and restart:

```bash
rm -rf .next
npm run dev
```

## Recommended acceptance test

1. Admin/Advisor opens **Investor Actions** and creates an action for a test investor.
2. Investor opens **Actions** and confirms the action is visible.
3. Investor chooses Approve/Defer/Reject on an Advisor recommendation and adds a comment.
4. Staff confirms status/decision/timeline/notification updates.
5. Investor uses **Discuss with Advisor** from a portfolio holding.
6. Investor uses **Discuss goal** from a Goal/Bucket List card.
7. Create a Monthly Report with a next-step recommendation; confirm the action syncs but stays hidden while draft.
8. Publish the report; confirm the linked action becomes Investor-visible.
9. Create the next month's report; confirm unresolved central actions are carried forward.
10. Complete one central action, create another future report, and confirm the completed action is no longer carried forward.
11. Create/update a MOM with an action item and confirm it appears in the central action workspace.
12. As an investor, request a discussion while acknowledging a published report; confirm a central report-discussion action is created and Advisor notification links to `/actions`.

## Important boundary

This workflow records requests, recommendations, decisions, follow-up and completion. It must not be treated as trade execution, redemption execution, switching, mandate modification or payment authorization. Those remain external/compliance-controlled processes with appropriate consent and documentation.
