# GrowVest Investor & Monthly Report Tool

Standalone Next.js application for GrowVest lead management, investor onboarding, MOMs and manual monthly portfolio reporting.

## Current implementation

## Version 0.25.4 — Investor Mobile Sign-In UI Refinement

- Removed the white card/background behind the GrowVest logo on the mobile Investor sign-in hero
- Mobile hero now uses the published white/inverse transparent logo directly on the navy-to-blue background
- Reduced hero height so the sign-in form appears earlier in the first mobile viewport
- Reworked the mobile heading and supporting copy around secure portfolio access
- Simplified the primary method selector to Mobile OTP and Password
- Moved Google sign-in into a clear alternate sign-in action below the primary form
- Replaced the large security notice with a compact reassurance line
- Updated the Branding Investor Login preview to match the live mobile experience
- PWA cache version bumped so the updated login page replaces the previously cached shell

See `docs/INVESTOR_MOBILE_SIGNIN_UI_REFINEMENT.md` for deployment and UAT guidance.

## Version 0.25.3 — Report Template Persistence & Investor OTP Diagnostics

- Existing reports now save a newly selected report template immediately instead of relying only on delayed autosave
- Report-level template ID/version now override stale values inside older snapshots
- HTML and A4 preview components remount when the applied template changes
- Active templates with unpublished editor changes now show a clear warning
- Working PDF metadata is cleared and renderer metadata is updated to `2.1.0`
- Investor OTP errors now identify SMS region policy, authorised-domain and production Firebase-config checks
- PWA cache version bumped so deployed fixes replace the previous cached application shell

See `docs/REPORT_TEMPLATE_AND_OTP_FIX.md` for deployment and UAT guidance.

## Version 0.25.2 — Report Template Application & PDF Refresh Fix

- Changing the template while editing an existing report now applies the selected active template version to the working report snapshot
- Existing generated PDF metadata is invalidated whenever report content or the report template changes
- Staff PDF download now uses the current working report PDF instead of silently falling back to the older published version
- Investor PDF access continues to use the immutable active published version
- Template cards show active and applied version numbers, including an **Apply latest version** state
- Added **Save & preview report** from the report-template step
- HTML report covers now visibly reflect template cover style and template colours
- Working report and A4 preview display the applied template name and version
- Added a stale-PDF warning with a direct **Regenerate PDF** action
- Copy-next-month flows no longer carry old publication or PDF metadata into the new report

See `docs/REPORT_TEMPLATE_APPLICATION_FIX.md` for the corrected workflow and UAT checklist.

## Version 0.25.1 — Configurable PWA App Icon

- Dedicated **PWA / home-screen app icon** uploader in Settings → Branding → Logo & assets
- One upload automatically generates 192px, 512px and 180px Apple touch variants
- Optional Android maskable-icon upload with adaptive-crop guidance
- Published branding drives the live web app manifest, install prompt and home-screen icon
- App name, theme colour and background colour in the manifest follow published branding
- Existing application UI icon remains separate for favicon, sidebar and compact product identity
- Dynamic Apple touch icon and manifest cache-busting follow branding version updates

See `docs/PWA_BRANDING_ICON_SETTINGS.md` for deployment and UAT guidance.

## Version 0.25.0 — Investor PWA, Mobile App Shell & In-App Notifications

- Installable GrowVest Investor Progressive Web App with manifest, app icons and standalone display
- Root service worker with static-asset caching and a secure offline fallback
- No Firestore, API or financial-response caching
- Mobile app bar, five-item bottom navigation and app-style More sheet
- Dedicated `/investor/notifications` centre with All/Unread filters and read controls
- Live notification toast banners and unread badges in mobile and desktop navigation
- Per-device in-app and browser-alert preferences
- Install, offline and application-update prompts
- More prominent mobile Investor sign-in experience with Mobile OTP as the primary journey
- Existing Username/Password, Mobile OTP and Google authentication preserved
- Full closed-app web push remains a separate Firebase Cloud Messaging step

