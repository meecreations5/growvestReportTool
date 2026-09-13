# GrowVest v0.34.14 - GrowVest Signature Investor Report

## Purpose

v0.34.14 locks the investor-facing report design approved for the GrowVest app launch and removes the first-report workflow race that could surface the Opening Wealth Review protection as a console/user error.

## Approved report visual system

The new system default template is **GrowVest Signature**. It uses the approved GrowVest brand palette:

- Royal Trust Blue: `#1F4ED8`
- Electric Sky-Blue: `#0CC0DF`
- Deep Premium Black: `#0B0B0F`
- Strategic Red: `#E53935`
- Insight Yellow: `#F5B301`
- Soft Gray: `#F4F6F9`
- Medium Gray: `#6B7280`
- White: `#FFFFFF`

Positive emphasis inside the Signature report uses the blue/cyan GrowVest system rather than introducing an unrelated green accent. Strategic Red remains reserved for negative/attention states and Insight Yellow for due/review states.

## Page architecture

The GrowVest Signature template follows the approved reference layout:

1. Cover - Opening Wealth Review or Monthly Wealth Review
2. Wealth at a Glance
3. Asset Allocation
4. Bucket List & Wealth Goals (one page per goal when required)
5. Investment Portfolio (continued pages when required)
6. Performance / Your Starting Position
7. Protection Overview
8. GrowVest View
9. Your Next Steps
10. Report Information & Disclaimer only when the legal text needs a dedicated page

The Opening Wealth Review deliberately does not invent month-on-month performance. It presents the verified opening position and explains that monthly comparison begins with the next comparable Wealth Review.

## Renderer parity

The design is implemented in both investor-report render paths:

- Browser/A4 preview: `GrowVestSignatureReportDocument.js`, selected by `MonthlyReportPrintDocument.js`
- Secure server PDF: `reportPdf.js`, selected by the same frozen template snapshot

Existing historical report snapshots continue to resolve their original template rather than inheriting the new default design.

## First report UX protection

The server-side rule requiring an Opening Wealth Review before a first Monthly Wealth Review remains in place. The create-report UI now waits until report-history detection is fully resolved before enabling save/autosave.

If the investor list/profile arrives after the report-history query begins, the workflow does not mark first-report detection as complete. This prevents a Monthly draft from racing into `saveMonthlyReport()` before the UI has converted it to the Opening Wealth Review.

The user-facing fallback message is now a workflow message rather than the raw protection exception.

## Navigation naming

The staff left navigation is restored to **Monthly Reports** so the launch does not change the familiar location of the module. Inside the workspace, report types remain:

- Opening Wealth Review
- Monthly Wealth Review

The reports dashboard title is **Monthly Reports & Wealth Reviews**.

## Data rules retained

v0.34.14 does not change the v0.34.13 data-integrity rules:

- Portfolio Master remains authoritative for current corpus, invested value, active SIP and holding-to-goal allocation.
- Goal Master remains authoritative for goal name, target, priority and timeline.
- Opening baseline and pre-publish reconciliation remain mandatory.
- Goal allocation effective dates remain preserved.
- `GV-OWR` / `GV-MWR`, `v001` versioning and structured report storage/filenames remain unchanged.

## Secure PDF renderer

Secure PDF renderer version: `2.4.1`.

Installed Investor PWA cache: `v0.34.14-signature-report2`.


## Locked visual reference

The launch-approved visual direction is frozen in `docs/reference/growvest_signature_locked_reference_v0.34.14.png` and specified in `docs/GROWVEST_SIGNATURE_LOCKED_VISUAL_REFERENCE_v0.34.14.md`. The Signature cover now uses the packaged `public/brand/growvest-wealth-review-cover.jpg` lifestyle fallback so the browser and secure PDF reflect the approved cover composition rather than an abstract placeholder.
