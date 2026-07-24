# Version 0.27.0 - MOM Communication, PDF Consistency and Firebase Security Audit

## 1. MOM WhatsApp signature

The MOM WhatsApp action now resolves the assigned Advisor's published signature on the server before opening WhatsApp.

Resolution order:

1. Assigned Advisor published signature
2. Assigned Advisor profile details with published GrowVest signature branding
3. Minimal Advisor and GrowVest fallback

The message uses the same central signature data as email communication, including designation, brand positioning, email, mobile, website, office address and configured social profiles according to the signature visibility settings.

Route:

```text
POST /api/communications/mom/whatsapp
```

The route verifies the signed-in staff member, confirms access to the MOM and returns the prepared mobile number and message. WhatsApp remains manual click-to-chat; the Advisor must press Send.

## 2. MOM PDF consistency

The old browser-print path has been replaced by a dedicated server-generated A4 PDF.

Route:

```text
GET /api/mom/{momId}/pdf
```

The PDF now uses the shared GrowVest document chrome used by generated reports:

- Published PDF logo
- Published footer symbol
- Published watermark and opacity
- Primary and secondary brand colours
- Legal entity and footer tagline
- Client code, confidentiality and page numbers
- A4 layout with controlled wrapping and pagination
- Continuation headings for decisions and action items
- Visibility labels for Investor-facing and internal content
- Download audit entry in `activityLogs`

The browser screen remains the operational view. The downloaded PDF is the controlled document output.

## 3. Firebase security audit - changes applied

### Critical rule hardening

- Advisors can no longer change relationship keys on MOM records, including the Advisor, Investor, meeting, creator and MOM code.
- Advisors can no longer change relationship keys on monthly reports, including the Advisor, Investor, portal UID, creator and report code.
- Investors can upload requested document files but can no longer set verification notes or mark their own document as verified.
- `reportSettings/global` is now staff-only. Investors continue receiving published branding from `publicSettings/branding`.
- Firebase Storage Investor documents are no longer readable by every staff user. Advisors must be assigned to the Investor; Admin and Super Admin retain permitted access.

### Server endpoint hardening

- Cron and Brevo webhook secrets now use constant-time comparison.
- Baseline response-security headers were added through `next.config.mjs`.
- Firebase App Check support was added for reCAPTCHA Enterprise and is enabled only when the site key is configured.

## 4. Audit scope and remaining controls

This release contains a static application, API-route, Firestore Rules and Storage Rules review. It is not a penetration test, compliance certification or independent infrastructure assessment.

### Resolved in this release

| Priority | Finding | Resolution |
| --- | --- | --- |
| High | Advisors could potentially change relationship keys while updating MOM/report documents | Advisor updates now preserve ownership, Investor, meeting, creator and reference fields |
| High | Investor document Storage access was broader than the assigned-Advisor relationship | Storage checks the Investor record before allowing Advisor access |
| High | Investors could submit verification-related fields while uploading requested documents | Verification fields are now staff-controlled |
| Medium | Internal report settings were readable by all active account types | `reportSettings` is now staff-only; public branding remains in `publicSettings` |
| Medium | Cron and webhook secrets used ordinary string comparison | Server endpoints now use constant-time comparison |
| Medium | No baseline browser response-security headers | Security headers and disabled framework identification were added |

### Required operational controls

1. Register and monitor Firebase App Check, then enforce it for Firestore and Storage.
2. Run authenticated and unauthenticated Rules Simulator tests before and after deployment.
3. Keep Firebase Admin, Brevo, webhook and cron secrets in a managed secret store and rotate them periodically.
4. Review Google Cloud IAM because Firebase Admin/server libraries bypass Firestore Security Rules.
5. Enable Google Cloud/Firebase audit logging appropriate to the production plan and retain security-relevant logs.
6. Enable backup/PITR or scheduled exports according to the business recovery requirement.

### Recommended next hardening pass

- Require MFA for Super Admin and Admin accounts.
- Add App Check token verification to custom Next.js API endpoints, not only direct Firebase SDK requests.
- Add server-side rate limiting for authentication-adjacent and communication endpoints.
- Add malware scanning/quarantine for uploaded Investor documents before staff download.
- Introduce a Content-Security-Policy in report-only mode, validate Google/Microsoft/Firebase/Brevo asset sources, and then enforce it.
- Add automated Firebase Rules tests to CI so role boundaries are regression-tested on every release.

## 5. Required Firebase console actions

### Deploy rules

```bash
firebase deploy --only firestore:rules,storage
```

### Configure App Check

1. Open Firebase Console -> App Check.
2. Register the production web application.
3. Use a reCAPTCHA Enterprise website key for `insights.growvest.info`.
4. Add the site key as `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.
5. Deploy the application.
6. Monitor App Check metrics before enforcement.
7. Enable enforcement for Cloud Firestore and Cloud Storage after confirming legitimate traffic is accepted.

Do not enable `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG` in production.

## 6. Data encryption decision

### Already provided by Firebase and Google Cloud

Cloud Firestore and Cloud Storage data are encrypted at rest by Google-managed encryption. Traffic between the application and Firebase uses TLS. No application change is required for standard portfolio, report, meeting, MOM, notification and document data.

### Field-level encryption is not required for current fields

Current application fields include names, email, mobile, city, portfolio values, goals, liabilities, meeting notes and uploaded documents. Encrypting searchable and reportable fields such as Investor name, report values or goal values at application level would prevent normal Firestore queries, sorting, filtering and reporting.

### Add field-level encryption only when storing highly sensitive identifiers

Use server-side field encryption before writing these future fields:

- PAN
- Aadhaar
- Passport number
- Bank account number
- IFSC-linked account details
- Demat or folio identifiers when full identifiers are stored
- Nominee identity details
- KYC reference numbers or unmasked identity data

Recommended design:

```text
Browser -> authenticated server API -> Cloud KMS encrypt -> Firestore ciphertext
```

Only the server should decrypt these fields. Encryption keys must never be placed in `NEXT_PUBLIC_*` variables, browser code, Firestore or public settings.

For display and search, store a masked value and, when exact matching is required, a separately keyed hash:

```text
panEncrypted     = encrypted ciphertext
panMasked        = ABCDE****F
panLookupHash    = HMAC(normalised PAN)
```

## 7. Secret storage

The following values must remain server-only and should be stored in the deployment platform's secret store or Google Secret Manager:

- `FIREBASE_ADMIN_PRIVATE_KEY`
- `BREVO_SMTP_PASSWORD`
- `BREVO_WEBHOOK_TOKEN`
- `CRON_SECRET`

Public Firebase web configuration values are identifiers, not server secrets. They still require App Check, Firebase Authentication and correct Security Rules.

## 8. UAT checklist

### MOM WhatsApp

- Open a completed MOM assigned to an Advisor with a published signature.
- Select Open WhatsApp.
- Confirm the message contains the client summary, visible action items and the assigned Advisor's signature.
- Test as Super Admin on another Advisor's MOM and confirm the assigned Advisor signature is used.

### MOM PDF

- Download a MOM containing long summaries, 10+ decisions and 10+ action items.
- Confirm no clipping, overlap or content crossing the footer.
- Confirm headers and footers appear on every page.
- Confirm internal and Investor-visible labels are correct.

### Security

- Confirm an Advisor cannot open another Advisor's Investor document.
- Confirm an Investor cannot write verification fields.
- Confirm an Investor cannot read `reportSettings/global`.
- Confirm App Check metrics show valid production requests before enabling enforcement.
