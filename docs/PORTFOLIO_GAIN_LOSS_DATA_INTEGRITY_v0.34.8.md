# GrowVest v0.34.8 — Portfolio Gain/Loss Data Integrity & Investment Type Totals

## Objective

Make portfolio performance trustworthy when holdings arrive from multiple sources and make the top-level Total Invested figure easy to reconcile by investment type.

## Portfolio performance source of truth

Long-term portfolio performance is calculated from active portfolio positions using a cost-basis-aware rule:

- Current Portfolio Value includes the current value of active portfolio holdings.
- Total Invested includes only holdings with a genuine recorded cost basis.
- Gain / Loss for a holding is Current Value minus recorded Invested Amount.
- A Mutual Fund SIP showing a loss reduces the Mutual Fund gain/loss and therefore reduces the overall portfolio gain/loss.
- A delivery stock with current market value but no purchase cost is not treated as 100% profit. Its return remains pending until the cost basis is available.
- Cash contributes to current portfolio value but does not create investment gain/loss.
- ULIP invested amount is based on premium paid and is counted once per policy even when the policy contains multiple underlying funds.

When any active investment holding has market value but no usable cost basis, the UI labels the summary as Known Invested / Gain-Loss on Known Cost and shows how many holdings are pending cost basis.

## Valuation-only update protection

A price/NAV refresh must not erase previously known purchase cost. The following update paths preserve the existing cost basis when the incoming update contains current valuation but no new purchase-cost value:

- Manual portfolio position update
- Investor manual portfolio import in merge mode
- GrowVest Standard / generic holding update path
- Broker/import valuation refresh paths that reuse the generic holding merge

This prevents a market-value refresh from turning the full current value into reported profit.

## Investment Type Totals

The Portfolio screen now shows a reconciliation table/section with one line per active long-term investment category, including:

- Mutual Funds
- Equity - Delivery
- ULIP
- PMS
- Bonds
- Fixed Deposits
- Gold
- ETFs
- Real Estate
- Cash
- Other Investments

Each line shows:

- Holding count
- Total Invested / Known Invested
- Current Value
- Gain / Loss
- Return percentage when a cost basis exists
- Monthly SIP for Mutual Funds where available
- Cost-basis-pending indicator where applicable

The long-term table footer reconciles to the same Current Portfolio, Total/Known Invested and Gain/Loss figures shown in the top summary cards.

## Trading / Derivatives

Trading and derivatives stay outside long-term Total Invested and Bucket List corpus.

The Trading / Derivatives line shows monthly activity separately:

- Trade count
- Turnover
- Net realised P&L

Turnover is an activity measure, not an invested-wealth value, and therefore never inflates Total Invested.

## Integrity scenario verified

Example:

- Mutual Fund SIP: Invested 100,000; Current 90,000; Gain/Loss -10,000
- Equity Delivery: Invested 300,000; Current 350,000; Gain/Loss +50,000
- ULIP premium paid: 75,000; Current fund value 82,500; Gain/Loss +7,500
- Another stock: Current value 500,000; purchase cost missing
- Cash: 10,000

Expected result:

- Known Invested: 475,000
- Gain/Loss on known cost: +47,500
- Missing-cost stock remains in Current Portfolio but contributes zero to reported gain/loss until its cost is supplied
- SIP loss is fully included in the overall result
- Cash does not create gain/loss

This scenario was executed against `src/lib/portfolioPerformance.js` during release validation and the investment-type rows reconciled exactly to the portfolio summary.
