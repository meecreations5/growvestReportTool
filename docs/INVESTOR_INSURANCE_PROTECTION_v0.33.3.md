# GrowVest v0.33.3 - Investor Insurance & Protection Management

## Purpose

Version 0.33.3 adds Insurance & Protection as a first-class Investor record while keeping protection coverage financially separate from investment AUM/corpus. The module is intended for GrowVest staff to maintain protection data and for Investors to review their current policy position, upcoming premium obligations and renewal/expiry dates.

**Insurance cover is never added to investment corpus, portfolio current value, gain/loss or Bucket List corpus.** It is displayed as protection coverage only.

## Supported policy categories

The standard master includes Term Life, Whole Life, Endowment, ULIP Insurance, Health, Critical Illness, Personal Accident, Vehicle, Home, Travel, Cyber and Other. The `Other` category allows additional policy classes without changing the data model.

## Staff workflow

Staff can open **Portfolio Management -> Insurance & Protection** or use the **Insurance & Protection** tab inside an Investor profile.

For a selected Investor, staff can:

- Add a policy manually.
- Edit current policy information.
- Renew a policy without overwriting the previous record.
- Mark a policy Active, Grace Period, Expired, Lapsed, Cancelled, Claimed / Closed or Renewed.
- Upload the policy PDF/JPG/PNG through the existing secure Investor document workflow.
- Download a blank Insurance Excel template.
- Download a filled example containing illustrative data.
- Download the Manual Investment & Insurance explanatory guide.
- Preview and validate an Insurance Excel workbook before committing it.

## Standard fields

All policies support insurer, plan/product, policy number, policy holder, insured person/asset, relationship or asset detail, cover variant, start date, renewal/expiry date, cover/sum insured, premium amount/frequency, next premium due date, status, advisor/broker, reminders, riders/add-ons and notes.

Additional type-specific fields include:

- **Life / Term:** nominee/beneficiary, nominee relationship, policy term and premium-payment term.
- **Health:** covered members/family floater details.
- **Vehicle:** vehicle registration, make/model, IDV, Own Damage expiry and Third Party expiry.
- **Home:** property address/asset details.

## Excel import

The production workbook is `GrowVest_Insurance_Policy_Template_v0.33.3.xlsx`. The import is scoped to the Investor selected in the UI. It is preview-first and uses insurer + policy number as the update identity for existing policies.

The importer validates required fields and normalises dates, amounts, reminder configuration and status before writing. A workbook larger than 8 MB is rejected. Each committed row creates an insurance event and Investor activity-log record.

## Renewal history

A renewal creates a new policy record linked back to the previous policy. The previous record is marked **Renewed** and is retained. This preserves historical premiums, cover, insurer/plan changes and policy numbers instead of overwriting prior-year evidence.

## Reminders

The standard automatic reminder cadence is **60, 30, 15, 7 and 1 days before** the applicable due date. A policy may override those reminder offsets or disable automatic reminders.

The daily reminder job checks separate obligations for:

- Premium due date.
- Policy renewal / expiry date.
- Vehicle Own Damage expiry.
- Vehicle Third Party expiry.

Reminder events are deterministic and idempotent so the same policy/date/offset reminder is not created twice. When available, reminders are created for the Investor Portal user and assigned Advisor.

The job is exposed at `/api/cron/insurance-reminders` and is protected with the existing `CRON_SECRET`. Production should schedule it once daily. For GrowVest operations, morning India time is recommended.

## Investor Portal

Investors get a read-only **Insurance & Protection** page showing:

- Active policy count.
- Life cover.
- Health cover.
- Policies expiring within 30 days.
- Premiums due within 30 days.
- Policy list with nearest due obligation.
- Renewal history.

Investors cannot directly write to insurance collections from the browser.

## Documents

The staff **Policy Document** action creates an Insurance Policy document request with the insurance policy ID/number attached as metadata and uploads the file through the existing secure document flow. The document remains visible under the existing Access & Documents / Investor Portal Documents experience.

## Monthly Report

Draft Monthly Reports fetch an Insurance Protection Snapshot for the report cutoff date. The snapshot is persisted with the report so a completed/published report does not silently change later.

The web report, printable report and generated PDF display a Protection Snapshot with active policies, life cover, health cover, upcoming obligations and policy details. The report states that protection cover is separate from investment portfolio corpus.

## Security

`insurancePolicies`, `insurancePolicyEvents` and `insuranceReminderEvents` are server-managed Firestore collections. Direct browser reads/writes are denied. APIs authenticate Firebase sessions and enforce Admin/Super Admin or currently assigned Advisor scope; Investors can read only their own records via the authenticated server API.

## Deployment

1. Deploy the Next.js application.
2. Deploy updated Firestore rules.
3. Confirm `CRON_SECRET` remains a strong production secret.
4. Configure the production scheduler to call `/api/cron/insurance-reminders` once daily with the cron secret.
5. Verify notification delivery settings if push notifications are used.

No migration is required for existing Investors. Insurance collections are created as policies are added/imported.

## UAT checklist

1. Admin selects an Investor and adds one Health, Term Life, Vehicle and Home policy.
2. Validate health floater, nominee, vehicle OD/TP and property fields persist.
3. Download the blank template, filled sample and explanatory guide.
4. Upload a valid workbook, preview it, then import it.
5. Re-upload the same insurer + policy number and confirm preview says update rather than duplicate.
6. Renew a policy and confirm the previous record remains in Renewal History as Renewed.
7. Upload a policy document and confirm it is available in Access & Documents.
8. Confirm Investor Portal is read-only and shows only that Investor's policies.
9. Run the reminder endpoint with a test policy at a configured offset and confirm Advisor/Investor notifications are created once only.
10. Generate a draft Monthly Report and confirm the Protection Snapshot appears in web/print/PDF output.
11. Confirm insurance cover does not alter Portfolio Master current value, investment AUM, gain/loss or Bucket List corpus.

## Profile and consolidated Portfolio integration

Insurance & Protection is also surfaced outside the dedicated Insurance workspace. The Investor Profile Overview contains a compact Protection Snapshot, the Investor Portfolio tab places protection alongside investment holdings, and the Investor Portal Portfolio does the same for the Investor. The staff Portfolio Overview aggregates protection across all investors the signed-in user is authorised to access, including upcoming premium/renewal attention. These views are visibility layers only and never write protection cover into portfolio valuation or Bucket List corpus.
