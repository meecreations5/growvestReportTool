## Version 0.33.6 - Investor Mobile Finance App Redesign + Official SVG Brand Polish

- Uses the supplied official GrowVest SVG assets for the phone Home header, internal app headers, Investor Login and loading/splash experience.
- Fixes dark hero heading contrast on phone screens such as Login & Security.
- Simplifies internal mobile headers, uses a circular profile avatar and removes redundant app-label clutter.
- Applies Royal Trust Blue, Growth Cyan, Insight Yellow and Deep Premium Black intentionally across Home Quick Actions.
- Adds subtle official GrowVest icon watermarks to key finance-app hero surfaces without affecting data readability.
- Bucket List mobile filters are now a 2x2 app grid to prevent clipping on narrow phones.
- PWA cache is bumped to `v0.33.6-ui2` and pre-caches the official GrowVest SVG set.
- See `docs/INVESTOR_MOBILE_OFFICIAL_SVG_BRAND_POLISH_v0.33.6.md`.

## Version 0.33.5 - Investor Mobile App Experience & Design System

- Introduced a **phone-only (<768px) Investor App UI system** while preserving the established tablet and desktop layouts.
- Investor Home now calculates the current wealth value from live **Portfolio Master positions**, not the latest published Monthly Report or a cached profile value.
- Home refreshes on open, app focus/foreground, every 60 seconds while visible, and on manual refresh; Portfolio Master API responses are private/no-store.
- Aligned ULIP invested-basis handling with the Portfolio screen while keeping Insurance protection cover completely outside portfolio corpus/AUM.
- Added authenticated server-side Investor App data and notification routes to remove protected browser Firestore list reads that could raise `FirebaseError: Missing or insufficient permissions`.
- Hardened Investor read flows for Home, Goals, Profile, Reports/report detail, Meetings, Documents, Notifications, Advisor Follow-up/Actions and withdrawal views.
- Added a native-style mobile app bar, app-style More bottom sheet, consistent phone cards/safe areas and a compact phone Monthly Review header.
- Permanent bottom navigation remains **Home | Portfolio | Goals | Reports | More**, with Notifications in the app header bell.
- Bumped installed Investor PWA caches to v0.33.5.
- See `docs/INVESTOR_MOBILE_APP_EXPERIENCE_DESIGN_SYSTEM_v0.33.5.md` and `docs/INVESTOR_MOBILE_APP_EXPERIENCE_DESIGN_SYSTEM_CODE_MANIFEST_v0.33.5.md`.

## v0.33.4 Investor Portfolio Permission Hotfix

- Replaced browser-side Portfolio Master listeners on **Investor → Portfolio** with authenticated `GET /api/portfolio/investor-view`.
- Fixes `FirebaseError: Missing or insufficient permissions` caused by client-side list queries across Portfolio Positions, snapshots, transactions, ULIP investment records, trading history and Manual Portfolio accounts.
- The server validates Super Admin/Admin, current Advisor assignment, or the linked Investor Portal identity before returning portfolio data.
- Investor mobile `/investor/portfolio` no longer reads the Investor profile directly from browser Firestore.
- Portfolio mutations continue through server APIs and the Portfolio view refreshes after Goal reassignment, manual holding/trade entry, delivery sale and cleanup actions.
- Firestore security rules remain unchanged/tight; no broader browser read permission was introduced.
- See `docs/INVESTOR_PORTFOLIO_PERMISSION_HOTFIX_v0.33.4.md`.

## v0.33.4 Investor Directory Permission Hotfix

- Replaced the staff **Investors** directory's browser-side Firestore collection listener with an authenticated server API (`GET /api/investors`).
- Prevents `FirebaseError: Missing or insufficient permissions` on the Investor list when deployed browser rules/query proof lag behind the application.
- Super Admin/Admin receive all non-deleted Investors; Advisors receive both current `assignedAdvisorUid` and legacy `advisorUid` ownership, de-duplicated server-side.
- Older Investor records that predate the `isDeleted` field remain visible; only records explicitly marked `isDeleted: true` are excluded.
- See `docs/INVESTOR_LIST_PERMISSION_HOTFIX_v0.33.4.md`.

