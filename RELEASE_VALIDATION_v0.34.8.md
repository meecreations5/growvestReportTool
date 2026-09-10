# Release Validation — v0.34.8 Portfolio Gain/Loss Integrity & Investment Type Totals

## Scope

This release verifies portfolio Gain/Loss across Mutual Funds/SIP, Equity Delivery, ULIP, cash and missing-cost holdings, and adds investment-type-level reconciliation totals. Trading / Derivatives remain separate from long-term invested wealth.

## Automated release audit

Run:

```bash
npm run qa
```

Expected: all assertions pass with zero failures.

## Functional calculation checks performed

A direct scenario test was executed against `src/lib/portfolioPerformance.js` with:

- one Mutual Fund SIP in loss
- one delivery stock in gain
- one delivery stock with current value but missing purchase cost
- one ULIP policy represented by two fund positions
- one cash position

Verified:

- SIP loss reduces overall Gain/Loss
- missing stock purchase cost is excluded from Gain/Loss instead of being treated as profit
- missing-cost stock current value remains part of Current Portfolio
- ULIP premium is counted once per policy
- cash contributes to current value but not investment performance
- investment-type totals reconcile exactly to portfolio summary totals

## Source syntax check

Changed JavaScript / JSX files are parsed with the TypeScript parser in JSX mode to detect syntax diagnostics before packaging.

## PWA cache

- `growvest-investor-v0.34.8-mobile-signout1`
- `growvest-pages-v0.34.8-mobile-signout1`

## Deployment note

No new Firebase Function is required specifically for this portfolio calculation/UI release. Normal application deployment is sufficient. Firestore indexes/rules are unchanged by v0.34.8.

## Final validation result

- Release audit: **363 passed, 0 warnings, 0 failures**
- JavaScript/JSX syntax parse: **424 source files parsed, 0 syntax failures**
- Portfolio performance scenario: **PASS**

## Mobile Investor Sign Out Hotfix

- [x] Phone GrowVest action sheet exposes **Sign Out** for authenticated Investors.
- [x] Phone GrowVest action sheet exposes **Exit Demo** for Guest/Demo Investors.
- [x] Mobile Profile exposes the same explicit exit action.
- [x] Real Investor exits to `/investor-login`.
- [x] Demo Investor exits to `/investor-demo` after clearing the guest session.
- [x] Existing logout cache/session cleanup is retained.
- [x] Installed Investor PWA cache key bumped to `v0.34.8-mobile-signout1`.