See `docs/PWA_INVESTOR_APP_AND_IN_APP_NOTIFICATIONS.md` for deployment and UAT guidance.

### Report Template Library

- New `/report-templates` module for staff
- Six built-in GrowVest template configurations
- Responsive Desktop, Mobile and A4 preview modes
- Template category, status, search and sorting filters
- Draft duplication and custom-template creation for Admin users
- Default-template control and archive/restore workflow for Super Admin
- Template sections, appearance, usage and version-history views
- New `reportTemplates` Firestore collection and role-aware security rules
- Existing published reports remain unchanged; Create Report integration follows after Library approval



### UI/UX Phase 3 — Assessment and Investor Workspace

- Guided assessment progress navigation with live section completion
- Mobile horizontal assessment navigator and desktop sticky step list
- Sticky mobile assessment save/complete actions
- Redesigned Investor list with mobile cards and portal/risk filters
- Investor profile hero, quick actions and role-friendly information hierarchy
- Tabbed Investor workspace for Overview, Bucket List, Portfolio, Assessment, Meetings, Reports and Access
- Responsive portfolio and liability cards on mobile
- Guided section-based Investor Profile editor
- Improved assessment history, suitability summary and financial snapshot

### Phase 2 lead workflow and completion update

- Live Users and Roles module with Microsoft pre-authorisation
- Automatic Firebase UID linking on first Microsoft sign-in
- Staff activate/deactivate, role, designation and Advisor-code management
- Lead editing, Advisor reassignment, archive and restore
- Role-aware staff dashboard
- Lead creation and lead list
- Lead details
- Status and next-action updates
- Follow-up capture and history
- Lead activity timeline
- SOP-based TAT indicators

### Authentication update

- Microsoft 365 login for Super Admin, Admin and Advisor
- Investor login through username/password, mobile OTP, or a pre-authorised Google account
- Four-role access validation
- Separate staff and investor route guards
- Investor portal starter pages
- Firestore rules for staff and investor data isolation




### Phase 7 gap closure

- Three-option Investor login: Username & Password, Mobile Login and Google Login
- Controlled Google email authorisation from Investor Portal Access
- Functional SOP 3 Client Servicing Master and 11-rule TAT workspace
- Query, monthly update, quarterly review, renewal, Addendum A and checklist logs
- Functional branding, report, communication, master and servicing settings
- Firestore index-building fallback for Investor monthly-report queries

### Phase 7 Investor Portal and secure publishing

- Enhanced Investor Dashboard with live report, goal, meeting, MOM and notification summaries
- Controlled Investor Portal account creation and login-method management
- Immutable published report versions separated from the staff working copy
- Server-generated branded PDF files stored privately in Firebase Storage
- Authenticated PDF downloads with download counts and audit history
- Published version history and secure superseded-version downloads for staff
- Investor report acknowledgement and discussion requests
- Secure Investor Document Centre with requests, uploads and verification
- Investor and Advisor in-app notifications for report and document events

### Phase 6 branded web report, A4 PDF and Investor publishing

- Interactive Monthly Wealth Progress Report matching the approved GrowVest dashboard design
- Portfolio headline, month-on-month movement and Bucket List progress
- Historical portfolio trend from completed monthly reports
- Monthly highlight cards and configurable Advisor insights
- Portfolio composition doughnut, target allocation health and variance
- Searchable/filterable Bucket List goal cards
- Asset allocation and fund-wise CSV exports
- Advisor-recommended actions and next-review calendar download
- Dedicated multi-page A4 layout with dynamic goal, allocation, holding, transaction, action and disclaimer pagination
- Browser print and secure server-generated PDF outputs use the same template snapshot, branding snapshot and shared report derivations
- Publish/unpublish control for the Investor Portal
- Investor in-app notification and Brevo publication email
- Manual WhatsApp click-to-chat for published reports
- Secure Investor Portal report detail and PDF preview routes

### Phase 5 manual monthly portfolio reports

