# GrowVest Investor & Monthly Report Tool

Standalone Next.js application for GrowVest investor operations, portfolio management, daily imports, goals/bucket lists, MOMs, investor actions and monthly portfolio reporting.

## Current implementation

## Version 0.33.2 - Investor Status & Safe Deletion

- Added Admin/Super Admin-only **Disable Investor**, **Enable Investor**, and **Delete Investor** controls under Investor → Access & Documents.
- Disable keeps the Investor visible to staff, blocks Investor Portal authentication, revokes existing sessions, and pauses SIP reminders that were active at the time of disablement.
- Enable restores active Investor status, resumes only SIP schedules paused by the lifecycle action, and restores prior portal access only when it was enabled before disablement.
- Delete removes the Investor from active GrowVest Investor lists using retained-record soft deletion rather than silently destroying financial history.
- Delete impact preview shows portfolio holdings, transactions, trading, ULIP policies, snapshots, reports, documents, meetings, Advisor Follow-ups and linked portal accounts before confirmation.
- Investor deletion requires a reason plus typed `DELETE`, disables/revokes linked portal accounts, pauses SIP reminders, deactivates external Investor mappings, and records an immutable activity log.
- Existing portfolio/report/document history remains retained for audit and published Monthly Reports are not rewritten.
- Investor list now shows Active/Disabled status and includes an Investor status filter.
- No new Firestore collections, browser write permissions, or composite indexes are required.
- See `docs/INVESTOR_STATUS_SAFE_DELETION_v0.33.2.md` for behavior and UAT.

## Version 0.33.1 - Reconciled Portfolio Administration

- Reconciled Portfolio navigation into **Portfolio Overview**, **Daily Portfolio Update**, and Admin-only **Portfolio Administration** so monitoring, importing and destructive cleanup are separate.
- Added a central Admin-only **Portfolio → Portfolio Administration** page for selecting multiple investors and bulk-cleaning Fundbazaar, Bajaj Delivery, Trading/Intraday, ULIP, Manual, Generic/Other, or the entire portfolio.
- Bulk deletion always builds a fresh per-investor preview before confirmation and uses the existing audited investor cleanup engine rather than bypassing recovery/fingerprint protections.
- Multi-investor operations share a cleanup batch ID in audit metadata so related per-investor deletions can be traced together.
- Kept the separate **Investor → Portfolio → Portfolio Administration** page and expanded it with holding-level multi-select, category filters, Delete All by category, and Delete Entire Portfolio (holdings + trading).
- Portfolio cleanup categories are now mutually exclusive: Manual ULIP/MF/Equity holdings remain under Manual Portfolio instead of appearing in both Manual and provider/type groups.
- Manual Portfolio Excel, Daily Portfolio Update, Advisor Follow-up, Service Requests, Bulk Data Upload and Monthly Market Note remain separate workflows with no navigation overlap.
- No new Firestore collections, composite indexes, or browser write permissions were introduced.
- See `docs/RECONCILED_PORTFOLIO_ADMINISTRATION_v0.33.1.md` for scope, safeguards and UAT.

## Version 0.33.0 - SIP Funding, Portfolio Administration & Manual Portfolio Excel

- Simplified module language: **Advisor Follow-up** for investment/advisory decisions, **Service Requests** for operational account servicing, **Bulk Data Upload** for Admin migration, and **Monthly Market Note** for reusable report commentary.
- Added configurable SIP pre-debit reminders (30/14/7/5/3/1 days and debit day) linked to Mutual Fund SIP holdings.
- Investor responses route automatically: withdrawal/transfer or investment discussion → Advisor Follow-up; bank/mandate issue → Service Request; funds available/added → Ready for SIP.
- Added Investor Portal **SIP Reminders**, Investor Dashboard upcoming-SIP visibility, and staff **SIP Funding** queue. No money movement or investment execution is automated.
- Added a daily `CRON_SECRET`-protected `/api/cron/sip-funding-reminders` job for deterministic in-app reminders.
- Added separate Admin-only **Investor Portfolio Administration** with Fundbazaar, Bajaj Delivery, Bajaj Trading, ULIP, Manual, and Other/Generic sections.
- Added authenticated Manual Portfolio Excel template, preview, **Merge / Update**, and **Replace Manual Portfolio** modes for accounts maintained manually.
- Manual Excel updates source=`manual` current holdings only and preserves provider-specific portfolios and existing Goal/Bucket allocations unless explicitly changed.
- See `docs/SIP_FUNDING_PORTFOLIO_ADMIN_v0.33.0.md` for workflow, security and UAT.

