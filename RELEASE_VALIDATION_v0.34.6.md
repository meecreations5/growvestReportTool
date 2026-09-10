# Release Validation — v0.34.6 Family & Household Portal Access

## Completed validation

- Project release audit: **344 passed, 0 warnings, 0 failures**.
- TypeScript parser source pass: **421 JS/JSX/MJS/CJS files parsed, 0 syntax diagnostics**.
- Household grants are server-managed through `investorAccessMemberships`.
- Firestore rules deny client reads/writes to household membership documents.
- Google first-login profile creation is constrained to Investor IDs authorised by the login alias.
- Composite Firestore index included for household `uid + status` queries.
- Active Investor context is attached to authenticated API requests and validated server-side.
- Investor App cache keys include selected Investor context.
- In-app notifications are scoped to the selected Investor when an `investorId` is present.
- Push payloads carry `investorId` for profile-aware deep links.
- Shared-account disable logic preserves the Firebase login while another authorised Investor remains active.

## Dependency-backed build

A complete `npm ci` could not finish in the validation environment within the available execution window, so `npm run lint` and `npm run build` were not certified here. Run the following on the deployment workstation before production release:

```bash
npm ci
npm run lint
npm run build
```

## Deployment

This release changes Firestore rules and adds a composite index. Deploy at minimum:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If the push functions from v0.34.5 are not already deployed, also deploy:

```bash
firebase deploy --only functions:sendInvestorPushNotification,functions:notifyInvestorPortfolioVerified
```
