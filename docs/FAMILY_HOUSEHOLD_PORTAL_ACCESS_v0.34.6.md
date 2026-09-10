# GrowVest v0.34.6 — Family & Household Portal Access

## Purpose

GrowVest Investor Portal authentication is now separated from Investor ownership. One authenticated household access account can be explicitly authorised for one or more Investor profiles without assuming that matching email/mobile details alone grant access.

## Security model

- Firebase Authentication identifies the login account (`uid`).
- `users/{uid}` keeps the primary Investor plus the authorised Investor ID list.
- `investorAccessMemberships/{uid}__{investorId}` is the server-side household membership authority.
- Every additional family profile is explicitly granted by GrowVest staff.
- The client sends the selected Investor context in `X-GrowVest-Investor-Id`.
- Server APIs validate that context against the household membership before replacing `actor.investorId`.
- Each authorised Investor record keeps the same shared `portalUid`, so existing Firestore ownership rules continue to protect direct client reads.

## Login behaviour

- One authorised profile: login opens the Investor App directly.
- Multiple authorised profiles: login opens **Who would you like to view?**.
- Selecting a profile persists the active Investor context for the session/device.
- The Home avatar and GrowVest action menu provide **Switch investor** without another OTP.
- Logout clears the selected Investor context.

## Admin / Advisor workflow

Investor > Portal Access now supports explicit **Family Access**.

If a mobile number or authorised Google email is already linked to another Investor login, GrowVest does not auto-expose the second Investor. Staff must enable:

> Link to an existing family login if this mobile/email is already in use

and select the relationship (Spouse, Child, Parent, Sibling, Family Member or Other).

The same Firebase account is then linked to the additional Investor through an active membership document.

## Shared credential rules

- A mobile number can belong to only one Firebase Auth user, so family sharing reuses that canonical user.
- A shared household account has one username/password credential. Additional family profiles cannot create a second username/password on the same Firebase UID.
- A shared Google email can be attached to the same canonical household access account.

## Disable behaviour

Disabling one Investor no longer automatically disables the entire Firebase user when other household profiles remain authorised. Only that membership is removed. The login is disabled only when no active Investor profiles remain.

## Notifications and switching

- In-app notifications are filtered to the currently selected Investor when they carry an Investor ID.
- Push payloads now include `investorId`.
- Clicking a push can deep-link to the correct authorised Investor context before loading Portfolio/Report data.

## Backward compatibility

Existing single-Investor portal accounts continue to work without migration. The primary `investorId` remains valid even when no household membership document exists. A membership is created automatically the next time Portal Access is updated or Family Access is linked.
