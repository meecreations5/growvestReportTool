# v0.33.4 Investor Mobile App Optimisation Hotfix

## Goal
Treat the Investor Portal as an app-first experience on mobile and installed PWA devices rather than a desktop page compressed to a phone width.

## Navigation
- Fixed five-slot bottom navigation remains: Home, Portfolio, Goals, Reports, More.
- Notifications remain in the app header bell.
- Active destination now uses a compact top indicator plus icon pill instead of a large filled tile.
- Navigation touch targets are compact but remain thumb-friendly.
- More sheet uses the same mobile/tablet breakpoint as the bottom navigation and preserves safe-area padding.

## Mobile shell
- Reduced app-header height and logo footprint to give more content above the fold.
- Tuned side padding for 320-390px devices.
- Added touch-manipulation behaviour and contained overscroll for app-like interactions.
- Added standalone PWA viewport handling.
- Mobile form controls use at least 16px text to prevent iOS Safari auto-zoom.

## Home
- Reduced hero height on phones while keeping portfolio value and Bucket List progress prominent.
- Quick access is now a discoverable 2 x 2 app grid instead of a swipe-only horizontal carousel.
- Quick access includes Latest Report, Protection, Documents and SIP Reminders; Goals and Reviews remain primary app navigation/actions.

## Portfolio
- Investments / Protection is now a sticky segmented control below the app header on mobile.
- Portfolio filters scroll horizontally on small screens without widening the page.
- Intraday trading history uses mobile cards on phones and retains the table on larger screens.
- Protection summary uses two-column cards on phones.
- Fixed a ULIP policy-card runtime reference to selection variables that do not belong to policy-level cards.

## Documents and Reports
- Document Upload/View/Download actions fit predictably on phones; Download spans the row where required.
- Monthly Report action dock now sits above the actual safe-area-aware bottom navigation.
- Report pages reserve enough bottom space so the final content cannot be covered by fixed app actions/nav.

## QA
- Release audit extended for mobile navigation, iOS input zoom protection and sticky Portfolio segmentation.
- `npm run qa`: 213 passed, 0 warnings, 0 failures.
- Changed JavaScript files pass `node --check`.

## Device UAT still required
Run on at least:
1. Android Chrome 360x800 and 412x915.
2. Installed Android PWA.
3. iPhone Safari 375/390px width, including a device with home indicator safe area.
4. Installed iOS PWA if used by clients.
5. 768-1024px tablet widths to verify More sheet/bottom-nav breakpoint.
