# v0.34.8 Mobile Investor Sign Out Hotfix

## Scope

This hotfix restores an explicit exit control on the **phone Investor App** and the **Personalised Guest Investor Demo**.

## Behaviour

- The GrowVest centre action sheet on phones now always shows an explicit exit button near the bottom.
- A real Investor sees **Sign Out**.
- A Guest/Demo Investor sees **Exit Demo**.
- The mobile Profile screen contains the same explicit action so sign-out is discoverable even though Profile is not part of the persistent bottom navigation.
- Real Investor sign-out clears the authenticated session and returns to `/investor-login`.
- Demo exit clears the guest demo session and returns to `/investor-demo`.
- Existing cache/session cleanup in `AuthContext.logout()` is preserved, including private workspace/PWA cache clearing.
- Tablet and desktop sign-out behaviour remains unchanged.

## Files changed

- `src/components/investor/InvestorShell.js`
- `src/app/investor/profile/page.js`
- `public/sw.js`
- `scripts/qa/release-audit.mjs`
- `RELEASE_VALIDATION_v0.34.8.md`
