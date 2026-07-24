# GrowVest v0.30.3 — PWA Icon and Brand Identity

## Purpose

This release corrects the installed Investor PWA icon treatment on Android and adds configurable PWA naming and brand-positioning text.

## Changes

- Added configurable PWA full name, home-screen short name and PWA brand message under Branding → Logo & Assets.
- Defaults:
  - Full name: `GrowVest – Your Conscious Wealth Partner`
  - Short name: `GrowVest`
  - Brand message: `Your Conscious Wealth Partner`
- Replaced the fallback launcher artwork with a square GrowVest symbol on Royal Trust Blue rather than a wide logo inside a white card.
- Corrected the manifest maskable-icon fallback so Android does not incorrectly reuse a standard transparent icon as a maskable icon.
- The PWA icon uploader now automatically generates:
  - 192 × 192 standard icon
  - 512 × 512 standard icon
  - 180 × 180 Apple touch icon
  - 512 × 512 Android maskable icon with safe-zone padding
- The configured PWA brand message now appears in the Investor app header and install card.
- Updated the PWA cache version to `0.30.3`.

## Android launcher limitation

Android launchers normally show only the manifest `short_name` below the home-screen icon. A separate second-line tagline is not controlled by the PWA. The full app name and brand message are therefore used in install, app-information and supported splash/app surfaces.

## Apply and test

1. Open Settings → Branding → Logo & Assets.
2. Set the PWA identity fields.
3. Upload a square app symbol, not a wide wordmark.
4. Publish Branding.
5. Deploy the Next.js application.
6. Remove the previously installed GrowVest PWA from the phone.
7. Clear the site data if the previous icon remains.
8. Open `insights.growvest.info`, install the PWA again and verify the icon and label.

Existing installed PWAs can retain the old icon because the launcher caches manifest assets at installation time.
