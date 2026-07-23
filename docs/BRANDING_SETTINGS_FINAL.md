# GrowVest Branding Settings — Final Implementation

## Route

`/settings`

The Settings workspace now has three top-level areas:

1. Branding
2. System Configuration
3. Email Diagnostics

Branding is the default tab.

## Branding workflow

Branding changes use a draft-and-publish workflow:

- Draft changes autosave to `reportSettings/global.brandingDraft`.
- Draft changes do not affect the live application.
- Publish Branding copies the approved draft to:
  - `reportSettings/global.branding`
  - `publicSettings/branding`
- Every publish creates an immutable record in `brandingVersions`.
- Previous versions can be restored into the draft and reviewed before republishing.

## Branding sections

### Brand identity

- Display name
- Legal company name
- Application tagline
- Brand positioning
- Document footer tagline
- Website
- Support email
- Support mobile
- Office address

### Logo and assets

- App icon / square mark
- Primary wide logo
- White / inverse logo
- Email header logo
- PDF header logo
- PDF footer symbol
- Report watermark
- Report cover background

Uploads support PNG, JPG and WebP up to 5 MB.

Removing an asset clears the draft URL but does not delete the Storage object. Published branding versions and historical reports may still reference old files.

### Colours and typography

The approved GrowVest defaults are:

- Royal Trust Blue: `#1F4ED8`
- Growth Cyan: `#20B8CD`
- Deep Premium Black: `#0B0B0F`
- Strategic Red: `#E53935`
- Insight Yellow: `#F5B301`
- Soft Gray: `#F4F6F9`
- Medium Gray: `#6B7280`
- White: `#FFFFFF`

Typography remains centrally locked:

- Headings: League Spartan
- Body and interface: Open Sauce One

### Reports and PDF

- Confidential label
- PDF filename pattern
- Footer tagline
- Watermark opacity
- Page-number visibility
- Footer contact visibility
- Footer tagline visibility
- Confidential-label visibility

Supported PDF filename tokens:

- `{InvestorName}`
- `{Month}`
- `{Year}`
- `{ClientCode}`
- `{ReportCode}`
- `{Version}`

### Email branding

- Email header logo
- Default email signature
- Email footer/legal text

Sender name, verified sender email and reply-to address remain under System Configuration → Communications.

## Live previews

The Branding workspace includes previews for:

- Application shell
- Staff Login
- Investor Login
- Email
- HTML report
- A4 PDF

Previews use the current draft. Live outputs update only after publishing.

## Output integration

Published branding controls:

- CSS design tokens used by the application
- Dynamic favicon and browser title
- Staff and Investor login identity
- Brevo transactional email header/footer
- HTML report cover, watermark and confidentiality label
- Printable report PDF header, footer, watermark and cover background
- Server-generated PDF logo, footer symbol, filename and watermark opacity

## Firestore additions

### Existing documents

- `reportSettings/global`
- `publicSettings/branding`

### New collection

- `brandingVersions/{versionId}`

No composite Firestore index is required.

## Firebase deployment

```powershell
firebase deploy --only firestore:rules,storage
```

Storage rules now allow PNG, JPG and WebP branding assets.

## Local verification

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

Open:

`http://localhost:3000/settings`

## Recommended test flow

1. Open Settings → Branding.
2. Change the company tagline.
3. Confirm Autosave pending → Saving draft → All draft changes saved.
4. Refresh the page and confirm the draft remains.
5. Verify that the live sidebar and login pages have not changed.
6. Review Application, Staff Login, Email, HTML Report and A4 PDF previews.
7. Publish Branding.
8. Confirm the sidebar/logo/colours update.
9. Generate a fresh monthly-report PDF and confirm the PDF logo, footer, watermark opacity and filename.
10. Open Version History, restore an older version to the draft and confirm the live branding remains unchanged until republished.

## Version

Application version: `0.19.0`
