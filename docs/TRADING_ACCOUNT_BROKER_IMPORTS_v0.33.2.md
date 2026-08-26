# Trading Account Native Broker Imports - v0.33.2 Phase 1

## Purpose

GrowVest now treats a broker Trading Account as a separate operating layer inside Portfolio Management. Delivery investments can roll into the Investor's long-term Portfolio Master, while depository movement and intraday/trading activity remain separately identifiable and do not become long-term corpus merely because turnover occurred.

One Investor may have multiple broker/demat accounts. GrowVest preserves the broker account identity on positions, trades, DP movement and dated broker-account snapshots so the same security can exist at more than one broker without losing provenance.

## Phase 1 native formats

### Bajaj Broking - Client Holding Report XLS/XLSX

Validated against a real Bajaj Financial Securities Limited Client Holding Report dated 25 Aug 2026.

Recognised native columns include:

- SCRIP NAME
- ISIN
- EXCHANGE
- DP HOLDING QTY
- TOTAL HOLDING QTY
- CLOSE RATE
- HOLDING VALUE

The report is treated as an authoritative delivery-holding valuation snapshot. GrowVest uses TOTAL HOLDING QTY when present and records the report/current value.

The native holding report does **not** contain purchase cost/average buy price. Therefore:

- GrowVest never fabricates invested amount, average cost, unrealised P&L or return.
- If an existing GrowVest holding already has a valid cost basis from earlier trade/cost data, that cost basis is preserved while quantity/current valuation is refreshed.
- A genuinely new holding from this report is saved with `costBasisStatus = pending` and `performanceAvailable = false` until a future trade/cost report supplies reliable purchase cost.
- The `TOTAL HOLDINGS VALUE` footer is never imported as a security.

Existing Bajaj Intraday/Trade Book support remains separate in `tradingTransactions`. Intraday turnover and realised P&L do not inflate the long-term Portfolio Master corpus.

### Angel One - DP Transaction Cum Holding Statement PDF

Validated against the supplied digital Angel One DP Transaction Cum Holding statement.

The digital PDF adapter extracts:

- Investor name
- Demat ID
- Statement/report period
- ISIN/security name
- dated DP credit/debit movement
- authoritative closing holding quantity
- closing holding value

The statement is a depository/reconciliation source, **not** a Trade Book or P&L report.

Therefore:

- closing delivery holding is written to `portfolioPositions` with source `angel_one`;
- DP credits/debits are written to `brokerDpTransactions`;
- DP records carry `classification = dp_movement` and `affectsTradingPnl = false`;
- GrowVest does not infer realized P&L, intraday trading or purchase cost from DP descriptions;
- the statement-reported closing balance is authoritative even if individual DP rows cannot be arithmetically reconciled in isolation.

The current Angel One adapter supports **digital/text PDFs** matching the supplied statement style. Image-only/scanned PDFs are intentionally not OCR'd in this phase.

## Data model

### `brokerAccounts`

One record per Investor + broker source + account reference. Stores broker/account provenance, latest statement/valuation dates and last successful import source.

### `brokerAccountSnapshots`

One dated broker-level snapshot for the account/report valuation date. Holds delivery value, position count, cost-basis pending count and DP movement count. Re-uploading the same account/date updates the same deterministic account snapshot rather than creating uncontrolled duplicate daily snapshots.

### `brokerDpTransactions`

Depository movement records such as IPO credit, settlement credit/debit and transfer movement. These records are deliberately separate from `tradingTransactions`.

### `portfolioPositions`

Delivery holdings remain in the common Portfolio Master position collection so they participate in the Investor's long-term portfolio/current corpus. Every native broker holding created in this phase carries `brokerAccountId` and `brokerAccountReference`.

### `tradingTransactions`

Intraday/trading records remain separate. Existing Bajaj Intraday support stores turnover, gross/net P&L and charges here, linked to the relevant broker account.

## Multiple broker accounts