## Version 0.32.9 - Investor Portfolio Bulk Cleanup

- Replaced vendor/source cleanup with Investor-level portfolio management inside **Investor → Portfolio**.
- Admin/Super Admin can select one, multiple, all filtered, or all current holdings and delete them after impact preview and explicit `DELETE` confirmation.
- Default cleanup removes selected holdings plus their related imported transactions; manually created transactions require an explicit stronger option.
- Goal/Bucket List records, Investor Profile/KYC, documents, meetings, actions and published Monthly Reports are preserved.
- ULIP policy summaries recalculate when only some underlying funds are removed and are deleted only when no current underlying funds remain.
- A corrected current portfolio snapshot is rebuilt after cleanup.
- Import recovery journals affected by cleanup are invalidated to prevent old rollback from restoring removed holdings.
- Exact-file duplicate locks are released safely when the affected import is fully removed; cleaning the entire current Investor Portfolio releases all Investor portfolio fingerprints so the correct source files can be uploaded again.
- Source/vendor is now only a Portfolio filter, not the cleanup concept.
- See `docs/INVESTOR_PORTFOLIO_BULK_CLEANUP_v0.32.9.md` for safeguards and UAT.

## Version 0.32.6 - Production Hardening, Security Audit & Final QA

- Added release-audit and production-environment preflight scripts (`npm run qa`, `npm run qa:env:strict`, `npm run release:check`).
- Server API authentication now verifies revoked Firebase ID tokens; optional Firebase App Check enforcement is available after client rollout.
- Hardened Firestore Advisor access by removing historical `createdByUid` as a read authority, preserving query-compatible `advisorUid` / `assignedAdvisorUid` ownership, and constraining cross-Investor client writes against current assignment.
- Notifications are now explicit-recipient scoped so internal Advisor notifications cannot leak into the Investor Portal merely because they contain an `investorId`.
- Hardened Investor document Storage writes with path/uploader metadata ownership and prevents Investors deleting staff-uploaded documents.
- Monthly Report delivery is locked to the verified Investor email; CC/BCC is restricted to active staff/configured approved recipients; supplied delivery IDs are bound to the same report.
- Remote branding images embedded in PDFs are now HTTPS-only, DNS/network validated, redirect-limited, content-type checked and size-limited to reduce SSRF/resource-exhaustion risk.
- Aadhaar encryption now requires a strong server secret and uses an HMAC lookup hash for duplicate detection without storing searchable plaintext Aadhaar.
- Cron/webhook secrets require at least 32 characters; meeting reminders use a transactional claim to reduce concurrent duplicate sends.
- Brevo webhook payload storage is bounded and sanitised.
- Added stricter security/no-cache response headers and a production-safe `.env.example`.
- See `docs/PRODUCTION_HARDENING_SECURITY_QA_v0.32.6.md` for deployment requirements, residual risks and the release-candidate UAT matrix.

## Version 0.32.5 - Birthday & Occasion Management

- Added Investor birthdays plus spouse/family birthday, anniversary and other occasion tracking.
- Supports 30/14/7/3/1-day and same-day Advisor reminders with Asia/Kolkata date handling and duplicate prevention.
- Added Advisor touchpoint tracking (Called, WhatsApp, Email, Wish Completed, Skip/Reopen) with activity history.
- Birthday/occasion reminders are internal only; the system does not automatically message Investors.

## Version 0.32.4 - Portfolio Intelligence & Reconciliation

