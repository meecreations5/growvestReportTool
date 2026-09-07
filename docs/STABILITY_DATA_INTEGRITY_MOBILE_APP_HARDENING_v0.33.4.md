# GrowVest v0.33.4 - Stability, Data Integrity & Mobile App Hardening

## Purpose

v0.33.4 is a stabilisation release for the GrowVest Investor & Monthly Report Tool. It hardens report lifecycle integrity, Insurance/Protection operational reliability and the Investor mobile/PWA experience before additional large modules are added.

The release keeps the v0.33.3 Investor Insurance & Protection functionality and the v0.33.3 Monthly Report regeneration hotfix as its baseline.

## 1. Monthly Report data integrity

### Canonical report month identity

An editable draft now follows a canonical Firestore ID of `InvestorId_YYYY-MM`. If the reporting month changes, the authenticated migration route moves the draft to the new canonical ID and updates linked report references. Published reports cannot be moved this way.

This prevents a draft from displaying August while remaining stored under a September document ID, and prevents duplicate reports for the same Investor/month.

### Concurrent/stale edits

Monthly Report saves carry the report version. If a second session has already written a newer version, an older browser session is blocked from overwriting it and must refresh first.

### Publish idempotency

Publishing uses a server-side publication claim with a TTL. Repeated/parallel requests cannot independently publish the same source version and create duplicate report versions/notifications.

### Delete and recreate safety

Report deletion is journaled in `reportDeletionJobs`. Firestore report cleanup completes before best-effort secure Storage cleanup. If the report data is already deleted but Storage cleanup fails, the same delete action can safely retry the pending file cleanup without resurrecting the report.

Portfolio Master, Bucket Lists and Investor Actions remain preserved as required by the report-delete contract.

### Zero-closing-balance month

A Monthly Report may close at ₹0 when there is verified evidence that the portfolio was fully exited during the reporting month. A random/empty ₹0 report is still blocked. Exit evidence can come from verified transactions, exited holdings, withdrawals, opening snapshot information or report fund movement.

### Download counter

Monthly Report PDF download count uses Firestore `FieldValue.increment(1)` so concurrent downloads cannot lose increments.

## 2. India business-date hardening

Newly hardened date defaults use `businessDateKey()` with the **Asia/Kolkata** timezone. This removes the UTC-midnight issue where a GrowVest user working between 00:00 and 05:30 IST could receive the previous calendar date from `toISOString()`.

Operational UAT should still verify all older screens whenever they are changed in future releases so remaining legacy local-date code is progressively standardised.

## 3. Insurance & Protection reliability

### Overdue and catch-up reminders

Insurance reminders now distinguish normal upcoming reminders from overdue reminders. Overdue premium/renewal attention takes priority and is emitted as `insurance_due_overdue`. Catch-up stages prevent a missed cron run from permanently losing the next useful reminder milestone.

### Investor lifecycle pause

Disabling/deleting an Investor pauses:

- SIP reminder schedules governed by the existing lifecycle workflow
- Insurance reminders
- Meeting reminders
- scheduled Monthly Report/email deliveries

Re-enabling an Investor restores only items that were paused by the lifecycle action, preserving unrelated manual status changes.

### Duplicate prevention and validated status

Manual Insurance policy creation/update uses the stable policy identity and rejects accidental duplicate insurer/policy-number records. Policy status changes are validated against the approved Insurance status master on the server.

### ULIP linkage

Insurance records of type `ULIP Insurance` may link to the corresponding Portfolio ULIP policy. Protection cover remains separate from investment current value/AUM; the link is for identity and operational consistency, not double counting.

### Excel import journal

Insurance Excel commits use an `insuranceImportBatches` journal and stable import-batch identity. Row events/activity records are keyed to the batch so retries are traceable and duplicate operational history is reduced.

## 4. Investor Mobile App hardening

The Investor portal is treated as a mobile application/PWA rather than a responsive website menu.

### Fixed mobile navigation

The bottom navigation is exactly five slots:

1. Home
2. Portfolio
3. Goals
4. Reports
5. More

Notifications are intentionally removed from the fixed bottom bar and remain available from the persistent header bell and the More menu.

### More menu and tablet behaviour

The fixed bottom navigation and More sheet use the same `lg` breakpoint contract, preventing the previous tablet state where the More button could remain visible while its sheet was hidden by an earlier breakpoint.

### Safe-area handling

The Investor shell reserves bottom space and applies safe-area padding so content can scroll above the fixed app navigation on iPhone/Android/PWA layouts.

### Protection navigation

Insurance & Protection remains available as a dedicated Investor route and through Portfolio/Protection surfaces without consuming a sixth primary bottom-navigation slot.

## 5. PWA cache hardening

Service-worker cache identities are bumped to:

- `growvest-investor-v0.33.4`
- `growvest-pages-v0.33.4`

This forces installed Investor PWAs to move away from old cached navigation/application-shell assets when the service worker activates.

## 6. Security/data model notes

- Insurance cover is never included in investment corpus, AUM, Current Portfolio Value or Bucket List corpus.
- Monthly Report month migration is server-authorised and blocked for published reports.
- Insurance financial/protection collections remain server-managed under the existing Firestore security model.
- Report deletion does not delete Portfolio Master or Bucket List definitions.
- Lifecycle pause flags are scoped so only lifecycle-paused records are automatically resumed.

## 7. Deployment checklist

1. Replace the application with the v0.33.4 release package.
2. Review environment variables against `.env.example`.
3. Deploy updated Firestore rules/indexes/Storage/Functions using the project's existing deployment procedure.
4. Restart the Next.js application.
5. On mobile/PWA test devices, reopen/reload the app so the v0.33.4 service worker activates.
6. Run `npm run qa`.
7. Run the normal project lint/build checks in the deployment environment where dependencies and production environment variables are available.

## 8. Mandatory UAT

### Monthly Reports

- Create an August draft, save it, change the month to September and confirm the URL/document becomes the September canonical report.
- Confirm moving a draft into an already-existing Investor/month is blocked.
- Open the same draft in two sessions; save session A and confirm stale session B cannot overwrite it.
- Complete/publish a report and confirm rapid repeated Publish requests do not create duplicate versions/notifications.
- Delete a report, recreate the same month and confirm Portfolio Master rehydrates correctly.
- Test a legitimate fully-exited month with ₹0 closing corpus and verified exit evidence.
- Confirm a new empty report with ₹0 and no exit evidence is blocked.

### Insurance

- Add the same policy manually twice and confirm duplicate protection.
- Test annual premium overdue while policy expiry is still in the future; overdue premium must receive priority.
- Test Health annual renewal, Term annual premium, Vehicle OD/TP separate dates and policy renewal history.
- Disable an Investor and confirm Insurance/Meeting/scheduled-delivery workflows no longer send reminders.
- Re-enable and confirm only lifecycle-paused items resume.
- Test ULIP Insurance linkage without adding insurance cover to Portfolio value.

### Investor mobile app

Test at minimum:

- 360px Android Chrome/PWA
- 390px/430px iPhone Safari/PWA
- 768px tablet
- 1024px desktop transition

Confirm:

- exactly five fixed bottom-navigation controls
- More never wraps to a second row
- Notification bell works from the header
- More sheet opens on phone and tablet widths below `lg`
- final page content scrolls fully above the bottom bar
- Portfolio/Goals/Reports selected-state behaviour is correct
- Insurance & Protection remains accessible without adding a sixth navigation item

## 9. Verification status

The packaged release is intended to pass the repository static release audit. Full Next.js production build/lint still needs to be run in the normal local/CI environment if dependencies are not installed in the packaging environment.