## Version 0.33.4 - Stability, Data Integrity & Mobile App Hardening

- Hardened Monthly Report month changes so editable drafts migrate to the canonical `InvestorId_YYYY-MM` document identity instead of leaving the reporting month and Firestore ID out of sync.
- Added stale-edit protection for Monthly Reports, idempotent publication claims, retry-safe deletion journaling, atomic PDF download counters and support for verified fully-exited zero-closing-balance report months.
- Standardised GrowVest business-date defaults on **Asia/Kolkata** for newly hardened workflows.
- Hardened Insurance reminders with overdue priority, catch-up stages, lifecycle pause controls, duplicate-policy protection, server-side status validation, retry-safe import batches and ULIP protection/investment linkage.
- Investor disable/delete lifecycle controls now pause Insurance reminders, Meeting reminders and scheduled Report deliveries in addition to SIP reminder workflows.
- Rebuilt Investor mobile-app navigation as exactly **Home | Portfolio | Goals | Reports | More**, with Notifications kept in the app header, corrected tablet More-menu behaviour and improved bottom safe-area spacing.
- Updated Investor PWA cache identity to v0.33.4 so installed apps refresh the hardened navigation and routes.
- See `docs/STABILITY_DATA_INTEGRITY_MOBILE_APP_HARDENING_v0.33.4.md` and `docs/STABILITY_DATA_INTEGRITY_MOBILE_APP_HARDENING_CODE_MANIFEST_v0.33.4.md`.

## Version 0.33.3 - Investor Insurance & Protection Management

### Monthly Report regeneration hotfix

- Fixed recreated Monthly Reports remaining on **Monthly Portfolio Verification · Checking** with zero holdings after the first draft save/remount. Empty recreated drafts now rehydrate from Portfolio Master automatically while established report facts remain protected.
- **Refresh verification** can now populate a genuinely empty saved draft instead of only updating verification metadata.
- Added a controlled five-day month-end capture grace window: if no verified snapshot exists on/before the report cutoff, GrowVest may use a snapshot captured during the next five days only when all dated source/position valuations are on or before the reporting cutoff.
- Verification shows the effective portfolio date and, when different, the later capture date for audit transparency.
- See `docs/REPORT_REGENERATION_PORTFOLIO_HYDRATION_HOTFIX_v0.33.3.md`.

- Added **Insurance & Protection** as a separate protection layer inside Portfolio Management and Investor Profile without adding insurance cover to investment AUM/corpus.
- Supports Term/Whole Life/Endowment/ULIP Insurance, Health/Critical Illness/Personal Accident, Vehicle, Home, Travel, Cyber and Other policies with standard and type-specific fields.
- Added manual policy entry/editing, policy status controls, secure policy-document upload, renewal history and a dedicated read-only Investor Portal page.
- Renewal creates a new linked policy and retains the previous policy as `Renewed` instead of overwriting history.
- Added a production Insurance Excel template, filled illustrative sample and explanatory Manual Investment & Insurance guide with preview-first import.
- Added configurable automatic reminders with the standard **60/30/15/7/1-day** cadence for premium due, renewal/expiry and separate Vehicle Own Damage / Third Party expiry dates.
- Added a `CRON_SECRET`-protected daily `/api/cron/insurance-reminders` endpoint with deterministic reminder-event de-duplication and Advisor/Investor notifications.
- Monthly Reports now persist and render a separate **Protection Snapshot** in web, print and generated PDF output.
- Insurance Firestore collections remain server-managed and are not directly readable/writable by browser clients.
- See `docs/INVESTOR_INSURANCE_PROTECTION_v0.33.3.md` and `docs/INSURANCE_PROTECTION_CODE_MANIFEST_v0.33.3.md` for workflow, deployment and UAT.

# GrowVest Investor & Monthly Report Tool

Standalone Next.js application for GrowVest investor operations, portfolio management, daily imports, goals/bucket lists, MOMs, investor actions and monthly portfolio reporting.

## Current implementation

## Version 0.33.2 - Investor Status & Safe Deletion

### Trading Account native broker import - Phase 1