- Added new/exited/partial-exit holding intelligence, valuation reconciliation, duplicate-position checks and source freshness states.
- Added opening/fresh-investment/withdrawal/internal-transfer/market-movement/closing-value decomposition.
- Added Admin exception review plus simplified Investor portfolio verification status and month-on-month intelligence.

## Version 0.32.3 - GrowVest Standard / Generic Portfolio Importer

- Added a universal fallback portfolio importer for providers without a dedicated Fundbazaar, Bajaj or ULIP adapter.
- The official `Portfolio_Holdings` + optional `Transactions` workbook imports directly with no column-mapping step.
- Unknown XLS/XLSX/CSV layouts can be mapped once in Daily Portfolio Update; GrowVest can remember the exact header + sheet layout for later files.
- Mapping supports investor identity, investment type/mode, provider, instrument identity, valuation fields, transaction fields, maturity, Goal/Bucket List and notes.
- Generic investor matching uses saved external mapping, PAN, GrowVest Client Code and manual name review with ownership-conflict protection.
- Current holding imports preserve existing Goal/Bucket List allocations. Exact requested goal names can be applied to genuinely new positions; otherwise they remain General Wealth / Unassigned.
- Generic imports participate in exact-duplicate protection and Reprocess / Correct Investor / Rollback recovery.
- Optional complete-snapshot mode can mark missing positions for the represented provider as exited; it is off by default for unknown provider layouts.
- Added a downloadable standard workbook at `public/templates/GrowVest_Standard_Portfolio_Import_v0.32.3.xlsx`.
- Dedicated Fundbazaar, Bajaj Broking and ULIP adapters remain preferred when their native reports are available.
- See `docs/GROWVEST_STANDARD_GENERIC_IMPORT_v0.32.3.md` for workbook structure, mapping behaviour, safeguards and UAT.

## Version 0.32.2 - ULIP Portfolio Importer & Policy Tracking

- Daily Portfolio Update now enables ULIP portfolio detection and commit using policy-level records with multiple underlying fund positions.
- ULIP investor matching supports saved external mappings, PAN, optional client code, policy-number identity and manual confirmation with ownership-conflict protection.
- One ULIP policy is stored once in `ulipPolicies`; its underlying funds remain separate `portfolioPositions` so units, NAV, NAV date, fund value and Goal/Bucket allocation can update independently.
- Policy tracking includes insurer, policy number, plan, start/maturity dates, premium/frequency, total premium paid, sum assured, status, current fund value, fund count and latest NAV date.
- Fund Goal/Bucket List allocations persist across later ULIP imports. A new fund can use an exact requested goal; otherwise it remains General Wealth / Unassigned for staff review.
- Fund-level investment return is not fabricated when an insurer report provides only policy-level premium. Policy premium is tracked once while fund current values are summed from the underlying positions.
- ULIP imports participate in duplicate protection and Reprocess / Correct Investor / Rollback recovery journals, including policy records and policy identity mappings.
- Investor Portfolio now includes a ULIP Policy Tracking section plus fund-level NAV/freshness details. Monthly Report snapshots retain ULIP policy/fund fields.
- Missing funds are not automatically treated as switched/exited until a real insurer export confirms that the provider report is a complete authoritative fund snapshot.
- Exact production aliases still require validation against an actual insurer export; v0.32.2 uses the GrowVest ULIP standard format plus defensive common provider field aliases.
- See `docs/ULIP_PORTFOLIO_IMPORTER_v0.32.2.md` for supported structure, safety behaviour and UAT.

## Version 0.32.1 - Bajaj Broking Importer

