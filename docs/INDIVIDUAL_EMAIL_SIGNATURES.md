# Individual Email Signatures

Application version: 0.21.0

## Purpose

Every GrowVest staff member can maintain an individual, responsive email signature while company branding remains centrally controlled through Branding Settings.

## Routes

- `/my-signature` — staff member manages their own draft and submits it for approval.
- `/users/[userId]/signature` — Super Admin/Admin manages a staff member's signature.
- `/users/[userId]/edit` — shows signature status and links to the editor.

## Signature modes

1. **Hybrid** — recommended. Uses uploaded handwritten-name artwork with responsive HTML contact details.
2. **Responsive HTML** — fully editable and accessible.
3. **Full image** — exact artwork fallback for special cases.

## Configurable fields

- Full name and display surname
- Investor-facing designation and department
- Brand positioning
- Official email and mobile
- Website and office address
- Handwritten-name artwork
- Full signature image
- Footer taglines
- Visibility controls for each signature element

Company logo, watermark, colours and legal identity are inherited from published Branding Settings.

## Approval workflow

1. Staff member or Admin edits the draft.
2. Draft autosaves privately.
3. Staff member submits it for approval.
4. Super Admin previews and publishes the signature or requests changes.
5. Each publication creates an immutable version under `users/{uid}/signatureVersions/{versionId}`.

Only the published signature is used in outgoing Investor communication.

## Email integration

Published signatures are automatically rendered in:

- Meeting emails and reminders
- MOM emails
- Monthly report delivery emails
- Scheduled report emails
- Report publication/resend emails

When an individual signature is disabled or unavailable, the company default signature from Branding Settings is used.

## Storage

Signature images are stored under:

`staff-signatures/{uid}/{assetType}/{fileName}`

Supported formats: PNG, JPG and WebP.

- Handwritten-name artwork: maximum 2 MB
- Full signature artwork: maximum 5 MB

## Test email

Use **Send test email** inside the signature editor. The test is sent to the currently signed-in staff email and may use the current draft before publication.

## Deployment

```powershell
firebase deploy --only firestore:rules,storage
npm install
npm run build
npm run dev
```

## Recommended test flow

1. Open `/my-signature`.
2. Select Hybrid mode.
3. Upload a transparent handwritten-name PNG.
4. Confirm personal details and visibility options.
5. Review Desktop and Mobile previews.
6. Send a test email.
7. Submit for approval.
8. Publish as Super Admin.
9. Send a meeting, MOM and monthly report email.
10. Confirm the published signature appears consistently.
