> **Current Fundbazaar rule (v0.32.7):** Daily Fundbazaar Portfolio Master updates use **Client Wise Valuation Report.xlsx only**. Portfolio Ledger is retained only as historical documentation/recovery context and is not applicable for new imports. Exact-content duplicates are skipped; newer/different files for the same investor are allowed.

# GrowVest Daily Portfolio Master & Monthly Reporting

## Scope

Version 0.31.0 adds a permanent daily portfolio layer without replacing the existing Monthly Report workflow. Investors can view the latest verified portfolio snapshot in the portal while staff continue to create, review, preview, publish and share monthly reports through the existing flow.

## Daily operating flow

1. Operations opens **Portfolio Management → Daily Portfolio**.
2. Fundbazaar client-wise valuation reports can be selected together in one batch.
3. GrowVest parses each report, detects duplicate files, and resolves the Fundbazaar client to a verified GrowVest investor mapping.
4. Existing mappings are reused automatically. New/ambiguous names require a one-time staff confirmation; known folios and ISINs are used as ownership checks.
5. Verified imports update current positions and transaction history while preserving existing Goal/Corpus allocations.
6. New and exited positions are identified. Expected mapped investors missing from the batch are listed without zeroing their last portfolio.
7. A verified daily snapshot is created for every affected investor. Investor Portal portfolio values update from the latest positions/snapshot.

Fundbazaar Portfolio Ledger is the recommended primary daily Fundbazaar source. Client Wise Valuation remains supported as an optional/legacy valuation input. The Ledger supplies investor/PAN identity, holdings and transaction reconciliation from one file while preserving the permanent Portfolio Master allocation state.

## Portfolio Master

Current positions are stored separately from transactions and daily snapshots. Current supported position types are Mutual Fund, Delivery Stock, ULIP and Other. The data model is future-ready for PMS, bonds, fixed deposits, gold and real estate.

### Mutual funds

A scheme/folio can be **SIP**, **Lump Sum**, or **Both**. Transaction records preserve transaction date, type/mode, purchase amount, purchase NAV and units. The current position consolidates invested amount, units, latest NAV, NAV date, current value, gain/loss, return and monthly SIP.

### Delivery stocks

Delivery holdings record average buy rate, quantity, invested amount, current rate/value, unrealised P&L and return. Staff can record a partial/full delivery sale; the holding quantity/cost basis is reduced and realised P&L is retained in transaction history. Delivery holdings can support General Wealth or a Goal/Bucket List.

### Intraday trading

Intraday is a separate trading ledger, not a long-term investment position. Manual closed trades currently record buy/sell rate, quantity, brokerage/taxes/charges, gross P&L and net P&L, and update the month summary. Intraday realised profit is not automatically counted in Goal/Bucket List corpus.

### ULIP

v0.32.2 enables ULIP import and policy tracking. One policy is stored once in `ulipPolicies` and can contain multiple underlying fund positions in `portfolioPositions`. Policy records track insurer, policy number, plan, start/maturity dates, premium/frequency, total premium paid, sum assured/status, current fund value and fund count. Fund positions track units, NAV/date, fund value and persistent Goal/Bucket allocation. When only policy-level premium is available, GrowVest does not fabricate fund-level investment return. Exact insurer aliases still require validation against real provider exports.

## Goals, General Wealth and allocation

Goals/Bucket Lists are optional. An investor with no defined goal remains valid and their unallocated holdings appear as **General Wealth Corpus**. Multiple investments can be assigned to a single goal. The first UI version allocates one holding 100% to one goal; the stored `goalAllocations` structure supports percentage allocations in a later UI iteration.

## Surplus and loans

Monthly surplus supports fixed amount or percentage of income. Surplus can be allocated by fixed amount or percentage to SIP, Lump Sum, top-up, direct equity, loan repayment/prepayment, credit-card repayment, emergency fund, insurance, Goal/Bucket List, tax reserve, cash reserve, trading capital, or custom purpose. The UI shows total allocated and unallocated/over-allocated warnings.

