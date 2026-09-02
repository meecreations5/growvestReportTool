# GrowVest v0.33.2 - Profile Withdrawal, Report Fetch and Delete Report Workflow

## Purpose

This release makes the Investor Profile the single operational source for planned withdrawals and cash needs. Monthly Reports read the Profile workflow and verified Portfolio Master instead of asking the Advisor to re-enter withdrawal figures.

## 1. Investor Profile is the withdrawal source

The Investor Profile contains **Withdrawals & Planned Cash Needs**. An Investor or authorised staff member can create one withdrawal plan for a Bucket List and select one or more Mutual Fund holdings mapped to that Bucket List.

Each selected fund stores its own instruction:

- Partial withdrawal or Complete holding withdrawal.
- Requested amount and/or units for a partial withdrawal.
- SIP Continue, Pause or Stop after the redemption.
- Planned withdrawal date and purpose.

A complete holding withdrawal is allowed only when that holding is 100% mapped to the selected Bucket List. A partial withdrawal cannot exceed the value/units currently mapped to that Bucket List. This prevents a withdrawal intended for one goal from silently reducing another goal.

All investments continue to follow the mandatory Bucket List rule: a specific Bucket List or **General Wealth (Default)**.

## 2. Planned versus actual

A request is non-financial until it actually executes.

Typical lifecycle:

`Requested -> Approved / In Process -> Complete Withdrawal & Update Portfolio -> Completed`

A planned request may appear in Monthly Reports immediately as a Profile action, including a future planned date, but it does not change Money Withdrawn, Current Portfolio Value, Bucket List corpus or Portfolio Gain / Loss.

## 3. Controlled completion

The Advisor uses **Complete Withdrawal & Update Portfolio** only after the redemption actually executes.

For each fund the Advisor can confirm the actual amount/units plus the common execution date and provider/reference details. GrowVest then:

1. reduces the selected holding;
2. applies SIP Continue / Pause / Stop;
3. adjusts the selected Bucket List allocation for a partial withdrawal;
4. creates a confirmed provisional redemption transaction;
5. rebuilds the verified Portfolio Master snapshot;
6. marks the Profile action Completed and investor-visible; and
7. records an audit event.

The completion route is retry-safe. A retry after the portfolio mutation does not subtract the same redemption again.

If a provider later supplies the same redemption, report cash-flow logic prefers the provider transaction and removes only the matching provisional action transaction from calculations. This prevents double-counting Money Withdrawn.

## 4. Monthly Report behaviour

The Advisor selects the Reporting Month independently of the generation date. For example, an August report may be generated between 1 and 5 September and still uses the August month-end cutoff.

Financial facts remain automatic from Portfolio Master and confirmed transactions:

- Opening Portfolio Value
- Current / Closing Portfolio Value
- Money Added This Month
- Money Withdrawn This Month
- Monthly SIP
- Portfolio Gain / Loss
- Goal / Bucket List progress

`Portfolio Gain / Loss = Closing Value - Opening Value - Money Added + Money Withdrawn`

### Profile actions in the report

The Report Builder has a separate **Investor Profile actions** section. These actions are auto-fetched and read-only. They are not copied into editable Advisor recommendations.

The section can show planned/in-process/completed withdrawals and other Profile actions. Draft/unpublished reports refresh relevant Profile actions for the selected reporting period. Published/historical report snapshots remain frozen.

Advisor recommendations remain a separate editable section for judgement, commentary and next steps only.

## 5. Investor visibility

The Investor Portal displays the same withdrawal lifecycle and fund-level instruction, including:

- Bucket List
- selected fund(s)
- partial/complete withdrawal
- requested/actual amount where applicable
- SIP Continue/Pause/Stop
- planned and actual dates
- status
- completed before/after portfolio impact

A completed action is therefore visible to both GrowVest staff and the Investor without re-entering the event in the report.

## 6. Trading account distinction

A sale inside a broker account is not automatically a withdrawal. Cash is treated as Money Withdrawn only when it actually leaves the portfolio/trading account for the Investor's bank. Trading Account Deposit / Withdrawal remains an explicit Profile/Action workflow.

## 7. Delete Report

Monthly Reports can now be deleted through a controlled server workflow.

Deletion requires a reason and `DELETE` confirmation.

- Admin and Super Admin can delete reports.
- Advisor deletion requires access to the assigned report plus elevated Monthly Reports permission.
- A published report requires Full Monthly Reports permission for an Advisor.
- Browser-side direct Firestore deletion is disabled.

Deleting a report removes the live Monthly Report, its stored PDFs, published version documents, report acknowledgements/download records and report notifications. It immediately disappears from the Investor Portal.

Deletion does **not** delete or reverse:

- Portfolio Master
- investment transactions
- Bucket Lists
- Investor Profile
- Investor Actions
- completed withdrawals
- SIP instructions already applied to Portfolio Master

Linked Investor Actions are preserved and detached from the deleted report. Email delivery history is retained as operational audit history and marked with the report-deletion details. A minimal `monthly_report_deleted` activity log records who deleted the report, when, the reporting month and the reason.

If the deleted report was the Investor's `latestReportId`, GrowVest points the Investor back to the newest remaining report or clears the latest-report fields when none remain.

## 8. Regeneration

After deletion, the same reporting month can be generated again. The new report rebuilds from the eligible verified Portfolio Master snapshot and current Profile actions for that reporting period; deleting the old report does not change the underlying financial history.
