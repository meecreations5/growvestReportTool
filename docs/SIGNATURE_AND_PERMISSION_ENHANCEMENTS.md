# Signature and Permission Enhancements

Implemented on 23 July 2026. Updated in version 0.22.1.

## Individual signatures

- Added a dedicated **Email signature logo** upload under Settings -> Branding -> Logo & assets.
- Added a separate **Email signature icon logo** upload for the compact symbol displayed at the top-right of desktop and mobile signatures.
- Added an optional licensed **Emitha WOFF2/WOFF webfont** upload under Colours & typography.
- Typed signature names now use:
  - Given name: `Emitha`, with safe script fallbacks.
  - Surname: `League Spartan`, with standard sans-serif fallbacks.
- The existing handwritten-name artwork upload remains available for exact, image-based rendering across email clients.
- Added explicit Mobile / WhatsApp number and office-address presentation.
- Rebuilt the forced mobile preview so logo, address and contact details stack correctly inside the mobile preview even when the browser viewport is desktop sized.
- Added a WhatsApp preview and copyable text signature.
- The company block prefers `signatureLogoUrl`, then falls back to the email or primary logo.
- The top-right signature symbol prefers `signatureIconUrl`, then falls back to the PDF footer symbol or app icon for existing installations.

## Role-wise and user-wise permissions

- Added editable role permissions for Admin, Advisor and Investor roles. Super Admin permissions remain security locked.
- Admin users can configure Advisor and Investor role permissions.
- Super Admin users can additionally configure Admin role permissions.
- Added user-specific permission overrides with an **Inherit role** option for every module.
- Navigation, quick-create actions and protected portal routes now use effective permissions.
- Effective access combines the role matrix with individual user overrides and refreshes live from Firestore.
- Added audit-log events for role-permission and user-permission changes.

## Deployment

Deploy the updated Firestore and Storage rules after application deployment:

```bash
npm run firebase:deploy
```

The Emitha font file is intentionally not bundled. Upload only a properly licensed WOFF2 or WOFF file through Branding Settings.