- Added a separate **Trading Accounts** workspace under Portfolio Management for broker-level delivery holdings, DP movement and intraday activity.
- Validated native **Bajaj Broking Client Holding Report** parsing against the supplied production-format XLSX: current delivery quantity/value is authoritative while absent purchase cost remains explicitly pending and no P&L is fabricated.
- Added native **Angel One DP Transaction Cum Holding** digital-PDF parsing for investor/Demat identity, DP credit/debit movement and statement-reported closing delivery holdings. DP records are never treated as intraday trades.
- Added `brokerAccounts`, `brokerAccountSnapshots` and `brokerDpTransactions` server-managed records, broker-account-aware position identity, recovery support, Firestore rules and Full Portfolio Reset coverage.
- Unified Import now accepts supported digital PDF broker statements and keeps delivery corpus, depository movement and intraday P&L visibly separate.
- See `docs/TRADING_ACCOUNT_BROKER_IMPORTS_v0.33.2.md` for data model, safeguards, limitations and UAT.

- Added Super Admin-only **Full Portfolio Reset** as a separate action from normal controlled portfolio cleanup.
- Full Portfolio Reset returns a selected Investor to a true first-ever-upload portfolio state by deleting current holdings, investment transactions, ULIP portfolio records, Bajaj trading data, snapshots, Investor-linked import files, recovery journals/items, file fingerprints, provider mappings, SIP funding workflow records, linked portfolio actions/service requests/notifications, portfolio-specific activity history, daily-tracking state and latest Portfolio Master metadata.
- Central **Portfolio Administration** supports Full Portfolio Reset for up to 25 selected Investors with a fresh impact preview and typed `RESET N INVESTORS` confirmation; an individual Investor requires typed `RESET PORTFOLIO`.
- Shared import batches are handled safely: only the selected Investor files are removed and surviving batch metadata is rebuilt for other Investors; when no files remain, the old import batch is deleted completely.
- Goal/Bucket List definitions, Investor profile/KYC/documents/family/advisor/meetings and published Monthly Reports are preserved. Old holding-to-goal allocations disappear with the deleted holdings.
- Published Monthly Reports remain historical and no longer backfill staff/Investor **current portfolio** displays when the live Portfolio Master is blank after reset.
- Full Portfolio Reset intentionally creates no corrected snapshot and no new portfolio-reset history entry, so the next verified upload creates the first new Portfolio Master/snapshot and starts future portfolio history from that point.
- Added Admin/Super Admin **Multi-Investor Manual Portfolio Excel** under central Portfolio Administration: one workbook can contain many holdings for many investors, matched by Investor ID/PAN/Client Code/exact unique name with preview-first conflict protection.
- Multi-Investor Manual Portfolio supports Merge/Update and investor-by-investor Replace modes, preserves non-Manual portfolio sources, writes per-investor audit events, and rebuilds a fresh Portfolio Master snapshot for every imported investor.
- Daily Fundbazaar Coverage now treats `Expected = 0` as **Not started** instead of 100% coverage and ignores orphan/uncommitted issue files that cannot be tied to a currently expected verified mapping.
- The Portfolio Import Centre history now shows only batches that actually updated at least one portfolio; zero-import preview/error attempts no longer appear as operational import history after a reset.
- Rejected/uncommitted portfolio files now persist strong external identity metadata for safe Investor-specific reset cleanup. When a Full Reset leaves **no verified Fundbazaar mappings at all**, pre-reset orphan Fundbazaar issue attempts are also removed and empty issue-only batches are deleted.
- For systems that were already reset on an older build, Super Admin now gets **Clear old failed attempts** in Daily Portfolio Update. It permanently deletes only zero-import orphan Fundbazaar attempts and is blocked while any verified Fundbazaar mapping exists.
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
- See `docs/FULL_PORTFOLIO_RESET_v0.33.2.md` for the fresh-start reset contract, deletion matrix and UAT.

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

## v0.33.2 Manual Portfolio Management workbook

