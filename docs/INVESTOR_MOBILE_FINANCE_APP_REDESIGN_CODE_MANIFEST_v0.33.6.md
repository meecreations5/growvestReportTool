# v0.33.6 Investor Mobile Finance App Redesign - Code Manifest

## New
- `src/components/investor/mobile/MobileFinanceCharts.js`
- `src/components/investor/mobile/GrowVestSvgLogo.js`
- `src/components/investor/mobile/InvestorAppSplash.js`
- `src/app/investor/loading.js`
- `public/icons/growvest-loading-mark.svg`

## Updated mobile experience
- `src/components/investor/MobileInvestorDashboard.js`
- `src/components/investor/InvestorShell.js`
- `src/components/portfolio/InvestorPortfolioPanel.js`
- `src/components/insurance/InsuranceProtectionPanel.js`
- `src/components/actions/InvestorActionsPanel.js`
- `src/app/investor/goals/page.js`
- `src/app/investor/reports/page.js`
- `src/app/investor/notifications/page.js`
- `src/app/investor/profile/page.js`
- `src/app/investor/meetings/page.js`
- `src/app/investor/sip-reminders/page.js`
- `src/app/investor/change-password/page.js`
- `src/components/auth/AuthLoadingScreen.js`
- `src/components/auth/InvestorProtectedRoute.js`
- `src/app/globals.css`
- `public/sw.js`

## Dynamic data support
- `src/app/api/investor/app-data/route.js` now provides mobile Portfolio asset allocation, trend and top-holding data from current Portfolio Master records.

## Scope protection
Phone-specific redesigned surfaces use `md:hidden` while the established tablet/desktop surfaces use `hidden md:*`, preventing this UI release from redesigning Admin or larger-screen workflows.
