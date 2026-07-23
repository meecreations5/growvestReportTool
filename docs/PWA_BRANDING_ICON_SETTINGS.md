# Configurable PWA App Icon

Version: 0.25.1

## What changed

The installed GrowVest Investor PWA no longer depends only on the static icons shipped with the codebase. Super Admin and Admin users can now manage the PWA icon from:

`Settings → Branding → Logo & assets → PWA / home-screen app icon`

The existing **Application UI icon / square mark** remains separate. It continues to be used for the browser favicon, collapsed navigation and compact application identity.

## Uploaded assets

A standard PWA icon upload must be:

- Square
- At least 512 × 512px
- PNG, JPG or WebP
- 5 MB or smaller

The browser generates and uploads:

- 192 × 192 PNG for Android and manifest shortcuts
- 512 × 512 PNG for PWA installation
- 180 × 180 PNG for Apple touch icon

An optional 512 × 512 Android maskable icon can also be uploaded. Keep the important logo artwork inside the central 80% safe area so circular, rounded-square and squircle crops do not cut it off.

## Publishing behaviour

1. Upload or replace the PWA icon in the branding draft.
2. Review the generated Android, desktop and Apple previews.
3. Select **Publish Branding**.
4. The published `publicSettings/branding` snapshot becomes the source for the manifest and Apple touch icon.

Draft changes do not alter the installed application icon.

## Runtime integration

- `src/app/manifest.js` loads published branding on the server and returns a dynamic web app manifest.
- `src/app/layout.js` resolves the published Apple touch icon and application name for server metadata.
- `BrandingContext` refreshes the manifest URL using the published branding version and updates the Apple touch icon in the browser.
- Static files under `public/icons` remain safe fallbacks when no PWA icon has been published.

## Important browser behaviour

Browsers and mobile operating systems can cache installed icons. A new icon will be used for new installations immediately after branding is published. Existing installations may require:

1. Closing and reopening the PWA.
2. Refreshing the web application.
3. Removing and reinstalling the PWA if the operating system continues to display the old cached icon.

## UAT checklist

1. Open Settings → Branding → Logo & assets.
2. Upload a square image smaller than 512px and confirm validation blocks it.
3. Upload a non-square image and confirm validation blocks it.
4. Upload a valid 512px or larger square image.
5. Confirm the Android/Desktop and iPhone/iPad previews appear.
6. Optionally upload a padded maskable icon.
7. Save the draft and confirm the current installed icon is unchanged.
8. Publish Branding.
9. Open `/manifest.webmanifest` and confirm the published Firebase Storage URLs are present.
10. Install the Investor PWA on Android or desktop and confirm the new icon.
11. Add the site to the iPhone/iPad home screen and confirm the Apple touch icon.
12. Confirm the favicon and internal sidebar icon continue to use the separate Application UI icon.
