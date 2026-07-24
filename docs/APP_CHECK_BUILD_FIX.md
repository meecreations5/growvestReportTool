# Firebase App Check build fix — v0.28.1

## Issue

Next.js/Turbopack reported:

`Export getAppCheck doesn't exist in target module`

The installed modular Firebase App Check package exposes `initializeAppCheck`, but does not expose `getAppCheck`.

## Correction

- Removed the unsupported `getAppCheck` import and fallback.
- Added a browser-global singleton for the App Check instance using `Symbol.for(...)`.
- The singleton prevents duplicate initialisation during Next.js hot reloads.
- App Check remains optional and only starts when `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` is configured.

No Firebase Rules deployment or data migration is required.
