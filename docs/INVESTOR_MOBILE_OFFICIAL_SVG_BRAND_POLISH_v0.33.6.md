# v0.33.6 Investor Mobile Official SVG Brand Polish

## Scope
Phone-only Investor App refinement below 768px. Tablet, desktop, staff and admin layouts remain unchanged.

## Official GrowVest SVG assets
The supplied GrowVest SVG artwork is packaged under `public/brand/` and is now the canonical mobile-app brand source:

- `growvest-icon.svg`
- `growvest-logo-dark.svg`
- `growvest-logo-white.svg`
- `growvest-wordmark-dark.svg`
- `growvest-wordmark-white.svg`

The Home app bar uses the dark wordmark on white. Internal mobile app bars use the official icon beside the screen title. The mobile login hero and branded loading/splash experience use the white GrowVest artwork on dark brand surfaces.

## Visual refinements from mobile UAT

- Replaced the earlier generated loading mark with the supplied GrowVest SVG artwork.
- Loading screen now uses the official GrowVest icon plus full white logo.
- Simplified internal phone headers so the page title is primary and the repeated `GROWVEST INVESTOR APP` label no longer dominates the interface.
- Mobile profile avatar is circular, matching the intended finance-app visual language.
- Added a low-opacity official GrowVest icon watermark to Home, Portfolio, Bucket List and Login & Security hero surfaces.
- Fixed dark hero heading contrast. Global heading tokens previously forced dark ink even inside a white-text parent on some phone screens.
- Home Quick Actions now use the approved GrowVest palette intentionally: Royal Trust Blue, Growth Cyan, Insight Yellow and Deep Premium Black.
- Removed the redundant `Profile` text link from Quick Actions because Profile is already available from the app-header avatar and More.
- Bucket List status filters use a 2x2 phone grid rather than a horizontal strip that could clip `Completed`/`Attention Required` on narrow devices.

## PWA
Investor PWA cache identity is bumped to `v0.33.6-ui2` and the official SVG assets are pre-cached in the application shell.

## Brand palette

- Royal Trust Blue `#1F4ED8`
- Growth Cyan `#20B8CD`
- Deep Premium Black `#0B0B0F`
- Insight Yellow `#F5B301`
- Strategic Red `#E53935`
- Soft Gray `#F4F6F9`
- White `#FFFFFF`

Success green is reserved for positive/verified states rather than general branding.
