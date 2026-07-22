# Phase 7 Branding and Investor Authentication Fix

This update closes the branding and multi-provider Investor authentication gaps identified during Phase 7 testing.

## Included fixes

### Dynamic branding assets

Settings now supports uploading and managing:

- App icon / square logo
- Primary / wide logo
- Email header logo
- Report watermark

Branding values are saved to:

- `reportSettings/global` for authenticated operational settings
- `publicSettings/branding` for public login-page branding

Uploaded assets are stored under `branding/*` in Firebase Storage.

The dynamic branding is used by:

- Staff sidebar and responsive header
- Staff login
- Investor login
- Investor Portal header
- Monthly web report
- A4 print report
- Server-generated PDF
- MOM print view
- Client Assessment proposal summary
- Brevo meeting, MOM and monthly-report emails
- Dynamic browser favicon

Company name, legal name, tagline, contact details, colours, email footer and the default email signature are also configurable.

### Advisor email signatures

Advisor user records now support:

- `signatureEnabled`
- `emailSignatureHtml`

Email signature priority:

1. Advisor-specific signature
2. Company default signature from Branding Settings
3. Generated Advisor name, designation and company signature

### One Investor, one Firebase UID

The canonical Investor account can hold:

- Username and password
- Mobile OTP
- Google login

Google is linked to the canonical account from:

`Investor Portal -> Login & Security -> Link Google Account`

The Portal Access update detects an existing Google-only duplicate account for the same Investor, deletes that duplicate Firebase Authentication user, and preserves the canonical username/mobile UID.

### Password change fix

The Login & Security page is now provider-aware:

- Username/password session: asks for the current password and reauthenticates
- Recent Phone or Google session: updates the password without asking for an unrelated password
- Account without password provider: links username/password credentials to the current canonical UID

This prevents the previous generic `auth/invalid-credential` failure for Phone or Google sessions.

### Mobile OTP diagnostics

Phone errors now distinguish between:

- Provider not enabled
- Wrong Firebase project configuration
- Invalid or missing app credential
- reCAPTCHA failure
- Invalid phone number
- SMS quota exceeded
- Too many requests
- Invalid or expired OTP

## Required deployment

Copy the existing `.env.local` into this project. Do not put Firebase Admin or Brevo secrets into client-side `NEXT_PUBLIC_*` variables.

Run:

```powershell
npm install
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
npm run build
npm run dev
```

## Initial branding setup

1. Sign in as Super Admin or Admin.
2. Open `Settings -> Branding`.
3. Upload the square icon, wide logo, email logo and watermark.
4. Enter company name, legal name, tagline, contact details and email signature.
5. Select `Save Settings`.
6. Open the Staff and Investor login pages in a private browser window and confirm the public branding.

Saving once creates `publicSettings/branding`, which is required for unauthenticated login pages.

## Duplicate Investor account migration

Use the Phone + Username/Password user as the canonical account where it already contains the Investor mapping.

1. Open the Investor Profile as staff.
2. Open `Portal Access`.
3. Enable Username/Password, Mobile OTP and Google.
4. Confirm the username, registered mobile and authorised Google email.
5. Select `Update Portal Access`.
6. The server removes a duplicate Google-only Firebase user only when it belongs to the same Investor.
7. Ask the Investor to sign in using Username/Password or Mobile OTP.
8. Open `Login & Security`.
9. Select `Link Google Account` and choose the authorised Google email.
10. Firebase Authentication should then show one UID with Password, Phone and Google providers.

Before deleting or merging any duplicate account, confirm that no Investor, report, notification or document points to the duplicate UID.

## Mobile OTP checklist

Confirm:

- Firebase Authentication -> Sign-in method -> Phone is Enabled
- `.env.local` uses `growvest-reporttool`
- The current hostname is listed in Firebase Authentication authorised domains
- reCAPTCHA is not blocked by browser privacy extensions
- The mobile number is in E.164 format, such as `+919876543210`
- The development server was restarted after environment changes

## Test matrix

### Branding

- Upload icon and confirm sidebar, mobile header and favicon
- Upload wide logo and confirm login pages and portal header
- Upload email logo and send Brevo test/meeting/report email
- Upload watermark and confirm HTML report, PDF, MOM and assessment print
- Change tagline and confirm login, report, email and footer content

### Investor authentication

- Username/password login
- Mobile OTP login
- Google linking from canonical account
- Google login after linking
- Password change from password session
- Password change from phone session
- Password change from Google session
- Disable portal and confirm every method is denied
- Re-enable portal and confirm access returns

### Security

- Google email authorised for another Investor must be rejected
- Duplicate Google user for another Investor must never be deleted
- Investor cannot update role, status or Investor ID
- Only Admin/Super Admin can upload or remove branding assets

## Verification status

Source parsing, local import resolution, named-export validation, JSON validation, Firestore/Storage rule brace validation and ZIP integrity were checked in the supplied environment.

The package installation did not finish within the available execution window, so `npm run build` must be executed locally before production deployment.
