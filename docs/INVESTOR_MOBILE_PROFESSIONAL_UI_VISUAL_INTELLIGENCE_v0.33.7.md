# v0.33.7 - Investor Mobile Professional UI & Visual Intelligence

## Scope
This release is limited to the Investor Portal phone experience below 768px. Tablet, desktop, Staff and Admin layouts remain on the established UI.

## Design direction
The phone UI follows the approved GrowVest finance-app direction: one dominant financial surface per primary screen, calmer white supporting cards, stronger typography hierarchy, restrained use of Royal Trust Blue and Growth Cyan, and the supplied official GrowVest SVG assets.

## Professional mobile refinements
- Added a reusable GrowVest icon-outline motif derived from the official supplied icon for low-opacity hero watermarks and branded empty states.
- Home adds a Financial Health visual covering Portfolio, Goals, Protection and Review readiness.
- Portfolio keeps the verified Portfolio Master graph and allocation donut while allowing the Investor to expand from the top six holdings to the complete holding list.
- Bucket List adds mobile search and a complete native-style filter sheet, including Near Completion and Not Started states.
- Monthly Reviews add phone search, a stronger review hero and clearer current-value/invested/movement/SIP hierarchy.
- Monthly Report Protection tables render as phone policy cards instead of horizontally scrolling desktop tables.
- Insurance & Protection adds a protection-profile infographic and nearest-renewal timeline.
- Documents add phone status filtering with branded empty states.
- Meetings avoid repeating the next meeting and keep MOM cards concise.
- SIP Reminders reduce decision-button clutter by placing secondary response choices under More options.
- Your Actions is simplified into investor-friendly Next Steps, with decision controls disclosed only when needed.
- Notifications add a phone-native preferences sheet for push categories and in-app banners.
- Profile changes from stacked dashboard tiles to a cleaner account/settings list; profile-photo editing is integrated into the profile hero.
- Login & Security keeps sign-in methods scannable and expands the password form only on request.

## Brand system
Primary colors remain:
- Royal Trust Blue `#1F4ED8`
- Growth Cyan `#20B8CD`
- Deep Premium Black `#0B0B0F`
- Insight Yellow `#F5B301`
- Strategic Red `#E53935`

Success green is reserved for true positive/verified states. Yellow is reserved for attention. Red is reserved for negative/overdue/destructive states.

## Loading identity
Investor authentication and route loading continue to use the official GrowVest SVG logo set on the branded dark loading surface. The new outline asset is decorative only and does not replace the official SVG logo.

## PWA
Investor PWA caches are bumped to `v0.33.7-ui1` and include `growvest-icon-outline.svg` so installed apps receive the new mobile design assets.