Portfolio Administration now supports one multi-sheet Excel workbook for multiple investors and multiple manually managed portfolio accounts. The workflow covers account master, current holdings, transactions, cash, income, corporate actions, charges, goal allocations, reconciliation and notes, while preserving existing Fundbazaar/Bajaj/ULIP flows. Account-level performance metrics and dated account snapshots preserve cash, realised/unrealised P&L, XIRR and asset allocation for later month/FY/since-inception reporting. See `docs/MANUAL_PORTFOLIO_MANAGEMENT_v0.33.2.md`.

## v0.33.2 — Reporting Period & Planned/Actual Cash Flow

Monthly Reports now default to the previous completed calendar month, automatically calculate Money Added, Money Withdrawn and Portfolio Gain/Loss from verified activity, and keep planned Investor Actions separate from actual cash flows. Trading Account Deposit/Withdrawal are explicit action types, SIP stop/pause/reduction remain SIP changes rather than withdrawals, and Advisors can optionally confirm an actual external cash movement only when a provider transaction is not already stored. See `docs/REPORTING_PERIOD_PLANNED_ACTUAL_CASH_FLOW_v0.33.2.md`.

## v0.33.2 Profile Withdrawal + Report Delete workflow

The Investor Profile is now the single source for planned Mutual Fund withdrawals/cash needs, including multiple funds per Bucket List and per-fund SIP Continue/Pause/Stop instructions. Draft Monthly Reports auto-fetch these Profile actions as read-only context, actual completion updates Portfolio Master, and provider redemptions reconcile against provisional action transactions to prevent double counting. Monthly Reports can also be deleted through a controlled, audited server workflow without deleting Portfolio Master, Bucket Lists, Investor Actions or financial transactions. See `docs/PROFILE_WITHDRAWAL_REPORT_DELETE_WORKFLOW_v0.33.2.md`.

## v0.33.3 - Insurance integrated into Investor Profile and Portfolio

Insurance & Protection is now surfaced directly inside the Investor Profile Overview, the Investor Portfolio, the Investor Portal Portfolio, and the consolidated Portfolio Overview. Portfolio Management now shows aggregate life/health cover, active policy counts, upcoming premium/renewal attention and investor-level protection rows while keeping every insurance cover amount outside investment AUM/current value/Bucket List corpus. Direct Investor links using `?tab=portfolio` or `?tab=protection` now open the requested profile section. See `docs/INSURANCE_PROFILE_AND_PORTFOLIO_INTEGRATION_v0.33.3.md`.

### v0.33.4 Investor Mobile App optimisation hotfix
- App-first mobile navigation refinement and safe-area handling.
- Compact mobile header and bottom navigation active state.
- Home Quick Access changed from swipe-only carousel to 2x2 grid.
- Sticky Investments / Protection mobile Portfolio segment.
- Mobile card rendering for intraday trades.
- iOS form-control zoom prevention and report/document bottom-action spacing fixes.
See `docs/MOBILE_APP_OPTIMISATION_HOTFIX_v0.33.4.md`.

## v0.33.5 Investor Mobile Brand UI Refinement Hotfix

- Phone-only Documents redesign with compact guidance, contained status summary and View-first action hierarchy.
- Phone-only Portfolio Intelligence redesign with clearer information hierarchy and long-name wrapping.
- GrowVest Royal Trust Blue, Growth Cyan and Insight Yellow applied through the existing dynamic branding tokens.
- Global Investor App phone-width containment prevents right-side clipping/horizontal overflow.
- PWA cache bumped to `v0.33.5-ui2` for installed-app refresh.

See `docs/INVESTOR_MOBILE_BRAND_UI_REFINEMENT_HOTFIX_v0.33.5.md`.


## v0.33.5 Investor Mobile Scroll Recovery Hotfix

- Restores normal vertical scrolling on the Investor mobile app after the brand/overflow refinement.
- Replaces the phone wrapper `overflow-x: hidden` with `overflow-x: clip` + explicit vertical overflow visibility so the wrapper cannot become an unintended scroll container.
- Prevents secure Document Preview from applying a body scroll lock on phones.
- Adds a route-level mobile recovery guard for stale body overflow locks left by an older PWA/Fast Refresh session.
- Keeps horizontal clipping protection, fixed bottom navigation and all GrowVest mobile brand styling intact.
- PWA cache bumped to `v0.33.5-ui3`.

