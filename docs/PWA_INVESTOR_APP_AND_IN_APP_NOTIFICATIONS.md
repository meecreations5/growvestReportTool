# GrowVest Investor PWA and In-App Notifications

Version: 0.25.1

## Scope delivered

### Installable Progressive Web App

- Next.js web app manifest at `src/app/manifest.js`
- Published-branding PWA icons with generated 192px, 512px and Apple touch variants plus an optional maskable icon
- Standalone display mode with portrait-first investor experience
- Service worker registration through `PwaProvider`
- Safe static-asset caching only; Firestore, API and financial data are not cached
- Offline fallback screen
- Online/offline connection banner
- New-version update banner
- Android/desktop install prompt support through `beforeinstallprompt`
- Install actions in the Investor Dashboard, desktop side navigation and mobile More sheet

### Investor mobile-app shell

- Compact app bar with Investor greeting and live notification badge
- Fixed five-item bottom navigation:
  - Home
  - Reports
  - Goals
  - Notifications
  - More
- Mobile More sheet for Meetings, Documents, Profile, Login & Security, app installation and secure sign-out
- Safe-area handling for notched devices and installed-app mode
- Standalone PWA visual behaviour and reduced browser-like chrome

### In-app Notification Centre

- New route: `/investor/notifications`
- Live Firestore subscription to the existing `notifications` collection
- All and Unread filters
- Mark-one and mark-all-as-read flows
- Prominent toast banners for new investor events
- Mobile bottom-navigation unread badge
- Desktop side-navigation unread badge
- Device notification permission control for alerts while the app remains open in the background
- Local per-device preferences for in-app banners and device alerts

Existing report, meeting, MOM and document notification creation continues to use the current Firestore workflow. No notification data migration is required.

## Important push-notification distinction

Version 0.25.1 includes live in-app notifications and foreground/background-tab browser alerts while the installed PWA is still running. Notifications after the app has been fully closed require Firebase Cloud Messaging, a web-push VAPID key, token storage and a trusted server/Cloud Function sender. Those closed-app push components are intentionally not simulated in this release.

## Mobile Investor sign-in redesign

The `/investor-login` mobile view now includes:

- Prominent GrowVest Investor App hero
- App-oriented wealth-access messaging
- Larger Mobile OTP, Password and Google method controls
- Mobile OTP presented as the primary access method
- 56px touch targets and high-visibility CTA buttons
- Secure-access and app-notification benefit indicators
- Rounded bottom-sheet sign-in surface with safe-area support
- Existing authentication behaviour preserved

## Deployment

Build and deploy the Next.js application normally. The PWA files are served by the application itself.

```bash
npm install
npm run build
npm run start
```

For Firebase Hosting or another CDN, make sure `/sw.js` is served from the domain root and is not redirected to another origin.

Recommended response headers:

```text
/sw.js
Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
Content-Type: application/manifest+json
```

No Firestore rules changes are required because the existing notification rules already allow an authenticated Investor to read and update only notification status/readAt for their linked investor record.

## Acceptance checklist

1. Open `/investor-login` on a 360px-430px-wide device.
2. Complete Mobile OTP, Password and Google sign-in tests.
3. Open the Investor Dashboard and accept the Install App prompt on a supported browser.
4. Launch GrowVest from the home-screen icon and confirm standalone display.
5. Publish a report or share an Investor document from Staff.
6. Confirm the notification appears as a toast and in the Notification Centre.
7. Confirm the bottom navigation badge updates.
8. Open the notification and verify it marks as read and follows the correct link.
9. Enable device alerts from Notification Centre and test while the app is in a background tab.
10. Disconnect the network and verify the offline screen appears without exposing portfolio data.
