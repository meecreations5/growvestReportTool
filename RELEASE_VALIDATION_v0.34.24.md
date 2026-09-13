# GrowVest v0.34.24 Release Validation

## Scope

Report Renderer Root Reconciliation for the recurring Opening Wealth Review alignment and cover-clarity issues.

## Validation requirements

- Secure PDF callouts use the shared `drawSignatureCallout()` helper for Starting Point, Performance information and Protection notices.
- Closing banner uses `drawSignatureClosingBanner()`.
- Secure/browser paths use `/brand/growvest-wealth-review-cover-v03424.jpg`.
- Starting Point and closing banner use versioned official GrowVest icon PNGs.
- Secure PDF renderer metadata is `2.4.10` and embeds a `pdf-renderer-2.4.10` keyword.
- Service-worker cache is `v0.34.24-report-root1`.
- Financial/report logic is unchanged.
