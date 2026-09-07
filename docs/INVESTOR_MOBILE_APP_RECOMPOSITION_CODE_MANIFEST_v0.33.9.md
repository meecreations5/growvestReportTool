# v0.33.9 Code Manifest - Investor Mobile App Recomposition

## Changed application files

- `src/components/investor/mobile/InvestorAppSplash.js`
  - simplified official-SVG mobile loading composition
- `src/components/investor/mobile/InvestorEntryMotion.js`
  - faster session-gated mobile brand handoff
- `src/components/investor/MobileInvestorDashboard.js`
  - recomposed Home hierarchy and Financial Health experience
- `src/app/investor/portfolio/page.js`
  - strict phone-only Portfolio selector breakpoint
- `src/components/portfolio/InvestorPortfolioPanel.js`
  - recomposed mobile portfolio summary, allocation and holdings hierarchy
- `src/app/investor/goals/page.js`
  - compact Bucket List summary and non-clipping filter system
- `src/components/insurance/InsuranceProtectionPanel.js`
  - quieter Protection Health and policy hierarchy
- `src/app/investor/reports/page.js`
  - recomposed latest review, history and review library
- `src/components/reports/InvestorReportDetailClient.js`
  - compact phone review summary
- `src/components/investor/InvestorReportSectionNav.js`
  - smaller native-style phone report section navigation
- `src/app/globals.css`
  - v0.33.9 phone-only surface, navigation, spacing and hierarchy tokens
- `public/sw.js`
  - Investor PWA cache bump to `v0.33.9-ui1`
- `package.json`, `package-lock.json`
  - release version `0.33.9`
- `scripts/qa/release-audit.mjs`
  - v0.33.9 regression assertions

## Scope preserved

- Phone UI only below 768px.
- Tablet and desktop Investor UI are preserved.
- Staff/Admin UI and all portfolio/report/insurance data logic are unchanged.
- No Firestore security rules are relaxed.
