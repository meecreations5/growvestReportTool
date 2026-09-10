# v0.34.6 Family & Household Portal Access — Code Manifest

## New
- `src/app/api/investor/access/profiles/route.js`
- `src/app/investor/select-profile/page.js`
- `src/lib/auth/investorAccess.js`
- `src/services/investorAccessService.js`
- `docs/FAMILY_HOUSEHOLD_PORTAL_ACCESS_v0.34.6.md`

## Updated
- `src/contexts/AuthContext.js`
- `src/lib/firebase/apiAuth.js`
- `src/lib/server/firebaseAdmin.js`
- `src/services/authService.js`
- `src/services/investorAppService.js`
- `src/components/investor/InvestorShell.js`
- `src/components/investors/InvestorPortalAccessCard.js`
- `src/services/communicationService.js`
- `src/app/api/investors/[investorId]/portal-access/route.js`
- `src/app/api/investor/account/link-google/route.js`
- `src/app/api/notifications/route.js`
- `src/app/investor-login/page.js`
- `functions/index.js`
- `public/firebase-messaging-sw.js`
- `public/sw.js`
- `package.json`
- `scripts/qa/release-audit.mjs`

## Data authority
- `investorAccessMemberships/{uid}__{investorId}` explicit household grants

- `firestore.rules`
- `firestore.indexes.json`
