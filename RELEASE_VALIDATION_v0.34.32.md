# GrowVest Release Validation — v0.34.32

## Scope
v0.34.32 fixes the Investor Profile withdrawal flow so mapped PMS holdings appear alongside Mutual Funds and can be planned/completed without applying Mutual Fund-only SIP controls.

The v0.34.31 Current Portfolio / SIP / monthly-progress reconciliation and the v0.34.30 multiple Fundbazaar upload hardening remain included.

## Validation completed

- PMS and Mutual Fund are both recognised as structured-withdrawal product types.
- Stock Delivery remains outside this structured redemption workflow.
- PMS withdrawal planning is amount-based and does not expose Continue/Pause/Stop SIP controls.
- Mutual Fund withdrawal planning retains Continue/Pause/Stop SIP controls.
- Server validation accepts PMS positions and still enforces Bucket List value limits and 100% mapping for a complete withdrawal.
- Completion supports unitless PMS positions by reducing current value by the confirmed amount.
- PMS completion does not overwrite `monthlySip`, `sipStatus`, or paused SIP fields.
- Withdrawal transactions retain `productType`, account reference and Bucket List context.
- Retry protection and Portfolio Master snapshot rebuild remain active.
- Multiple Fundbazaar file upload continues to use one analysed/committed report per request.

Run:

```text
npm run qa:pms-withdrawal
npm run qa
npm run qa:portfolio-progress
npm run qa:report-period
npm run qa:pms-freshness
npm run qa:opening-review
npm run qa:opening-verification
npm run qa:pdf-encoding
```

A full dependency install / Next production build should still be run in the normal deployment pipeline.
