# GrowVest v0.34.31 Release Validation — Portfolio Summary, SIP and Monthly Progress

## Scope

This release is based on the user-supplied v0.34.30 multi-file upload build and preserves the sequential Fundbazaar bulk upload flow.

### 1. Current Portfolio reconciliation
- Investor profile summary now calculates Current Portfolio from the live active Portfolio Master positions when available.
- The verification helper uses the latest live NAV / valuation / price date, with snapshot date as fallback.
- Active Monthly SIP on the investor profile uses live Portfolio Master positions before stored profile summary fields.

### 2. Fundbazaar active SIP reconciliation
- Fundbazaar Client Wise Valuation may contain multiple simultaneous SIP instructions in the same scheme and folio.
- v0.34.30 kept only the latest SIP transaction amount for a holding, which can understate the active monthly SIP.
- v0.34.31 sums all SIP executions in the latest reliable monthly SIP cycle.
- If the current valuation month is still partial, the previous completed month remains the base unless the current observed SIP total has reached or exceeded that completed-cycle total.
- Nikhil sample fixture: the parallel HDFC Focused Fund SIPs of ₹2,000 and ₹5,000 are treated as ₹7,000/month; the complete sample reconciles to ₹23,000 rather than ₹21,000.

### 3. Month-by-month Portfolio Progress
- The Investor Portfolio now derives one latest verified snapshot per month.
- Completed months show month-end/latest verified closing value.
- Current month is labelled MTD.
- Each month separates Opening Value, Investment Added, Withdrawals, Net Contribution, Investment Gain/Loss and Closing Value.
- Investment Gain/Loss is calculated as Closing - Opening - New Money + Withdrawals, so fresh contributions are not reported as performance.
- The first available month intentionally leaves opening-based return blank when no earlier verified snapshot exists.

### 4. Existing daily bulk upload behavior retained
- Multiple Fundbazaar files are analysed one file per request.
- Multiple ready files are committed one analysed report per request.
- One failed file does not stop other ready files from being processed.
- Batch totals are finalized after the sequential file commits.

## QA

- `node --no-warnings scripts/qa/portfolio-progress-sip-fixture.mjs`
- `node scripts/qa/release-audit.mjs`
- `node --check` on changed non-JSX modules.

A full Next/Vercel build remains the final deployment validation where project dependencies are available.