The deterministic position identity includes the broker account reference for new broker positions. This allows an Investor to hold the same ISIN/security at multiple brokers without merging the broker-level positions into one database record.

The Trading Accounts centre can still show a consolidated Investor view while preserving the underlying account source.

## Daily workflow

1. Portfolio -> Daily Portfolio Update
2. Upload one or more supported native broker files.
3. GrowVest detects broker + report type.
4. GrowVest shows the external investor identity and suggested GrowVest Investor.
5. Admin/Advisor confirms mapping when required.
6. GrowVest validates account ownership and duplicate fingerprint.
7. Commit updates the broker account, delivery holdings and/or DP/trade records.
8. GrowVest rebuilds the Investor's current Portfolio Master snapshot.
9. Portfolio -> Trading Accounts shows broker-level delivery, DP movement, cost-basis gaps and intraday performance separately.

## Trading Accounts workspace

New navigation:

`Portfolio Management -> Trading Accounts`

The centre shows per account:

- broker/provider
- masked account reference
- delivery current value and position count
- cost-basis pending holdings
- DP movement count and latest DP movements
- current-month intraday trade count and net P&L
- latest valuation/statement date

## Portfolio Administration

A new `Broker Delivery` cleanup scope covers Angel One/future non-Bajaj broker delivery holdings. Bajaj Delivery remains its existing explicit scope for backward compatibility.

Full Portfolio Reset now includes:

- `brokerAccounts`
- `brokerAccountSnapshots`
- `brokerDpTransactions`

along with existing delivery positions, trades, mappings, fingerprints, snapshots, recovery state and other portfolio operational history. Investor/KYC/documents/goals/published Monthly Reports remain governed by the existing Full Portfolio Reset contract.

## Recovery

Broker account, account snapshot and DP-movement records are added to the portfolio import recovery journal. Rollback remains blocked when a newer import has already mutated the same broker state.

## Security

- Import and Trading Account APIs use the existing authenticated staff request gates.
- New broker collections are server-written only in Firestore rules.
- Advisors can read only records within their assigned Investor scope.
- Investor-facing reads remain restricted to the Investor's own records.
- The Trading Accounts UI masks long broker account identifiers.

## Phase 1 limitations / next adapters

Do not infer these from Holding or DP reports. They require their own native report adapters:

- broker Ledger / cash balance
- Contract Note
- broker P&L report
- full Trade Book for Angel One
- F&O/open positions
- margin report
- detailed statutory charges report

These should be added as separate adapters so GrowVest never guesses financial data from a source document that does not contain it.

## UAT

### Bajaj Client Holding Report

1. Upload the validated Bajaj Client Holding Report from Daily Portfolio Update.
2. Confirm detection = Bajaj Broking / Delivery Holdings.
3. Confirm investor identity suggestion is correct.
4. Confirm 6 sample holdings are detected from the supplied production-format test file.
5. Confirm report footer is not imported as a seventh holding.
6. Confirm valuation date resolves to 25 Aug 2026.
7. Confirm new holdings show cost basis pending rather than false P&L.
8. Re-upload a later valuation for the same securities and verify previously known cost basis is preserved.

### Angel One DP statement

1. Upload the supplied digital DP Transaction Cum Holding PDF.
2. Confirm detection = Angel One / DP Transaction Cum Holding.
3. Confirm Investor name and Demat ID are extracted.
4. Confirm closing LEAP INDIA-EQ holding = 44 and closing value = Rs 7,005 for the supplied test statement.
5. Confirm three DP movement rows are captured separately.
6. Confirm no intraday P&L/trade record is created from the DP rows.
7. Confirm the Trading Accounts centre shows the broker account and latest DP movement.

### Reset and recovery

1. Preview Full Portfolio Reset for the Investor and confirm broker account/snapshot/DP counts are included.
2. Perform reset with Super Admin confirmation in a test environment.
3. Verify broker-account records and native broker delivery/trading operational history are removed.
4. Verify published Monthly Reports and Goal definitions remain frozen/preserved per the existing reset contract.