See `docs/INVESTOR_MOBILE_SCROLL_RECOVERY_HOTFIX_v0.33.5.md`.

## v0.33.6 - Investor Mobile Finance App Redesign
- Complete phone-only Investor finance-app visual system using approved GrowVest brand colors.
- Live portfolio graphs, asset-allocation donut, Bucket List progress rings and report infographics.
- Redesigned phone Home, Portfolio, Goals, Reports, Protection, Meetings, SIP Reminders, Actions, Notifications, Profile and Security experiences.
- Floating five-item mobile navigation: Home, Portfolio, Goals, Reports, More.
- Dedicated GrowVest SVG loading mark and branded Investor loading screen.
- Tablet, desktop, Staff and Admin layouts remain unchanged by the phone-only design release.

## v0.33.7 - Investor Mobile Professional UI & Visual Intelligence
- Phone-only professional polish based on the approved GrowVest finance-app reference direction.
- GrowVest official-icon outline motif, Financial Health visualization and calmer app-card hierarchy.
- Portfolio expands to all holdings on demand; Goals and Reports gain mobile search/filter improvements.
- Protection, Documents, Meetings, SIP, Actions, Notifications, Profile and Security receive native-style mobile refinements.
- Monthly Report protection tables become phone cards to eliminate horizontal scrolling.
- Official GrowVest SVG loading identity is retained; PWA cache is bumped to `v0.33.7-ui1`.
- Tablet, desktop, Staff and Admin layouts remain unchanged.

See `docs/INVESTOR_MOBILE_PROFESSIONAL_UI_VISUAL_INTELLIGENCE_v0.33.7.md`.

## v0.33.7 Investor Mobile Build & Brand Hotfix

- Fixes the Turbopack `Expression expected` error in Investor Meetings caused by an unbalanced JSX conditional.
- Uses the complete official GrowVest SVG logo lockup in the phone Home header; the split wordmark asset is no longer rendered by itself.
- Refines the hero-card GrowVest outline watermark to a thinner `0.28` stroke.
- Bumps the installed Investor PWA cache to `v0.33.7-ui2`.

See `docs/INVESTOR_MOBILE_BUILD_AND_BRAND_HOTFIX_v0.33.7.md`.

## v0.33.8 - GrowVest Motion Language & Website-to-App Continuity

The Investor phone experience now carries a consistent GrowVest motion identity from website/login into the Investor App. The official supplied GrowVest SVG icon outline forms first, the filled mark settles, the official wordmark appears, and the app transitions into the investor wealth view. The entry handoff is session-gated so normal navigation remains instant.

The same compact GrowVest motion mark is reused during Portfolio Master refresh and Monthly Review PDF preparation. Reduced-motion accessibility is respected, and Staff/Admin/tablet/desktop behaviour is unchanged. Installed Investor PWA caches are bumped to `v0.33.8-motion1`.

See `docs/GROWVEST_MOTION_LANGUAGE_APP_CONTINUITY_v0.33.8.md` and `docs/GROWVEST_MOTION_LANGUAGE_APP_CONTINUITY_CODE_MANIFEST_v0.33.8.md`.

## v0.33.9 - Investor Mobile App Recomposition

This release rebuilds the Investor phone experience around a calmer native-app hierarchy rather than continuing to stack dashboard cards. Home, Portfolio, Bucket List, Protection and Monthly Reviews now use one primary focal surface, quieter white supporting cards, compact filters, slimmer bottom navigation and stronger `Next for you` guidance. The official GrowVest SVG identity and motion language are retained, while the outline motif is intentionally more subtle.

The redesign remains phone-only below 768px; tablet, desktop, staff and admin layouts are unchanged. Installed Investor PWA caches are bumped to `v0.33.9-ui1`.

See `docs/INVESTOR_MOBILE_APP_RECOMPOSITION_v0.33.9.md` and `docs/INVESTOR_MOBILE_APP_RECOMPOSITION_CODE_MANIFEST_v0.33.9.md`.

## v0.34.0 - Investor Mobile Premium Reference Replication & Performance

