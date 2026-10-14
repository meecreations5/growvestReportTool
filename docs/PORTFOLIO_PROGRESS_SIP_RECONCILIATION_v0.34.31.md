# Portfolio Progress & SIP Reconciliation — v0.34.31

GrowVest now separates three concepts that were previously easy to confuse: the latest live portfolio value, the monthly review-period performance, and the investor's active recurring SIP commitment.

## Latest Current Portfolio
The current portfolio is taken from active Portfolio Master positions. Historical Wealth Review values are not used as a substitute for the live current value.

## Fundbazaar SIP
Fundbazaar can report more than one eSIP transaction for the same scheme and folio. Active Monthly SIP is derived from the full reliable monthly SIP cycle rather than only the single latest SIP row. This prevents parallel mandates from being dropped.

## Monthly Portfolio Progress
For each available month, GrowVest selects the latest verified snapshot in that month. It then shows opening value, external money added, withdrawals, net contribution, investment movement and closing value. The current month is marked MTD. Historical calculations use stored snapshots and confirmed portfolio cash-flow transactions; they do not reconstruct history from today's portfolio.
