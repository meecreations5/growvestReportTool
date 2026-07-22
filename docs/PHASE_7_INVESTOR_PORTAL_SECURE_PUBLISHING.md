# Phase 7 — Investor Portal and Secure Publishing

## Delivered

- Enhanced Investor Dashboard with latest portfolio value, active Bucket List goals, next review, latest client-visible MOM, Advisor details and unread notifications.
- Published report centre with search, year filter, published version and secure download counts.
- Immutable published report snapshots in `reportVersions`.
- Working-report edits no longer change what the Investor sees until a new version is published.
- Server-generated branded PDF using `pdf-lib`.
- PDF upload to Firebase Storage through the Admin SDK.
- Authenticated PDF downloads for staff and the linked Investor only.
- Download audit history in `reportDownloads` and counters on the report.
- Published version history for staff, with download access to superseded PDFs.
- Report acknowledgement and discussion-request workflow.
- Controlled Investor Portal access management from the Investor Profile, supporting username/password, mobile OTP, both methods, password reset and account disable.
- Secure Investor Document Centre for staff requests, Investor uploads, verification/rejection, in-app notifications and authenticated Storage access.
- Advisor in-app notification when an Investor acknowledges a report or requests a discussion.
- Investor report previous/next navigation.
- Publication workflow now generates the PDF, snapshots the version, sends the portal notification and sends the Brevo email in one operation.

## New collections

- `reportVersions`
- `reportAcknowledgements`
- `reportDownloads`
- `investorDocuments`

## New API routes

- `POST /api/reports/[reportId]/publish`
- `POST /api/reports/[reportId]/generate-pdf`
- `GET /api/reports/[reportId]/pdf`
- `POST /api/reports/[reportId]/acknowledge`
- `POST /api/investors/[investorId]/portal-access`
- `POST /api/investor-documents/[documentId]/uploaded`

All API calls require a Firebase ID token. The PDF endpoint verifies role, ownership and report publication visibility before returning bytes.

## Environment

Add the Admin Storage bucket if it is not already present:

```env
FIREBASE_ADMIN_STORAGE_BUCKET=growvest-reporttool.firebasestorage.app
```

The Firebase Admin credentials and Brevo settings from Phase 4 are still required.

## Setup

```bash
npm install
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
npm run build
npm run dev
```

The new dependency is:

```text
pdf-lib
```

## Test flow

1. Complete a monthly report.
2. Open the report detail page.
3. Click **Publish, PDF & Email**.
4. Confirm a document is created in `reportVersions`.
5. Confirm a PDF file appears in Firebase Storage under `monthly-reports/...`.
6. Log in as the linked Investor.
7. Open the report and download its secure PDF.
8. Acknowledge the report.
9. Request a discussion and confirm the assigned Advisor receives an in-app notification.
10. Edit the staff working report. Confirm the Investor still sees the previous published snapshot.
11. Complete the changes and click **Publish Revision**.
12. Confirm a new version and PDF are created while the previous version remains available to staff.

## Security behaviour

- Investors can read only their active published report version.
- Draft and working revision data remain staff-only.
- Superseded versions are available to authorised staff but not the Investor.
- PDF files are private in Storage and are streamed only through the authenticated API.
- Downloads are logged with user, role, report version and timestamp.
