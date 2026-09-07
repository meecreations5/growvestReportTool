# GrowVest v0.33.5 - Investor Mobile App Experience & Design System

## Scope

v0.33.5 is a **phone-only Investor Portal experience**. The new app presentation is applied below the Tailwind `md` breakpoint (under 768px). Tablet and desktop staff/investor workflows retain their established layouts and business logic.

This release also hardens Investor App data access. It does not broaden Firestore browser permissions. Protected Investor data is read through authenticated server APIs using Firebase Admin after the logged-in Investor-to-profile relationship is verified.

## Dynamic Investor Dashboard

The Investor Home dashboard no longer treats the latest published Monthly Report or a cached Investor profile field as the source of the current portfolio value.

The current Home value is calculated from **active Portfolio Master positions** on every authenticated refresh. The same server summary also provides:

- Current portfolio value
- Current invested basis
- Current gain/loss
- Monthly SIP total
- Current holding count
- Latest valuation date
- Movement versus the previous verified portfolio snapshot
- Live Bucket List allocations and current goal corpus

ULIP current value continues to come from ULIP fund positions. Where policy premium-paid information is available, the dashboard invested basis uses the same ULIP premium logic as the Portfolio screen. Insurance protection cover is never added to portfolio corpus or AUM.

The dashboard refreshes when the screen opens, when the app returns to the foreground, when the browser/window regains focus, every 60 seconds while visible, and when the Investor taps the refresh control. API responses are private and `no-store`.

## Permission hardening

The Investor App now avoids protected browser Firestore list queries for core read experiences that were capable of producing `FirebaseError: Missing or insufficient permissions`.

Authenticated server paths now cover:

- Investor Home/profile/goals/security data
- Current Portfolio Master summary
- Published Monthly Reports and report detail
- Meetings and MOM visibility
- Investor-visible documents
- Notification centre and preferences
- Advisor Follow-up / Investor Actions and action timeline
- Investor withdrawal portfolio/action reads

The existing secure `/api/portfolio/investor-view`, Insurance APIs, SIP APIs, report PDF APIs and document streaming APIs remain in use.

## Phone-only design system

### App bar

On phones the website-style header is replaced with a compact app bar:

- Home: GrowVest branding, greeting, Notification bell and profile/avatar
- Internal screens: screen title, contextual back navigation when needed, Notification bell and profile/avatar

`InvestorPageHeader` is hidden below 768px so a second website-style page heading is not repeated underneath the app bar.

### Bottom navigation

The permanent Investor App navigation remains exactly:

**Home | Portfolio | Goals | Reports | More**

Notifications stay in the header bell. `More` opens a native-style bottom sheet on phones.

### More sheet

Phone `More` is grouped into app-style sections instead of a website menu:

- Planning & records: Insurance & Protection, Documents, Meetings & Reviews, SIP Reminders, GrowVest Actions
- My account: Profile, Login & Security, Notifications
- Appearance
- Install GrowVest Investor App
- Secure sign out

The pre-existing tablet `More` experience is retained separately.

### Home

Phone Home uses an app dashboard hierarchy:

1. Live wealth hero sourced from Portfolio Master
2. Invested amount and gain/loss
3. Quick actions
4. Next action / due item
5. Priority Bucket List progress
6. Protection snapshot
7. Review and GrowVest action shortcuts

### Monthly Report detail

On phones the large website-style Monthly Report header is replaced by a compact app summary showing report period, report code/version, acknowledgement status and previous/next report navigation. The established tablet/desktop header remains unchanged.

### Phone interaction rules

- Mobile design-system styles are scoped to `max-width: 767px`
- iPhone form controls remain at 16px minimum to prevent Safari auto-zoom
- Safe-area padding is respected for installed iOS/Android PWA use
- Bottom navigation remains thumb-friendly and fixed
- App cards use consistent rounded surfaces, compact spacing and touch targets

## Security model

This release intentionally does **not** relax Firestore rules to solve Investor Portal permission errors. The Investor's identity is verified server-side and only their linked Investor record is returned.

Notifications, reports, documents, meetings and actions are filtered for Investor visibility before being returned. Staff-only data remains inaccessible to the Investor App.

## UAT checklist

### Dynamic Home

1. Open Investor Home and note Portfolio Value.
2. Update/import Portfolio Master for the same Investor from the staff application.
3. Return to the Investor App or tap refresh.
4. Confirm Portfolio Value, holdings count, invested amount, gain/loss and goal corpus reflect current Portfolio Master.
5. Confirm published historical Monthly Reports remain unchanged.

### Permission regression

Test with an Investor login:

- Home
- Portfolio / Investments
- Portfolio / Protection
- Goals
- Reports list
- Report detail
- Report PDF download
- Documents
- Meetings
- SIP Reminders
- GrowVest Actions and action timeline
- Profile
- Notifications

No screen should emit `FirebaseError: Missing or insufficient permissions` merely from opening/read access.

### Mobile-only design

Check at 320px, 360px, 390px and 430px widths:

- App bar does not wrap
- Bottom navigation remains one row
- More opens as a bottom sheet
- Content scrolls fully above bottom navigation
- Report actions do not cover report content
- Inputs do not trigger iPhone zoom

Then check at 768px and desktop widths to confirm the established tablet/desktop layouts remain intact.

## Deployment note

The Investor PWA cache identity is bumped to **v0.33.5**. After deployment, installed PWAs should be allowed to update/reload so the new shell and secure Investor App routes are used.
