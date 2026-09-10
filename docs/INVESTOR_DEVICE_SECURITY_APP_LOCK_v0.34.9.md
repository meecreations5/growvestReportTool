# v0.34.9 — Investor Device Security & App Lock

## Scope
This release applies to real Investor Portal accounts only. The Personalised Guest Investor Demo does not use App Lock or desktop remembered-session settings.

## Mobile App Lock
Under **Profile → Login & Security**, a real Investor can enable App Lock on a phone. Enabling App Lock requires a 4 or 6-digit PIN. The PIN is not stored in plain text; a PBKDF2-SHA-256 one-way hash with a random per-device salt is stored locally on that device.

Supported devices may additionally enable the platform authenticator using Web Authentication. The operating system/browser performs the biometric or device-verification prompt. GrowVest does not receive or store fingerprint or Face ID data. PIN remains the fallback unlock method.

Lock timing options:
- Every time the app returns
- After 5 minutes
- After 15 minutes
- After 30 minutes
- Until sign out

If the Investor forgets the App Lock PIN, **Sign in again** clears the local App Lock registration on that device, signs out of Firebase, and requires normal GrowVest authentication before a new PIN can be created.

## Desktop / Web
Desktop security remains full-authentication based rather than PIN/biometric App Lock.

- **Require sign-in after browser closes** is ON by default.
- ON uses Firebase `browserSessionPersistence`.
- OFF uses Firebase `browserLocalPersistence` on that browser.
- Inactivity sign-out options: 15 minutes, 30 minutes, 1 hour, Off.

These preferences are device/browser-specific and do not automatically copy to another device.

## Household Access
App Lock protects the authenticated household login as a whole. After unlock, the user can continue with the currently selected authorised Investor profile or switch to another authorised family profile.

## Security boundary
App Lock is an additional local privacy gate over an already authenticated Investor session. API authorisation, investor-context membership validation and Firebase authentication remain the source of truth for access to real Investor data.