The Investor phone experience now follows the approved premium GrowVest finance-app reference across Splash, Home, Portfolio, Holding Detail, Bucket List, Protection, Monthly Review, Documents, Notifications and Profile/More. The official GrowVest SVG motion language is retained, while page-to-page loading uses lightweight skeletons. Investor API reads now use short-lived section caching, in-flight request deduplication and lightweight server section responses to improve perceived and actual page performance. See `docs/INVESTOR_MOBILE_PREMIUM_REFERENCE_REPLICATION_v0.34.0.md`.

## v0.34.1 - Investor Mobile UX & Premium Design System Consolidation

This release consolidates the approved premium Investor phone experience into a more readable and consistent financial-app system. It adds persistent app-wide financial privacy, calendar-based chart ranges, priority-driven `Next for you`, one canonical Protection destination, Goal Detail and Holding purpose context, clearer Monthly Review language, simplified Profile/More information architecture, confirmation for investor decisions, investor-friendly login errors, Protection setup wording, improved mobile typography and explicit mobile dark-mode handling. Installed Investor PWA caches are bumped to `v0.34.1-ux1`.

See `docs/INVESTOR_MOBILE_UX_PREMIUM_DESIGN_SYSTEM_v0.34.1.md` and `docs/INVESTOR_MOBILE_UX_PREMIUM_DESIGN_SYSTEM_CODE_MANIFEST_v0.34.1.md`.

## v0.34.2 - GrowVest Signature Mobile UI

The Investor App phone experience now follows the approved GrowVest reference direction: Royal Trust Blue `#1F4ED8`, Deep Premium Black `#0B0B0F`, Strategic Red `#E53935`, Insight Yellow `#F5B301`, Soft Gray `#F4F6F9`, Medium Gray `#6B7280` and White. The official GrowVest SVG assets are reused unchanged.

The release introduces a brand-blue Total Wealth hero, overlapping four-action Home surface, slim Lucide icons, a central official GrowVest mobile action button, flatter Portfolio/Bucket List/Protection/Profile information architecture, a Deep Premium Black Monthly Review feature, redesigned Goal and Holding Detail views, and a consolidated phone design-system layer. Existing investor data/security flows and tablet/desktop workflows are preserved.

See `docs/INVESTOR_MOBILE_SIGNATURE_UI_v0.34.2.md` and `docs/INVESTOR_MOBILE_SIGNATURE_UI_CODE_MANIFEST_v0.34.2.md`.

## v0.34.3 - Investor Mobile Visual Correction

v0.34.3 is a screenshot-led correction pass on the GrowVest Signature Mobile UI. It adds consistent mobile back navigation, corrects the home logo on Royal Trust Blue, tightens Home proportions, aligns portfolio gain/loss with current value versus invested amount, improves sparse chart history, makes Bucket List controls adaptive, displays non-zero sub-1% goal progress correctly, replaces unsupported goal-status copy with planning-aware guidance, reduces connected-investment density and further simplifies Profile.

See `docs/INVESTOR_MOBILE_VISUAL_CORRECTION_v0.34.3.md`, `docs/INVESTOR_MOBILE_VISUAL_CORRECTION_CODE_MANIFEST_v0.34.3.md` and `RELEASE_VALIDATION_v0.34.3.md`.

## v0.34.5 — Investor Experience Reconciliation

This release reconciles the Investor App around three questions: **Where am I today? What am I building toward? What should I do next?** Home now uses a structurally full-width Royal Trust Blue hero, persistent phone navigation becomes **Home | Portfolio | GrowVest | Bucket List | Reports**, and Profile is completed with available Investor Master, masked KYC and portfolio-status context.

SIP reminders can now be inferred from Portfolio SIP history when a staff-managed schedule is not already present, Home no longer silently hides SIP-load failures, and a verified/reconciled daily portfolio snapshot can create a deep-linked Investor notification and push alert according to the Investor's Portfolio notification preference.

The release also introduces **Investor Add Bucket List**. Investor-submitted aspirations stay in a separate review workflow and do not affect active goal corpus/progress or investment allocation until an assigned Advisor, Admin or Super Admin discusses, refines and confirms the goal.

