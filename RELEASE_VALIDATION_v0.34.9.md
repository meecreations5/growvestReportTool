# Release Validation — v0.34.9 Investor Device Security & App Lock

## Implemented
- [x] Real-Investor-only mobile App Lock.
- [x] 4/6 digit PIN with PBKDF2-SHA-256 + random local salt; no plain-text PIN storage.
- [x] Optional platform biometric/device verification using Web Authentication when supported.
- [x] PIN fallback and full-sign-in reset path.
- [x] Mobile lock timing: every return, 5, 15, 30 minutes, or until sign out.
- [x] App Lock gate mounts before Investor notification/privacy providers so locked screens do not render Investor pages behind the gate.
- [x] Guest Demo excluded from App Lock.
- [x] Desktop `Require sign-in after browser closes` defaults ON.
- [x] Desktop ON uses Firebase browser session persistence; OFF uses local persistence.
- [x] Desktop inactivity sign-out: 15m / 30m / 60m / Off.
- [x] Household Investor switching remains available after unlock.
- [x] PWA cache bumped to `v0.34.9-investor-security1`.

## Validation
- [x] Release audit: 369 passed, 0 warnings, 0 failures.
- [x] TypeScript parser syntax pass: 426 source files, 0 parse failures.
- [ ] Run dependency-backed ESLint and Next.js production build on the deployment machine.

## Deployment
No new Firebase Function, Firestore rule or Firestore index is required for v0.34.9. Deploy the normal Next.js application/PWA assets.

## Local production check
Run before production deployment:

```bash
npm ci
npm run qa
npm run lint
npm run build
```