- Daily Portfolio Update now enables Bajaj Broking Delivery Holdings and Intraday/Trade Book detection and commit.
- Delivery holdings update long-term Portfolio Master positions with quantity, average cost, current rate/value, unrealised P&L and persistent Goal/Bucket allocation.
- Intraday trades remain separate from long-term wealth and capture turnover, brokerage/taxes/charges, gross P&L and net P&L with monthly trading summaries.
- Bajaj investor matching uses saved external mapping, PAN, optional broker client code and manual confirmation.
- Exact duplicate files are skipped and Bajaj imports participate in Reprocess / Correct Investor / Rollback recovery journals.
- Ambiguous or unmatched side-wise BUY/SELL quantities are blocked rather than guessed.
- Exact production mapping still requires validation against one real Bajaj Holdings export and one real Trade Book/P&L export.
- Includes the Investor Action dialog null-safety hotfix and removes the invalid single-field `investorActions.updatedAt` custom index so Firestore index deployment succeeds.
- See `docs/BAJAJ_BROKING_IMPORTER_v0.32.1.md` for supported signatures, safety behaviour and UAT.

## Version 0.32.0 - Investor Action Requests & Advisor Workflow

- Added a central Investor Actions workspace for Admin/Advisor follow-up, due dates, decisions, status and completion tracking.
- Added Investor Portal **Actions & Requests** with linked portfolio/Goal discussion shortcuts and client-visible audit timeline.
- Monthly Report next steps and MOM action items sync into the central workflow. Unresolved actions carry into future Monthly Reports; terminal actions do not.
- Published-report discussion requests now create/reuse a tracked workflow action.
- Workflow writes use authenticated server APIs; Firestore browser writes are denied and Investor reads remain own-record + `investorVisible` scoped.
- See `docs/INVESTOR_ACTIONS_ADVISOR_WORKFLOW_v0.32.0.md` for deployment and acceptance testing.

## Version 0.31.8 - Daily Portfolio Coverage & Missing Investor Tracking

- Daily Fundbazaar coverage dashboard with Expected / Received / Updated / Need Attention / Missing counts.
- Expected investors are derived from verified Fundbazaar mappings and deduplicated across client-name/PAN identities.
- Missing daily reports never zero or clear a portfolio; the latest verified portfolio value remains visible with stale-day indicators.
- Duplicate files count as received but remain safely skipped.
- Unmatched/problem files are surfaced separately as operational exceptions.
- Admin/Super Admin can pause/resume daily coverage tracking for an investor without deleting the Fundbazaar mapping.
- Coverage refreshes after analysis, commit and import recovery actions.
- New Fundbazaar mappings default to daily coverage tracking enabled.

See `docs/DAILY_PORTFOLIO_COVERAGE_v0.31.8.md` for behaviour and UAT steps.

## Version 0.31.7 - Import Correction, Recovery and Investor KYC Identifiers

- Admin/Super Admin import recovery for Fundbazaar files processed from v0.31.7 onward.
- Per-file recovery journal captures the pre-import state before portfolio mutations are committed.
- Safe **Rollback**, **Reprocess**, and **Correct Investor** actions are available from Daily Portfolio Update → History → Manage.
- Recovery is blocked when a newer import has already changed the same holding, transaction, mapping, or file fingerprint.
- Same-investor reprocessing preserves existing Goal/Bucket List allocations. Correct-investor moves intentionally do not transfer the old investor's goal allocation.
- Published monthly reports remain frozen; recovery rebuilds the current corrected daily portfolio snapshot only.
- Investor Profile now supports PAN and Aadhaar identifiers. PAN is normalised and can auto-match Fundbazaar PAN to the correct Investor Profile.
- Full Aadhaar is never stored in the normal Investor document. It is encrypted server-side with AES-256-GCM in `investorKycSecure`; only the masked last four digits are exposed to the UI.
- Aadhaar values are excluded from activity-log payloads and are never used for portfolio matching.

**Required for Aadhaar storage:** configure a strong server-only `KYC_FIELD_ENCRYPTION_KEY` environment secret before saving Aadhaar values.

See `docs/IMPORT_CORRECTION_RECOVERY_KYC_v0.31.7.md` for deployment and UAT steps.

## Version 0.31.0 - Daily Portfolio Master & Portfolio-Driven Monthly Reporting

