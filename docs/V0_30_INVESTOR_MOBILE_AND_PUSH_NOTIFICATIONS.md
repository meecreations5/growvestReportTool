# GrowVest v0.30.0 — Investor Mobile Experience and Push Notifications

## Investor mobile improvements

- Mobile-only navy/blue app header using the published inverse GrowVest logo without a white logo container.
- Compact Investor greeting, notification access and profile access in the first mobile viewport.
- App-style bottom navigation with a larger active navigation state and unread notification badge.
- Improved More sheet with profile image, app appearance, notification preferences, PWA installation and secure sign out.
- Dashboard quick-access carousel for Reports, Bucket List goals, Documents and Notifications.
- Push-notification setup prompt on the dashboard when the browser is eligible but the device has not been enabled.
- Advisor card includes Email, Call and WhatsApp actions when a mobile number is available.
- Notification Centre includes a mobile-first push setup panel, category preferences and a test-notification action.

## Push architecture

1. The Investor explicitly enables notifications from Notification Centre.
2. The browser asks for permission and Firebase Messaging creates an FCM registration token.
3. The authenticated Next.js API stores the token in `pushSubscriptions` using Firebase Admin.
4. A Firestore-triggered Cloud Function listens for new `notifications/{notificationId}` documents.
5. The function checks the recipient's push category preferences and sends the alert to active devices.
6. Invalid or expired FCM tokens are automatically removed.
7. The notification opens a secure Investor Portal route. No portfolio value or private report detail is included in the push body.

## Firebase configuration

### 1. Generate Web Push certificate

Firebase Console → Project Settings → Cloud Messaging → Web configuration → Web Push certificates → Generate key pair.

Copy the public key to:

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_public_vapid_key
```

Redeploy the Next.js application after adding the variable.

### 2. Deploy Firestore Rules and Cloud Function

Install function dependencies:

```bash
cd functions
npm install
cd ..
```

Deploy:

```bash
firebase deploy --only firestore:rules,functions
```

The Cloud Function is deployed in `asia-south1` and requires a Firebase/Google Cloud billing-enabled project.

### 3. Test

- Sign in as an Investor over HTTPS.
- Open Investor App → Notifications.
- Select **Enable on this device**.
- Accept the browser permission.
- Select **Send test notification**.
- Move the app to the background or lock the phone.
- Create/publish a real report, meeting, MOM or document notification and verify closed-app delivery.

## Security behaviour

- Push tokens are never readable or writable directly from browser Firestore clients.
- Token registration and removal require a valid Firebase ID token and active GrowVest user profile.
- Push messages contain a short title, message and secure internal route only.
- Logging out removes the current device's push subscription.
- Complete reports, holdings, documents and PDFs remain online-only and are not placed in notification payloads or service-worker caches.

## Browser notes

- Web Push requires HTTPS and a browser with service-worker and Push API support.
- iPhone/iPad web push requires a supported iOS/iPadOS version and is most reliable when the Investor PWA is added to the Home Screen.
- Permission denied by the user must be re-enabled from browser/site settings; the application cannot override it.
