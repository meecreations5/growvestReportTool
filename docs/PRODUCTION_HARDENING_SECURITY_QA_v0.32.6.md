# GrowVest v0.32.6 — Production Hardening, Security Audit & Final QA

## Purpose

v0.32.6 is a hardening release. It does not add a new business module. It tightens security boundaries, adds release checks, reduces import/report delivery risk, and defines the acceptance gate for the v1.0.0 Release Candidate.

## Security changes

### Firebase authentication and App Check

- Server APIs now verify Firebase ID tokens with revocation checking.
- Authenticated API routes preserve typed 401/403 responses instead of converting expired/forbidden sessions into generic 500 errors.
- Inactive or missing GrowVest user profiles remain blocked.
- Optional server-side Firebase App Check enforcement is available with `FIREBASE_APP_CHECK_ENFORCE_SERVER=true`.
- Custom authenticated browser API clients now attach an App Check token when App Check is configured.
- Keep App Check enforcement **off** until the production App Check site key is deployed and the main Admin, Advisor and Investor flows have been smoke-tested.

### Firestore access hardening

- Advisor updates to Investor records cannot change assignment, portal, identity, PAN/Aadhaar metadata or delete-state security fields.
- Historical `createdByUid` is no longer a read authority for Advisor access. Existing collection/list reads continue to use persisted `advisorUid` / `assignedAdvisorUid` ownership fields so Firestore queries remain rule-compatible.
- Advisor client writes that reference an Investor/Lead are constrained to that Advisor's current assigned book, including atomic lead/investor creation flows.
- When an Investor/Lead is reassigned, production operations should backfill persisted ownership fields on related historical records if immediate read-access revocation for the former Advisor is required.
- Advisor writes to servicing collections preserve the original investor/advisor/lead scope.
- `publicSettings/branding` remains public-readable, but future `publicSettings/*` documents are private by default.
- `investorKycSecure` remains browser-inaccessible.
- No blanket `request.auth != null` read/write rule is introduced.

### Notification privacy

- Notifications are readable only by their explicit `recipientUid`; `investorId` is context only and is never an alternate read authority.
- This prevents internal Advisor notifications that mention an Investor from appearing in that Investor's notification centre.
- Advisor-created browser notifications are limited to the Advisor themself, active staff, or the portal UID of an Investor currently assigned to that Advisor.

### Investor document Storage ownership

Investor document uploads must now include path/uploader metadata. Investors may upload to their own document path, but they cannot overwrite or delete a document uploaded by staff. Staff access remains constrained by the Investor access model.

### PAN and Aadhaar protection

- Full Aadhaar remains server-only and AES-256-GCM encrypted.
- `KYC_FIELD_ENCRYPTION_KEY` must now be at least 32 characters and not a common placeholder.
- Aadhaar duplicate detection uses an HMAC-SHA256 lookup hash, not plaintext Aadhaar.
- Only masked Aadhaar metadata is exposed in the normal Investor profile.
- PAN remains available for operational investor matching.

**Production key note:** Set the final production KYC encryption key **before storing real Aadhaar data**. Changing the key later requires a controlled re-encryption migration. A key that has been shared in chat, source control or logs should not be used as the production key.

### Monthly Report email privacy

- Non-test Monthly Reports can only be sent to the verified Investor email stored on the report.
- Client-supplied `recipientEmail` cannot redirect a report to another primary recipient.
- CC/BCC is limited to active GrowVest staff, report-approved recipients, or server-configured approved emails/domains.
- A supplied `deliveryId` must belong to the same Monthly Report; Advisors cannot reuse another Advisor's delivery record.
- `NEXT_PUBLIC_APP_URL` is required for production report email links.

Use these optional server controls when needed:

```env
REPORT_DELIVERY_ALLOWED_EMAILS=
REPORT_DELIVERY_ALLOWED_DOMAINS=
```

### PDF remote-image protection