See `docs/INVESTOR_EXPERIENCE_RECONCILIATION_v0.34.5.md`, `docs/INVESTOR_EXPERIENCE_RECONCILIATION_CODE_MANIFEST_v0.34.5.md` and `RELEASE_VALIDATION_v0.34.5.md`.

## v0.34.4 — GrowVest Brand Color System & Screen Refinement

This release applies the official GrowVest palette as a consistent mobile Investor App meaning system rather than decorative color. Royal Trust Blue leads active/progress states; Deep Premium Black carries wealth/review emphasis; Insight Yellow identifies planning and due-soon attention; Strategic Red is reserved for genuine negative/urgent states.

Investor mobile refinements include an edge-to-edge Home wealth hero, data-driven Need Attention priorities, locked slim icon mapping, date-backed Portfolio range filters with full-history All view, a thicker brand-led Asset Allocation donut, richer low-density Bucket List presentation, consistent goal icons across Home/list/detail, a highlighted Holding Investment Snapshot, premium Black Monthly Review summaries, and Blue/Yellow/Red Protection status semantics.

See `docs/INVESTOR_MOBILE_BRAND_COLOR_SYSTEM_v0.34.4.md` and `docs/INVESTOR_MOBILE_BRAND_COLOR_SYSTEM_CODE_MANIFEST_v0.34.4.md`.

### v0.34.5 Home Composition Lock

The phone Investor Home composition is now locked to the approved sequence: Royal Trust Blue wealth hero → curved white sheet → compact quick actions → smart Need Attention → compact Bucket List → Deep Premium Black Monthly Review → GrowVest Partner → bottom navigation. See `docs/INVESTOR_HOME_COMPOSITION_LOCK_v0.34.5.md`.

### v0.34.5 Exact Home Reference Lock

The phone Investor Home now matches the approved Home screenshot as the visual source of truth: full-width Royal Trust Blue hero, floating rounded four-action tray, one compact priority attention preview, compact Bucket List, Deep Premium Black Monthly Review, GrowVest Partner and the approved Home / Portfolio / GrowVest / Bucket List / Profile bottom navigation. See `docs/INVESTOR_HOME_COMPOSITION_LOCK_v0.34.5.md` and `docs/INVESTOR_HOME_EXACT_REFERENCE_CODE_MANIFEST_v0.34.5.md`.

### v0.34.5 Exact Home Reference + Reports Navigation
The approved Home screenshot remains the visual source of truth, with the requested persistent mobile navigation set to Home, Portfolio, GrowVest, Bucket List and Reports. Profile remains accessible from the Home avatar and GrowVest action sheet. Installed Investor PWA cache: `v0.34.5-home-exact2`.


### v0.34.5 Exact Home Transition Correction
The approved Home screenshot remains the source of truth. The Home transition now uses a true layered composition: the white content sheet overlaps the Royal Trust Blue hero by 14px with 22px rounded top shoulders, while the compact quick-action tray sits inside that sheet rather than independently floating over a flat white canvas. Persistent mobile navigation remains Home, Portfolio, GrowVest, Bucket List and Reports. Installed Investor PWA cache: `v0.34.5-home-exact4`.


### v0.34.5 Home Transition Exact4
The Home content sheet now rises 26px into the Royal Trust Blue hero with 26px rounded top shoulders, keeping the compact quick-action tray inside the sheet. The Deep Premium Black Monthly Review block remains visible even before a review is published, using an honest placeholder state that links to Reports. Installed Investor PWA cache: `v0.34.5-home-exact4`.

## v0.34.6 — Family & Household Portal Access

Shared family contact details no longer require duplicate Firebase users. GrowVest can explicitly link multiple Investor profiles to one authorised access account, show a profile selector after login, switch Investor context without another OTP, preserve server-side Investor isolation through membership validation, and keep one family profile disable action from revoking all remaining household access. Push notifications also carry Investor context for safe deep links. See `docs/FAMILY_HOUSEHOLD_PORTAL_ACCESS_v0.34.6.md`.

## v0.34.7 — Personalised Guest Investor Demo: Lead starts on agreement

The Investor Demo now hands a prospect into the existing GrowVest Lead workflow at the exact moment they select **Become part of GrowVest**.

