# v0.34.9 — Investor Device Security & App Lock Code Manifest

## New files
- `src/lib/auth/investorSecurityPreferences.js` — device-specific security preferences, PIN hashing, mobile lock timing and platform biometric helpers.
- `src/components/investor/InvestorSecurityGate.js` — phone App Lock gate and desktop inactivity sign-out guard.
- `docs/INVESTOR_DEVICE_SECURITY_APP_LOCK_v0.34.9.md` — functional/security specification.
- `RELEASE_VALIDATION_v0.34.9.md` — release validation checklist.

## Updated files
- `src/app/investor/layout.js` — places the security gate before Investor notification/privacy providers.
- `src/app/investor/change-password/page.js` — phone App Lock/PIN/biometric settings and desktop browser-session/inactivity settings.
- `src/contexts/AuthContext.js` — applies Investor desktop session-vs-local Firebase persistence while keeping mobile persistence compatible with App Lock.
- `public/sw.js` — installed Investor PWA cache bump.
- `package.json`, `package-lock.json` — version `0.34.9`.
- `scripts/qa/release-audit.mjs` — v0.34.9 security assertions.
- `README.md` — release summary.

## No backend schema change
No Firestore index/rule or Firebase Function change is required by this release. Mobile App Lock preferences are intentionally device-specific. Existing Firebase authentication and server-side Investor authorisation remain authoritative for real data access.