- Monthly report dashboard, search, status and year filters
- Create reports directly from an Investor Profile
- Copy a previous report into the next reporting month
- Manual portfolio summary, holdings and Advisor note
- Multiple Bucket List goal updates and progress calculations
- Current versus target allocation and variance
- Fund-wise details linked to goals
- Next steps, ownership, due dates and next review
- Draft and completed report workflows
- Investor report history and structured data preview

### Phase 4 meetings, MOM and notifications

- Meetings linked to Leads or Investors
- Manual Teams, Google Meet, Zoom or custom link
- Brevo SMTP email invitations and `.ics` attachments
- Assigned Advisor and Investor notifications
- Manual WhatsApp click-to-chat with prefilled messages
- In-app notification centre for Staff and Investors
- Reschedule, cancel, complete and reminder workflows
- MOM, decisions, action items and automatic next follow-up
- Client-facing versus internal MOM content
- Investor Portal meetings and published MOMs

### Phase 3 client assessment and investor conversion

- Digital SOP 1 client assessment linked to each lead
- Personal profile, multiple bucket-list goals and investment preferences
- Automatic 20-point risk scoring
- Conservative, Moderate and Aggressive risk profiles
- Advisor override with reason
- Automatic 5-point qualification scoring
- Draft and completed assessment states
- Qualified lead-to-investor conversion
- Automatic GrowVest client code generation
- Investor list, editable investor profile and bucket-list progress
- Structured investments and liabilities
- Assessment versions and conversion activity history
- Printable proposal summary

## Technology

- Next.js 16 App Router
- React 19
- JavaScript
- Tailwind CSS 4
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Zod

## Local setup

1. Extract the project.
2. Copy `.env.example` to `.env.local`.
3. Add the Microsoft Entra tenant ID.
4. Enable Microsoft, Phone and Email/Password providers in Firebase Authentication.
5. Install dependencies and run:

```bash
npm install
npm run dev
```

Main routes:

```text
/staff-login
/investor-login
/dashboard
/leads
/leads/[leadId]
/leads/[leadId]/edit
/leads/[leadId]/assessment
/leads/[leadId]/assessment/summary
/users
/users/create
/users/[userId]/edit
/investors
/investors/[investorId]
/investors/[investorId]/edit
/reports
/reports/create
/reports/[reportId]
/reports/[reportId]/edit
/report-print/[reportId]
/report-templates
/report-templates/[templateId]
/meetings
/meetings/create
/meetings/[meetingId]
/meetings/[meetingId]/edit
/mom
/mom/create
/mom/[momId]
/mom/[momId]/edit
/investor/dashboard
/investor/profile
/investor/reports
/investor/reports/[reportId]
/investor/meetings
/investor/documents
/investor/change-password
/servicing
/settings
```

## Firebase deployment

The repository includes `.firebaserc`, `firebase.json`, `firestore.rules` and `firestore.indexes.json`.

