# Phase 2 Completion Update — Access Control and Lead Operations

This update completes the operational gaps identified after the original Phase 2 lead workflow.

## Users and roles

- Live staff user list instead of the placeholder screen.
- Super Admin can pre-authorise Microsoft accounts.
- Pending access is stored in `staffInvitations/{lowercaseEmail}`.
- On first Microsoft login, the Firebase UID is linked automatically and `users/{uid}` is created.
- Staff roles: Super Admin, Admin and Advisor.
- Advisor code and designation management.
- Activate/deactivate staff access.
- Last-login metadata.
- User access actions are written to `activityLogs`.

## Lead operations

- Lead edit route: `/leads/[leadId]/edit`.
- Active Advisor dropdown sourced from Firestore.
- Admin/Super Admin lead reassignment.
- Reassignment is written to the lead activity timeline.
- Follow-up and assessment ownership moves to the newly assigned Advisor.
- Lead archive and restore controls.
- Active/archived lead list toggle for Admin and Super Admin.
- Conversion status cannot be selected manually until an investor record is linked.
- Closure/lapse reason is required for dropped, not-qualified and lapse statuses.

## Profile display

The application now resolves the displayed user name from:

1. `users/{uid}.fullName`
2. legacy `name` or `displayName`
3. Microsoft display name
4. `GrowVest User`

## Required Firebase deployment

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Microsoft staff onboarding

1. Super Admin opens `/users/create`.
2. Enter the exact lowercase Microsoft organisational email.
3. Assign role, designation and Advisor code where applicable.
4. User signs in at `/staff-login`.
5. The pending invitation is linked automatically to the Firebase UID.

There is no public registration and no staff password stored in the application.