- Permanent investor Portfolio Master with verified daily snapshots and source freshness.
- Fundbazaar multi-file import with HTML-style `.xls` support, duplicate protection, saved investor mapping, folio/ISIN validation, missing-report detection, and new/exited holding review.
- Mutual funds support SIP, Lump Sum, or Both within the same folio while preserving transaction-level detail.
- Goal assignment is optional: holdings can remain in General Wealth, and multiple investments can fund one Goal/Bucket List.
- Delivery stocks track quantity, average buy rate, current rate/value, unrealised P&L, and partial/full sale history.
- Bajaj intraday trading is tracked separately from long-term wealth with gross P&L, charges, and net realised P&L.
- ULIP holdings support units, NAV, NAV date, premium/invested value, and fund value.
- Monthly surplus supports fixed or percentage calculation plus configurable allocation to investments, debt repayment, emergency funds, insurance, goals, tax/cash reserves, trading capital, and custom purposes.
- Loan records now include original/outstanding amount, EMI, rate, tenure, extra repayment, and target closure date.
- Monthly reports can now load the latest verified snapshot for the report period, calculate opening/closing corpus and known cash flows, include trading/loan/surplus context, and carry unresolved recommendations forward.
- Existing report preview, PDF, publishing, Email Delivery Centre, and Investor Portal workflows are preserved.

See `docs/PORTFOLIO_MASTER_AND_REPORTING.md` for workflow, data model and deployment notes.

## Version 0.28.0 - Advisor Identity, Performance and Trusted-Device Offline Access

- Advisor codes are generated automatically using a transaction-safe `GV-ADV-####` sequence.
- Super Admin and Admin accounts can be enabled as assignable Advisors without changing their administrative role.
- Existing Advisor-capable records without a code can be repaired from Users & Roles.
- Workspace search now uses idle preloading, request deduplication and a five-minute in-memory index.
- Investor Dashboard removes a duplicate notification listener and notification queries are bounded.
- Optional Firestore persistent caching and limited top-level offline navigation are available only after trusted-device opt-in.
- Private APIs, report details, documents and generated PDFs are excluded from service-worker caching.

See `docs/ADVISOR_CODES_PERFORMANCE_AND_OFFLINE.md` for deployment and UAT guidance.

## Version 0.27.0 - MOM Communication, PDF Consistency and Firebase Security Audit

- MOM WhatsApp messages now use the assigned Advisor's published signature and central signature branding.
- MOM downloads now use a dedicated server-generated A4 PDF with shared GrowVest document branding, pagination and audit logging.
- Firestore rules protect immutable MOM/report relationship fields and prevent Investor self-verification of uploaded documents.
- Storage rules restrict Advisor document access to assigned Investors.
- Firebase App Check support, baseline security headers and constant-time webhook/cron secret checks are included.
- Current Firestore and Storage data already use platform encryption; application-level encryption is now used for full Aadhaar values; future bank/KYC secrets should follow the same server-only encrypted-storage pattern.