```bash
firebase login
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## Version 0.24.0 — Email Template Customisation & Report Assignment

- Adds `/email-delivery/templates` with a responsive email-template library and structured editor.
- Customises report-email content, subject, preheader, heading, CTA and legal footer using supported merge fields.
- Configures header background, logo presentation, coloured divider line, canvas, typography and CTA styling.
- Integrates assigned Advisor, report creator, relationship manager or company-default published signatures.
- Controls signature logo, icon, designation, phone, WhatsApp, address, website, social profiles and footer taglines.
- Assigns an active email-template version to every report template, including secure-link, PDF-attachment and signature defaults.
- Stores email-template, report-template, branding and signature snapshots in report delivery history for historical consistency.
- Adds desktop/mobile live preview, draft activation, version history and Send Test integration through Email & Delivery.

## Version 0.22.1

Adds a separate **Email signature icon logo** asset in Branding -> Logo & assets. The dedicated icon is used in the top-right of desktop and mobile staff signatures, with backward-compatible fallbacks to the PDF footer symbol or app icon.

## Version 0.22.0

Adds dedicated signature branding assets, responsive mobile and WhatsApp signature previews, optional licensed Emitha webfont support, and administrator-configurable role and user permission overrides. See `docs/SIGNATURE_AND_PERMISSION_ENHANCEMENTS.md`.

## Documentation

```text
docs/AUTHENTICATION_SETUP.md
docs/PHASE_2_LEAD_WORKFLOW.md
docs/PHASE_2_COMPLETION_UPDATE.md
docs/PHASE_3_CLIENT_ASSESSMENT.md
docs/PHASE_3_COMPLETION.md
docs/PHASE_4_MEETINGS_MOM_NOTIFICATIONS.md
docs/PHASE_5_MONTHLY_REPORT_GENERATOR.md
docs/PHASE_6_BRANDED_REPORT_AND_PDF.md
docs/PHASE_6_CODE_MANIFEST.md
docs/PHASE_7_INVESTOR_PORTAL_SECURE_PUBLISHING.md
docs/PHASE_7_GAP_CLOSURE.md
docs/PDF_CONSISTENCY_PASS.md
docs/UI_UX_REPORT_TEMPLATE_LIBRARY.md
```

There are no hardcoded login credentials. Staff use Microsoft 365. The Super Admin may pre-authorise a staff email from the Users module; the matching `users/{uid}` profile is linked automatically on first sign-in.

## Current limitations

- Automatic WhatsApp API and background browser push are not included; WhatsApp uses manual click-to-chat.
- Microsoft Graph and Google Calendar API integrations are intentionally deferred; meeting links are entered manually.

## Phase 3.1 — Multiple Investment Preferences

Client assessments and investor profiles support multiple contribution preference plans. Existing single-preference records remain compatible and are migrated to the array structure when next saved.


## Phase 7 branding and authentication update

Dynamic logo, email branding, watermark uploads, Advisor signatures and canonical Investor provider linking are documented in:

`docs/PHASE_7_BRANDING_AND_INVESTOR_AUTH_FIX.md`

## UI/UX Phase 1

The project now includes the GrowVest design foundation, League Spartan and Open Sauce One typography, responsive staff and Investor shells, a mobile-first Investor Login and a reusable PDF header/footer system. See `docs/UI_UX_PHASE_1.md`.


## Market Commentary Library

Routes: `/market-commentary`, `/market-commentary/create`, and `/market-commentary/[commentaryId]/edit`. The module provides monthly and reusable commentary categories, draft/approval/archive states, version history, role-based controls, autosave, mobile layouts, and approved-content integration with Create Report Step 5.

## Email & Delivery Centre

The report delivery workspace is available at `/email-delivery`. It supports report email composition, PDF attachments, test emails, scheduled delivery, retry history and Brevo delivery-event tracking. See `docs/EMAIL_DELIVERY_CENTRE.md` for webhook, cron and environment configuration.



## Version 0.23.0

Completes the Monthly Report PDF consistency pass. HTML report, browser A4 preview and secure server PDF now share saved template order/visibility, branding snapshots, historical trends, derived highlights and transactions. Full allocation, holdings, actions and disclaimer data paginate safely with repeated headers and continuation pages. See `docs/PDF_CONSISTENCY_PASS.md`.

## Version 0.22.2

Adds a dedicated **Signature branding** section under Branding Settings with company-wide signature defaults for positioning, website, office address and footer taglines. LinkedIn, Instagram, Facebook, YouTube and X/Twitter profiles can now be configured centrally and appear as email-safe links in desktop/mobile email signatures and as full URLs in WhatsApp signature text. Staff signatures include a Social Media visibility control and an **Apply branding defaults** action.

## Version 0.26.1 — Dark Mode Consistency

- Separated published brand colours from application semantic theme tokens.
- Corrected dark page backgrounds, headings, card text, form fields and status colours.
- Added white/inverse navigation logos in dark mode.
- Preserved branding, email, HTML report and PDF previews independently from app theme.
- No Firebase migration is required.