Loan records include original amount, outstanding amount, EMI, interest rate, remaining tenure, extra repayment and target closure date.

## Monthly reporting integration

The existing Monthly Report creation and delivery flow is retained.

For a new report, GrowVest can load the latest **verified portfolio snapshot on or before the report month-end date**. The report source also loads the latest verified snapshot before the month as the opening position, transactions within the report month, and the intraday monthly summary.

The generated draft can populate:

- closing portfolio/current corpus
- total invested and gain/loss
- opening portfolio when a prior snapshot exists
- known new money and withdrawals
- investment gain separated from known cash flows
- holdings and asset allocation
- Mutual Fund SIP/Lump Sum/Both detail
- Goal/General Wealth progress
- intraday summary, kept separate from long-term portfolio returns
- loan position and surplus allocations

If no prior verified snapshot exists, the system does not manufacture a market-performance number; it infers a baseline from known cash flows and leaves investment gain at zero until a reliable opening snapshot exists.

Advisor recommendations/actions remain editable. Unresolved actions from the previous report can be carried into the next report with recommendation type, investor decision, priority, due date and status.

Published reports remain frozen under the existing report version/publishing model.

## Key Firestore collections

- `portfolioPositions`
- `investmentTransactions`
- `portfolioSnapshots`
- `portfolioSnapshotPositions`
- `portfolioImports`
- `portfolioImportFiles`
- `portfolioFileFingerprints`
- `externalInvestorMappings`
- `tradingTransactions`
- `tradingMonthlySummaries`
- `ulipPolicies`

Existing investor/report/meeting/document collections continue to be used.

## Deployment

Deploy Firestore rules and indexes included with this version before UAT:

```bash
npm run firebase:deploy
```

Verify the environment-specific Firebase project before running deployment.

## UAT checklist

- Import several Fundbazaar client-wise valuation files in one batch.
- Confirm one new investor mapping, then re-import a later report and verify automatic mapping.
- Confirm duplicate upload is rejected without duplicate transactions.
- Confirm SIP/Lump Sum/Both classification and NAV/current-value totals.
- Assign multiple holdings to one goal and confirm goal snapshot totals.
- Leave another investor without goals and confirm General Wealth Corpus display.
- Add a Delivery holding and record a partial sale; verify remaining quantity/value and transaction history.
- Add a closed Intraday trade and verify gross P&L, charges and net monthly P&L.
- Configure fixed and percentage surplus allocations and verify unallocated/over-allocation warnings.
- Create a Monthly Report and confirm it uses the verified snapshot for the report period without changing the existing preview/publish/share workflow.
- Publish a report, update the next day's portfolio, and confirm the published report remains unchanged.

## Known adapter boundary

The **Bajaj Broking import framework is enabled in v0.32.1** for safe Delivery and Intraday/Trade Book shapes, with PAN/client-code matching, Delivery portfolio updates, separate trading records, recovery controls, and persistent Goal/Bucket allocation. Because a real Bajaj export sample has not yet been supplied, the exact production column aliases still require validation against one real Holdings file and one real Trade Book/P&L file.

The **ULIP import framework is enabled in v0.32.2** with policy-level tracking, multiple underlying funds, PAN/policy identity matching, persistent Goal/Bucket allocations, recovery controls and Portfolio/Monthly Report integration. Provider-specific insurer aliases and complete-snapshot semantics still require validation against actual insurer exports.

## v0.31.3 — Investor Portfolio Experience

