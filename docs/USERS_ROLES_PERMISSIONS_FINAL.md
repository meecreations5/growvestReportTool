# Users, Roles & Permissions — Final UI

## Route

- `/users`
- `/users/create`
- `/users/[userId]/edit`

## Purpose

The module provides controlled identity and access management for GrowVest staff and visibility into Investor Portal access. Public staff self-registration remains disabled. Staff access is created only through exact Microsoft email authorisation by a Super Admin.

## Main workspace

The Users, Roles & Permissions page contains four sections:

1. **Staff Access** — linked staff profiles and pending Microsoft authorisations.
2. **Investor Access** — Investor Portal status, login methods and assigned Advisor.
3. **Permission Matrix** — effective module access for Super Admin, Admin, Advisor and Investor.
4. **Access Activity** — audit history for invitations, role changes and access-status changes.

## Staff access controls

Super Admin can:

- Authorise a Microsoft organisational email.
- Assign Super Admin, Admin or Advisor role.
- Configure Advisor code and email signature.
- Activate or deactivate linked staff access.
- Cancel pending authorisations.
- Review last login and authentication state.

Admin can view staff access, Investor access, permissions and audit history but cannot modify staff roles or status.

## Security safeguards

- A user cannot deactivate their own account.
- A user cannot change their own role.
- The system prevents removal of the final active Super Admin.
- Deactivation preserves reports, meetings, activity logs and audit history.
- Advisors remain restricted to assigned records.
- Investors remain restricted to their own records.

## Investor access

The Investor Access tab shows:

- Investor name and client code.
- Contact details.
- Assigned Advisor.
- Portal enabled/disabled status.
- Configured login methods such as Password, Mobile OTP and Google.
- Last portal update.
- Link to the Investor profile for detailed access configuration.

## Permission matrix

The permission matrix reflects the effective application and Firestore access model. It is intentionally system-controlled rather than user-editable, so UI labels cannot drift from enforced security rules.

Access levels:

- Full access
- Manage
- Assigned only
- View / select
- Own records
- No access

## Audit activity

The module reads user-related events from `activityLogs`, including:

- Staff access authorised
- Authorisation cancelled
- Staff role changed
- Staff access activated
- Staff access deactivated
- Staff identity or Advisor details updated

## Files updated

- `src/app/(portal)/users/page.js`
- `src/app/(portal)/users/create/page.js`
- `src/app/(portal)/users/[userId]/edit/page.js`
- `src/components/users/UsersAccessCentre.js`
- `src/components/users/UserForm.js`
- `src/lib/constants/permissions.js`
- `src/lib/constants/navigation.js`
- `src/services/userService.js`
- `package.json`

## Deployment

No new Firestore collection, rule or index is required.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

## Recommended test flow

1. Open `/users` as Super Admin.
2. Review Staff Access metrics and filters.
3. Authorise a new Advisor Microsoft email.
4. Sign in once with that Microsoft account and confirm it changes from Pending to Active.
5. Edit the Advisor role details and email signature.
6. Deactivate and reactivate a non-current staff user.
7. Confirm the activity appears in Access Activity.
8. Verify the final active Super Admin cannot be deactivated or demoted.
9. Open the same page as Admin and confirm it is view-only.
10. Review Investor Access and open an Investor profile.
11. Test the page at 390px, 768px, 1280px and 1440px.
