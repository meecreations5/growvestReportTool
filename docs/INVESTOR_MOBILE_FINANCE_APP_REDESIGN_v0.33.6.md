# v0.33.6 - Investor Mobile Finance App Redesign

## Scope
This release redesigns the GrowVest Investor experience on phones below 768px only. Tablet, desktop, staff and Admin layouts remain on the established application UI.

## Brand system
The phone experience uses the approved GrowVest palette:
- Royal Trust Blue `#1F4ED8`
- Growth Cyan `#20B8CD`
- Deep Premium Black `#0B0B0F`
- Insight Yellow `#F5B301`
- Strategic Red `#E53935`
- Soft Gray `#F4F6F9`
- Medium Gray `#6B7280`
- White `#FFFFFF`

Green and red remain semantic colors for positive/success and negative/overdue states rather than decorative portfolio categories.

## Mobile app experience
- Finance-app Home with live Portfolio Master value, investment/gain summary, line trend, asset-allocation infographic, Bucket List progress and Protection snapshot.
- Portfolio with a branded value hero, trend graph, asset-allocation donut, app cards and top holdings.
- Bucket List with progress rings and mobile goal cards.
- Monthly Reviews with wealth-summary graphics and report-history trends.
- Insurance & Protection with app-style cover summary and policy cards.
- Documents, Notifications and Profile remain phone-first, compact and overflow-safe.
- Meetings, SIP Reminders, GrowVest Actions and Login & Security now use the same finance-app visual system on phones.
- Bottom navigation remains Home | Portfolio | Goals | Reports | More and is presented as a floating mobile app bar.
- The More menu remains a native-style bottom sheet.

## Graphs and infographics
The mobile app uses lightweight SVG/CSS charts without adding a chart-library dependency:
- portfolio-value line charts;
- asset-allocation donut charts;
- report-history bar charts;
- Bucket List/progress rings;
- compact status and financial summary cards.

## Loading identity
Investor route/auth loading uses a dedicated GrowVest SVG mark. If Branding Settings contains an SVG logo, that configured SVG is used; otherwise the packaged `/icons/growvest-loading-mark.svg` fallback is displayed on the branded GrowVest loading screen.

## Data and security
This release does not relax Firestore rules or change portfolio calculations. Current Investor data continues to use authenticated server APIs and the existing Portfolio Master/reporting logic.
