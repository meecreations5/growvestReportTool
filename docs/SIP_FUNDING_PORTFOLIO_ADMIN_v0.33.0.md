# GrowVest v0.33.0 — SIP Funding, Portfolio Administration & Manual Portfolio Excel

## Purpose

v0.33.0 reconciles several previously overlapping concepts into a simpler operating model and adds the workflows needed for SIP funding reminders and manually managed investor portfolios.

### Simple module meaning

- **Advisor Follow-up** — investment/advisory decisions that require discussion, consent or follow-through. Examples: SIP funding via withdrawal, redemption discussion, fund switch, SIP change, Goal/Bucket change.
- **Service Requests** — operational/account servicing. Examples: bank mandate problem, KYC update, nominee/bank/address/document request.
- **Bulk Data Upload** — Admin-only historical/master data migration. It is not used for the daily portfolio workflow.
- **Monthly Market Note** — a reusable monthly market commentary for Monthly Reports.
- **SIP Funding** — scheduled pre-debit funding checks. The investor response automatically routes to Advisor Follow-up or Service Requests when needed.

## SIP Funding workflow

A SIP reminder is configured once from **Investor → Portfolio → SIP Reminder** for a Mutual Fund holding.

Stored schedule fields include:

- SIP holding / position
- SIP amount
- monthly debit day
- debit bank name
- account last four digits only
- reminder timing: 30 / 14 / 7 / 5 / 3 / 1 days before and/or debit day
- assigned Advisor

The schedule remains active until staff changes or disables it.

### Investor response routing

| Investor response | Result |
| --- | --- |
| Funds Already Available | Funding status becomes Ready for SIP |
| I Will Add Funds | Funding check stays open; day-before follow-up is supported |
| Funds Added | Funding status becomes Ready for SIP |
| Need Withdrawal / Transfer | Creates an **Advisor Follow-up** linked to the SIP/investment |
| Discuss With Advisor | Creates an **Advisor Follow-up** |
| Bank / Mandate Issue | Creates a **Service Request** |

GrowVest does **not** automatically redeem, switch, transfer money or place an investment order. The workflow records the investor's funding response and routes follow-up work.

### Cron

Run once daily using the existing server-only `CRON_SECRET`:

`/api/cron/sip-funding-reminders`

Header:

`x-cron-secret: <CRON_SECRET>`

The cron creates deterministic in-app reminder notifications and avoids duplicate cycle reminders. It uses Asia/Kolkata calendar dates.

## Investor experience

Investor Portal includes **SIP Reminders** and the Dashboard can surface the nearest upcoming SIP debit. The Investor sees the amount, next debit date, masked bank details, funding status and response options.

## Advisor experience

**Advisory → SIP Funding** shows:

- due in the next 7 days
- Ready for SIP
- needs Advisor/servicing action
- awaiting investor confirmation
- direct links to the Investor portfolio and generated Advisor Follow-up / Service Request

## Investor Portfolio Administration

A separate Admin-only route is available from the Investor Portfolio:

`/investors/{investorId}/portfolio-admin`

This page groups portfolio data by operating source/type:

- Fundbazaar
- Bajaj Delivery
- Bajaj Trading
- ULIP
- Manual Portfolio
- Other / Generic

Admin/Super Admin can delete all holdings within a selected portfolio group using the existing audited Portfolio Bulk Cleanup flow. Trading has its own explicit deletion confirmation. Investor Profile, KYC, Goals/Bucket Lists, Documents, Meetings, Actions and published Monthly Reports are preserved.

## Manual Portfolio Excel

Use **Investor → Portfolio Administration → Upload Manual Portfolio Excel** when GrowVest maintains an account manually rather than receiving a supported provider file.

The Investor is selected before upload, so the workbook does not need Investor Name/PAN.

Supported current-holding columns include:

- Investment Type
- Investment Name
- Provider
- Investment Mode
- Folio / Account No
- ISIN
- Symbol / Exchange
- Units / Quantity
- Average Buy / Purchase NAV
- Invested Amount
- Current NAV / Rate
- Current Value
- Valuation Date
- Monthly SIP
- Goal / Bucket List
- Notes

### Import modes

**Merge / Update Manual Portfolio**

- updates matching Manual holdings
- adds new Manual holdings
- leaves missing Manual holdings untouched

**Replace Manual Portfolio**

- replaces only current holdings whose source is `manual`
- Fundbazaar, Bajaj, ULIP provider imports and other sources remain untouched

Existing Goal/Bucket allocation is preserved when the Excel Goal field is blank. A valid exact Goal/Bucket name can assign a new/manual holding.

The Manual Portfolio workbook updates **current holdings**, not historical transaction ledgers.

## Security

- SIP schedule/cycle collections are server-managed; browser direct reads/writes are denied.
- SIP and manual portfolio APIs require authenticated Firebase ID tokens and preserve typed 401/403 errors.
- Manual Portfolio Administration and template download are Admin/Super Admin only.
- Account details store only the last four digits for the SIP debit account.
- No investment execution occurs automatically.

## UAT

1. Open a Mutual Fund SIP holding and configure a 5-day reminder.
2. Confirm it appears under **Advisory → SIP Funding** and **Investor Portal → SIP Reminders**.
3. Respond `Funds Already Available`; verify status becomes Ready for SIP.
4. Use a new cycle/test schedule and respond `Need Withdrawal / Transfer`; verify an Advisor Follow-up is created.
5. Respond `Bank / Mandate Issue`; verify a Service Request is created.
6. Run the SIP reminder cron with `CRON_SECRET`; verify only due schedules receive deterministic notifications.
7. Open **Investor → Portfolio Administration** as Admin and verify each source/type group is separate.
8. Delete a test Fundbazaar/Manual group and verify unrelated sources, Goals and published reports remain.
9. Download the authenticated Manual Portfolio Excel template.
10. Preview/import with Merge mode; verify only source=`manual` holdings change.
11. Import a second workbook in Replace mode; verify missing Manual holdings are removed while provider imports remain.
12. Verify an Advisor cannot access Portfolio Administration or the Manual Portfolio template/import API.