See `docs/MOM_PDF_SECURITY_AUDIT_AND_ENCRYPTION.md` for deployment, encryption and UAT guidance.

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
docs/MOM_PDF_SECURITY_AUDIT_AND_ENCRYPTION.md
docs/UI_UX_REPORT_TEMPLATE_LIBRARY.md
```

There are no hardcoded login credentials. Staff use Microsoft 365. The Super Admin may pre-authorise a staff email from the Users module; the matching `users/{uid}` profile is linked automatically on first sign-in.

## Current limitations

- Automatic WhatsApp API is not included; WhatsApp uses manual click-to-chat. Firebase Web Push is included for Investor notifications after VAPID and Cloud Function deployment.
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

## v0.28.1 — Firebase App Check build fix

Removed the unsupported `getAppCheck` import and made App Check initialisation safe across Next.js hot reloads.

## 0.29.0
Template application reliability, lazy report charts, memory-only Firestore cache, and restricted investor offline data.

## 0.30.0 — Investor Mobile Experience and Firebase Push Notifications

- Added an app-style Investor mobile header using the published inverse GrowVest logo directly on the navy/blue background.
- Improved mobile bottom navigation, More sheet, quick-access dashboard actions and Advisor contact actions.
- Added Firebase Cloud Messaging push registration for Investor devices.
- Added closed-app background notifications through a dedicated Firebase Messaging service worker.
- Added push preferences for Reports, Meetings & MOM, Documents and General updates.
- Added a test-push action and automatic cleanup of invalid FCM tokens.
- Added an `asia-south1` Firestore-triggered Cloud Function for new notification delivery.
- Push tokens are server-managed and are removed from the current device during secure logout.

See `docs/V0_30_INVESTOR_MOBILE_AND_PUSH_NOTIFICATIONS.md` for configuration, deployment and UAT steps.


## 0.30.1 — Investor Mobile Width and Overflow Fix

- Fixed right-side clipping and page-level horizontal overflow on the Investor dashboard.
- Kept Quick Access horizontally scrollable without widening the full page.
- Constrained hero actions and KPI cards to the mobile viewport.
- Updated the PWA static cache version.


## 0.30.2 — Lead Creation Reliability Fix

- Normalises blank optional lead fields before Firestore writes.
- Prevents `undefined` qualification score or amount values from breaking lead creation.
- Shows actionable Firestore error messages instead of the previous generic message.
- Updates the PWA cache version.

See `docs/V0_30_2_LEAD_CREATION_FIX.md`.

## 0.30.3 — PWA Icon and Brand Identity

- Corrected Android maskable-icon fallback and removed the wide-logo-in-white-card default icon treatment.
- Added configurable PWA full name, short name and brand message.
- Added automatic standard, Apple and maskable icon generation.
- Added `Your Conscious Wealth Partner` to Investor PWA branding surfaces.

See `docs/V0_30_3_PWA_ICON_AND_BRAND_IDENTITY.md`.



## v0.31.2 Firestore index-building fallback

- Portfolio snapshot, trading, portfolio import, and monthly report-source reads now fall back to investor-scoped client-side sorting/filtering when Firestore returns `failed-precondition` because a composite index is still building.
- The deployed composite indexes remain the preferred path and should be left enabled for performance.
- This hotfix prevents the UI from failing while newly deployed indexes are still provisioning.

## v0.31.1 permission hotfix

Advisor portfolio reads now include the advisor ownership constraint required by Firestore rules. Deploy `firestore.rules` and `firestore.indexes.json` after updating.

## v0.31.5 Unified Daily Portfolio Update

- One daily portfolio upload surface for Excel portfolio reports.
- Content-based source/report detection rather than filename-based classification.
- Fundbazaar Client Wise Valuation remains supported as an optional/legacy valuation input with saved mapping and duplicate protection.
- Fundbazaar Portfolio Ledger is the recommended primary Fundbazaar daily input. Bajaj Delivery, Bajaj Intraday and ULIP are import-enabled; GrowVest Standard multi-source workbooks remain isolated until their generic commit adapter is enabled.
- Excel web-wrapper Fundbazaar files now receive a specific missing-companion-package explanation.
- Admin can review only exceptions and process ready reports without waiting for unrelated unsupported files.


## v0.31.6 Fundbazaar Portfolio Ledger Import

- Fundbazaar Portfolio Ledger is now detected and import-enabled in Daily Portfolio Update.
- Parses investor name, PAN, report period, scheme/folio summary, transaction history, invested amount, units, current value, ABS return and XIRR.
- SIP/eSIP, purchase, redemption and switch transaction types are normalised for Portfolio Master reconciliation.
- PAN creates a verified Fundbazaar identity alias after the first confirmed mapping, while the existing client-name mapping remains compatible with Client Wise Valuation files.
- Ledger holdings reconcile to existing Fundbazaar positions by folio + ISIN/scheme rather than creating duplicate holdings when the Ledger does not contain ISIN.
- Client Wise Valuation remains authoritative for precise NAV/current valuation when it is as fresh or fresher than the Ledger; Ledger remains authoritative for transaction/reconciliation fields.
- Transaction canonical keys prevent Client Wise Valuation and Portfolio Ledger from duplicating the same SIP/purchase rows when both reports are imported.