- Investor Portfolio now exposes investment type/mode, latest NAV or market rate, valuation date, source freshness, gain/loss, Goal/Bucket List, and recent investment activity.
- Fundbazaar valuation refreshes preserve the prior NAV/value so the portal can show NAV movement after the next fresh import.
- Goal/Bucket List assignment is stored on the permanent portfolio position, audited when staff changes it, preserved by later imports, and reflected in goal totals/snapshots.
- Investor Goals & Bucket List cards use the latest verified portfolio snapshot totals rather than requiring repeated manual corpus entry.
- Portfolio movement compares verified snapshots and separates known fresh investment/withdrawals from estimated market/valuation movement.
- Monthly report portfolio rows now carry investment type, investment mode, NAV/rate and valuation date from the portfolio source snapshot.
- Published investor report fallbacks retain investor-visible/completed Firestore constraints to avoid permission-denied errors when the ordered index is unavailable.
- Legacy report Data Import accepts optional type/mode/provider/goal/ISIN/folio/NAV/date columns. This does not replace provider-specific Portfolio Master import adapters.

## v0.31.5 — Unified Daily Portfolio Update Foundation

The Daily Portfolio screen now uses one upload surface instead of a Fundbazaar-only presentation.

### Daily admin workflow

1. Select or drag all `.xls` / `.xlsx` portfolio reports into **Daily Portfolio Update**.
2. GrowVest reads the file contents and detects the source/report signature. The filename is not used to decide investor ownership.
3. Production-ready Fundbazaar Client Wise Valuation and Portfolio Ledger reports continue through duplicate checking and saved investor matching.
4. Exact duplicates are skipped automatically.
5. Saved Fundbazaar mappings are auto-verified; only new/unmatched identities require an investor decision.
6. The screen defaults to **Issues only** when exceptions exist, so normal ready files do not require daily review.
7. **Update Ready Portfolios** processes the currently ready Fundbazaar valuation and ledger files even if other detected files still require attention.

### Detection currently available

- Fundbazaar — Client Wise Valuation: detected and import-enabled.
- Fundbazaar — Portfolio Ledger: detected and import-enabled with PAN identity mapping and transaction reconciliation.
- Fundbazaar — Excel web-wrapper: detected with a specific `_files/sheet001.htm` package warning.
- Bajaj Broking — Delivery Holdings: enabled with defensive content-based aliases; real Bajaj export validation still required before production sign-off.
- Bajaj Broking — Intraday / Trade Book: enabled for paired closed-trade rows and balanced BUY/SELL rows; real Bajaj export validation still required before production sign-off.
- ULIP — portfolio-style workbook: import-enabled for the GrowVest standard shape and defensive common provider aliases; exact insurer-export validation remains required.
- GrowVest Standard Import workbook: detected; generic multi-source automatic commit remains pending.

Detection is intentionally separated from importing. A report that can be identified but whose adapter is not production-ready is left untouched and shown as an exception rather than being guessed into the Portfolio Master.


## v0.31.6 — Fundbazaar Portfolio Ledger Adapter

Fundbazaar Portfolio Ledger is now a production-ready input in the unified Daily Portfolio Update flow. The adapter reads the scheme summary and per-folio transaction sections, captures the external investor name and PAN, and stores the report period for reconciliation.

The Ledger contributes transaction/reconciliation data including SIP/eSIP, purchases, redemptions, switches, transaction NAV/rate, units, invested amounts, current units/value, ABS return and XIRR. When a Client Wise Valuation position already exists, the Ledger reuses that same Portfolio Master position using folio plus ISIN/scheme matching. This avoids a second holding when the Ledger does not carry ISIN.

Source precedence is intentional: Client Wise Valuation is preferred for precise current NAV/current value when its valuation date is the same or newer, while the Ledger stores the reconciled investment basis, units and transaction history. If no current valuation exists, Ledger market value and derived NAV can act as a fallback.

A confirmed Ledger mapping also stores a PAN identity alias. Future Ledger uploads can therefore auto-match through the saved PAN mapping, while Client Wise Valuation continues to use the saved Fundbazaar client-name identity. Exact-file fingerprints and canonical transaction keys keep both report types idempotent.