- Starting/browsing a Demo does not create a Lead.
- `Become part of GrowVest` creates one normal `NEW` Lead immediately with source `Investor App Demo`.
- The Lead enters the existing `SOP 1 - Lead to Conversion` flow; no parallel demo pipeline is introduced.
- Repeated clicks from the same Demo session are idempotent and reuse the same Lead.
- The follow-up screen only enriches that Lead with optional email, city, interest and contact preference.
- Public enrichment cannot overwrite normal Lead fields already completed by GrowVest staff.
- The Lead remains unassigned until GrowVest assigns the appropriate Advisor, after which the existing Lead workflow continues normally.

See `docs/PERSONALISED_GUEST_INVESTOR_DEMO_v0.34.7.md` and `RELEASE_VALIDATION_v0.34.7.md`.


### v0.34.7 Guest Demo Notification Session Hotfix

The Personalised Guest Investor Demo now treats `demo_investor` as Investor notification mode inside the shared notification bell. Demo sessions use the synthetic notification context and never attempt the Firebase-authenticated `/api/notifications` staff polling path. Staff notification polling is additionally gated by an active Firebase user. Installed Investor PWA cache: `v0.34.7-guest-demo3`.

The Personalised Demo hero heading is now white on Royal Trust Blue with a restrained Insight Yellow emphasis, replacing the previous black-on-blue treatment.

## v0.34.8 — Portfolio Gain/Loss Integrity & Investment Type Totals

Portfolio performance now uses one cost-basis-aware source of truth across the Investor App, Portfolio screen and verified portfolio snapshots. A Mutual Fund SIP in loss reduces the overall portfolio Gain/Loss; a stock with current value but missing purchase cost remains in Current Portfolio but is not treated as profit; cash is value-only; and ULIP premium is de-duplicated at policy level.

The Portfolio screen now includes **Investment Type Totals** for Mutual Funds, Equity Delivery, ULIP, PMS, Bonds, Fixed Deposits, Gold, ETFs, Real Estate, Cash and Other Investments. Each active category shows invested/known invested, current value and gain/loss. **Trading / Derivatives** stays separate and shows monthly turnover plus net realised P&L so trading activity never inflates long-term Total Invested or Bucket List corpus.

Valuation-only manual/generic updates preserve an already-known purchase cost instead of clearing it. Installed Investor PWA cache: `v0.34.8-portfolio-integrity1`.

See `docs/PORTFOLIO_GAIN_LOSS_DATA_INTEGRITY_v0.34.8.md`, `docs/PORTFOLIO_GAIN_LOSS_DATA_INTEGRITY_CODE_MANIFEST_v0.34.8.md` and `RELEASE_VALIDATION_v0.34.8.md`.


## v0.34.8 Mobile Investor Sign Out Hotfix

The phone Investor App now exposes a clear **Sign Out** action in the GrowVest centre menu and at the bottom of the mobile Profile screen. The Personalised Guest Investor Demo uses the same locations with **Exit Demo** instead. Real investors return to `/investor-login`; demo guests return to `/investor-demo` after the guest session is cleared. Installed PWA caches use `v0.34.8-mobile-signout1`.

## v0.34.9 — Investor Device Security & App Lock

Real Investors can now enable a phone-only **App Lock** from **Profile → Login & Security**. A 4 or 6-digit PIN is mandatory when App Lock is enabled, and supported mobile devices can optionally use the platform authenticator (Face ID / fingerprint / device verification) as the primary unlock method with PIN fallback. The lock can run every time the app returns, or after 5, 15 or 30 minutes. Guest Demo sessions are excluded.

Desktop/web Investor security is separate and device-specific. **Require sign-in after browser closes** is enabled by default and uses Firebase session persistence; the Investor can opt to keep that browser signed in. Desktop inactivity sign-out can be set to 15 minutes, 30 minutes, 1 hour or Off. Installed PWA caches use `v0.34.9-investor-security1`.

See `docs/INVESTOR_DEVICE_SECURITY_APP_LOCK_v0.34.9.md`, `docs/INVESTOR_DEVICE_SECURITY_APP_LOCK_CODE_MANIFEST_v0.34.9.md` and `RELEASE_VALIDATION_v0.34.9.md`.
