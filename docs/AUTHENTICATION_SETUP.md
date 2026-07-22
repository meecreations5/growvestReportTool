# Authentication Setup — Phase 2 Auth Update

## Final login architecture

| User type | Login route | Authentication method |
|---|---|---|
| Super Admin | `/staff-login` | Microsoft 365 |
| Admin | `/staff-login` | Microsoft 365 |
| Advisor | `/staff-login` | Microsoft 365 |
| Investor | `/investor-login` | Username/password, mobile OTP, or authorised Google login |

Public self-registration is not included.

## 1. Environment configuration

Copy `.env.example` to `.env.local` and replace:

```env
NEXT_PUBLIC_MICROSOFT_TENANT_ID=YOUR_MICROSOFT_DIRECTORY_TENANT_ID
```

The Firebase web configuration in `.env.example` points to `growvest-reporttool`.

## 2. Firebase Authentication providers

Enable these providers in Firebase Console:

- Microsoft
- Google
- Phone
- Email/Password

Email/Password is used only for Investor username/password accounts. Google and Phone are used only for Investor Portal access. Staff accounts are validated to require the `microsoft.com` provider.

## 3. Microsoft Entra configuration

Create a single-tenant Microsoft Entra app and add this Web redirect URI:

```text
https://growvest-reporttool.firebaseapp.com/__/auth/handler
```

Enter the Entra Application ID and Client Secret in Firebase Authentication > Microsoft provider.

## 4. Staff access onboarding

The first Super Admin may be created manually in `users/{firebaseUid}`. After that, staff onboarding is managed from the application:

1. Open `/users/create` as Super Admin.
2. Enter the exact lowercase Microsoft organisational email.
3. Assign `super_admin`, `admin`, or `advisor`.
4. The application creates `staffInvitations/{email}`.
5. On the user’s first Microsoft login, the invitation is claimed and `users/{firebaseUid}` is created automatically.

Advisor access also captures the Advisor code and designation. Cancelled or inactive access is rejected at login.

## 5. Investor username/password account

Firebase does not have a native username provider. The visible username is converted internally to:

```text
<username>@investor.growvest.internal
```

Example:

```text
Visible username: arjun.mehta
Firebase email: arjun.mehta@investor.growvest.internal
```

For initial testing, create an Email/Password user in Firebase Authentication using the internal email. Then create:

```text
users/{firebaseUid}
```

```json
{
  "uid": "FIREBASE_UID",
  "fullName": "Arjun Mehta",
  "role": "investor",
  "status": "active",
  "investorId": "INVESTOR_DOCUMENT_ID",
  "clientCode": "GV-CL-2026-0001",
  "username": "arjun.mehta",
  "mobile": "+919876543210",
  "portalEnabled": true,
  "mustChangePassword": true,
  "authMethods": ["username_password"]
}
```

The linked `investors/{investorId}` document should contain `portalUid` with the same Firebase UID.


## 6. Investor Google account

1. Enable **Google** under Firebase Authentication > Sign-in method.
2. Add the local and production domains under Firebase Authentication > Settings > Authorised domains.
3. Open the Investor Profile > Portal Access.
4. Enable **Google Login** and enter the exact Google email authorised for that Investor.
5. On first Google login, the application claims the `investorLoginAliases/{email}` record and creates a linked `users/{firebaseUid}` Investor profile.

The Google email is not a public-registration mechanism. It must be pre-authorised by GrowVest staff and linked to an existing Investor Profile.

## 7. Investor phone account

Enable Phone Authentication and add authorised domains. For testing, Firebase test phone numbers are recommended.

The phone-auth Firebase UID must have a matching `users/{uid}` document with role `investor`, `portalEnabled: true`, and an `investorId`.

To support both phone and username/password on one canonical account, the providers must be linked to the same Firebase user. Investor Access Management and secure server-side account provisioning are planned for the next development slice.

## 8. Firestore deployment

```bash
firebase login
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 9. Run locally

```bash
npm install
npm run dev
```

Open:

- Staff: `http://localhost:3000/staff-login`
- Investor: `http://localhost:3000/investor-login`

## Security behaviour

- Staff profiles are rejected unless the Firebase provider is `microsoft.com`.
- Investor profiles are rejected unless the provider is `password`, `phone`, or an authorised `google.com` account.
- Missing, inactive, unlinked, or disabled portal profiles are signed out.
- Investors can read only their linked investor profile, completed visible reports, and visible MOM records.
- Investor passwords are never stored in Firestore.
