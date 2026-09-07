# GrowVest Investor Mobile Signature UI v0.34.2

## Purpose
v0.34.2 converts the Investor App from a card-heavy fintech dashboard into a calmer, human-crafted GrowVest mobile experience while preserving the existing data, routes, security and operational architecture.

## Approved GrowVest palette
- Royal Trust Blue: `#1F4ED8`
- Deep Premium Black: `#0B0B0F`
- Strategic Red: `#E53935`
- Insight Yellow: `#F5B301`
- Soft Gray: `#F4F6F9`
- Medium Gray: `#6B7280`
- White: `#FFFFFF`

Positive-return green remains semantic-only for gains/positive performance. It is not used as a decorative brand accent.

## Official brand assets
The supplied GrowVest icon, dark/white logo and dark/white wordmark SVGs were compared against the files already packaged in `public/brand/`; the hashes match. v0.34.2 therefore reuses the exact official assets rather than introducing generated or substitute artwork.

## Mobile design language
- Large brand-blue wealth hero on Home.
- White overlapping quick-action surface.
- Four persistent bottom destinations around one floating official GrowVest action button.
- Slim Lucide outline icons, normally 1.45-1.55px stroke.
- White and Soft Gray information surfaces with far fewer nested cards.
- Deep Premium Black reserved for important Monthly Review feature panels.
- Insight Yellow and Strategic Red used only for meaningful warning/attention states.
- Typography and whitespace create hierarchy instead of tiny uppercase labels or decorative badges.

## Core screens updated
### Home
- Total Wealth becomes the focal brand-blue hero.
- Four quick actions: Portfolio, Bucket List, Reports and Protection.
- One priority-driven `What needs your attention` item.
- Compact Bucket List progress.
- Deep-black latest Monthly Review feature.
- GrowVest Partner relationship row.

### Portfolio
- Editorial current-value hierarchy.
- Calendar-based performance ranges remain in Portfolio.
- Lightweight line chart and asset-allocation donut use the approved brand palette.
- Flat Portfolio Snapshot and holdings list replace repetitive KPI cards.

### Bucket List
- Flat, scan-friendly goal rows with slim contextual icons.
- Brand-blue progress bars.
- Compact filters plus a complete status-filter sheet.
- Dedicated Goal Detail page with progress, plan summary and connected investments.

### Monthly Review
- Latest review is presented as one Deep Premium Black financial statement-style feature.
- Money Added, Investment Movement, Withdrawals and Net Change are separated clearly.
- Previous reviews use a flat list.
- Report Detail keeps the investor-friendly 60-second summary and on-demand full report.

### Protection
- `Protection Setup` clearly represents record completeness, not an adequacy score.
- Slim policy icons and flat policy rows.
- Strategic Red / Insight Yellow only for due or overdue states.

### Profile
- Focused investor identity, photo, personal details, GrowVest Partner, notifications and login/security.
- Removes duplicate portal navigation from the phone profile.

### Mobile shell
- Home, Portfolio, Bucket List and Profile remain persistent.
- Floating centre button uses the official GrowVest icon.
- Centre action sheet contains Monthly Review, Protection, Documents, Meetings, SIP Reminders and Your Actions.
- Financial privacy remains available app-wide.

## Compatibility
The redesign is phone-scoped below 768px. Existing tablet and desktop workflows remain available. Investor APIs, portfolio calculations, reporting data, Firebase permissions and admin/operations modules are not redesigned by this release.