Report/MOM PDF branding images now use a restricted loader:

- HTTPS only
- standard HTTPS port only
- no embedded URL credentials
- DNS resolution checked for private/reserved destinations
- redirect destinations revalidated
- maximum 3 redirects
- request timeout
- maximum 5 MB
- PNG/JPEG only

This reduces SSRF and remote-resource exhaustion risk from configurable branding URLs.

### Cron and webhook hardening

- `CRON_SECRET` and `BREVO_WEBHOOK_TOKEN` must be at least 32 characters.
- Meeting reminders use a short-lived Firestore transaction claim before sending, reducing duplicate reminders during concurrent cron execution.
- Brevo webhook requests larger than 1 MB are rejected and only selected/truncated provider fields are retained.

Generate independent random secrets per environment, for example:

```bash
openssl rand -hex 32
```

Do not reuse the KYC encryption key as a cron/webhook secret.

## Security/response headers

The Next.js configuration now applies additional browser security headers and no-cache headers to API responses. A strict Content Security Policy is intentionally not enabled in this release because the application currently uses Next.js hydration and rich email/signature HTML that require a separate CSP compatibility migration; enabling an untested CSP could break production UI flows.

## Release QA commands

```bash
npm run qa
npm run qa:env
npm run qa:env:strict
npm run lint
npm run build
```

`npm run release:check` runs the release audit, strict environment preflight, lint and production build in sequence.

The release audit checks source/package invariants including:

- no secrets/build artifacts bundled
- no unnecessary custom single-field Firestore indexes
- private-by-default settings/KYC rules
- investor document ownership controls
- revoked-token/App Check support
- report recipient restrictions
- PDF SSRF controls
- KYC strong-key/HMAC controls
- authentication/secret gate marker on every API route
- no server secret exposed through `NEXT_PUBLIC_*`

## Required production environment

Start from `.env.example`. Production must supply at least:

- Firebase Web SDK configuration
- `NEXT_PUBLIC_APP_URL` using HTTPS
- Firebase Admin credentials or Application Default Credentials
- `KYC_FIELD_ENCRYPTION_KEY` (32+ characters)
- `CRON_SECRET` (32+ characters)
- `BREVO_WEBHOOK_TOKEN` (32+ characters)
- email/Brevo credentials used by the deployment
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` before enabling server App Check enforcement

Never commit `.env` or `.env.local`.

## Firebase deployment

v0.32.6 changes Firestore and Storage rules. After reviewing the target Firebase project:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Deploy Cloud Functions separately only when the deployed function source/configuration also needs updating.

## Release Candidate UAT matrix

### Identity and role isolation

- [ ] Super Admin can access all authorised operational areas.
- [ ] Admin permissions match configured RBAC.
- [ ] Advisor can see only assigned Investors/records.
- [ ] Investor A cannot read Investor B portfolio, reports, actions, documents, meetings or goals.
- [ ] Disabled/inactive account is rejected by server APIs.
- [ ] Revoked Firebase session/token is rejected by server APIs.

### KYC

- [ ] Valid PAN saves and duplicate PAN protection behaves as expected.
- [ ] Aadhaar saves only with a strong server encryption key.
- [ ] Full Aadhaar is absent from the normal `investors` document and browser logs.
- [ ] Aadhaar displays masked in the UI.
- [ ] Duplicate Aadhaar is rejected by the secure server flow.

### Portfolio/import integrity

- [ ] Exact duplicate file is skipped.
- [ ] Fresh file updates the same holding identity rather than duplicating it.
- [ ] Goal/Bucket assignment persists across normal updates.
- [ ] Reprocess is idempotent.
- [ ] Wrong-Investor correction moves/rebuilds only the affected import state.
- [ ] Rollback preserves unrelated/newer portfolio data or blocks when unsafe.
- [ ] New holding, partial exit and full exit are represented without deleting history.
- [ ] Missing daily source does not zero the portfolio.
- [ ] Reconciliation flags valuation/ownership/source freshness exceptions.

### Monthly Reports

- [ ] Report selects the correct verified snapshot for the report/as-of date.
- [ ] Opening + fresh investment - withdrawals + movement reconciles to closing value where data is available.
- [ ] Goal/Bucket mapping and Investment Type/Mode are carried into the report.
- [ ] Blocked reconciliation state prevents trusted report completion.
- [ ] Published report/version remains frozen after later portfolio changes.
- [ ] Investor sees only completed + investor-visible reports.
- [ ] Report email primary recipient cannot be changed away from verified Investor email.
- [ ] Unapproved CC/BCC is rejected.

### Investor Actions / Meetings / Occasions

- [ ] Investor Actions remain Investor-scoped and Advisor-scoped.
- [ ] Investor decision updates appear in the Advisor timeline.
- [ ] Unresolved report actions carry forward; terminal actions do not.
- [ ] Meeting reminder concurrent execution does not send duplicate reminders.
- [ ] Birthday/occasion same-day and advance reminders are idempotent.
- [ ] No birthday message is auto-sent to an Investor in v0.32.6.

### Documents and Storage

- [ ] Investor can upload a document only to their own document record/path.
- [ ] Investor can delete their own uploaded file where allowed.
- [ ] Investor cannot delete/overwrite a staff-uploaded document.
- [ ] Investor cannot read another Investor's document.

### Responsive/UI

- [ ] Admin Daily Portfolio Update works on supported desktop widths.
- [ ] Investor Dashboard, Portfolio, Goals, Reports, Actions, Documents and Meetings work on mobile widths.
- [ ] No critical console Firebase permission errors appear in normal authorised flows.

## Backup and recovery before go-live

Before the Release Candidate is promoted:

1. Enable a managed Firestore backup/export process for the production project and document the retention owner/process.
2. Test restore/recovery in a non-production project where practical.
3. Preserve Portfolio Import recovery journals and daily portfolio snapshots.
4. Preserve published Monthly Report versions/PDF storage objects according to the business retention policy.
5. Document the production KYC key custodian and secure recovery process. Do not store the key in the database or source repository.

## Residual production sign-off dependencies

These are not blockers to source packaging, but they must be completed before relying on those adapters for real investor data:

- **Bajaj Broking:** validate the adapter against at least one real Holdings export and one real Trade Book/P&L export. The current adapter intentionally uses defensive aliases/test format because no actual Bajaj export was provided during development.
- **ULIP:** validate each insurer-specific export layout and confirm how that insurer represents fund switches/exits and whether its report is a complete fund snapshot.
- **Full dependency build:** run `npm ci`, `npm run lint` and `npm run build` in the actual CI/deployment environment with a valid npm registry.
- **Firebase emulator/runtime security tests:** source audits do not replace end-to-end rules tests against Firebase Emulator Suite or a staging project.
- **Advisor reassignment backfill:** collection/list permissions intentionally rely on persisted `advisorUid` / `assignedAdvisorUid` fields because Firestore rules are not filters. Reassignment workflows should update ownership fields on related records where immediate revocation is required.
- **Audit-log trust level:** staff-created activity logs are immutable after creation and constrained to the staff member's allowed scope, but some business flows still originate those logs from authenticated clients. If regulatory-grade non-repudiation is required, move all business mutations and audit-event creation behind trusted server APIs.

## v1.0.0 Release Candidate gate

Create v1.0.0 RC only when:

- `npm run release:check` passes in CI/staging;
- Firebase rules/indexes/storage rules deploy successfully;
- the UAT matrix above has no Critical/High unresolved issue;
- production secrets are unique, strong and stored in the deployment secret manager/environment;
- real provider formats intended for day-one production have been verified;
- backup/recovery ownership is documented.

No new business features should be added between v0.32.6 and the first v1.0.0 Release Candidate unless they resolve a release-blocking defect.
