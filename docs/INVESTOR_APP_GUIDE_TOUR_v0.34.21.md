# GrowVest v0.34.21 - Investor App Guide Tour

## Purpose
Add a lightweight first-run guide to the phone Investor App without changing the locked Home composition, the five-position bottom navigation or any Investor financial data.

## Experience
- Phone-only (`<768px`) guided tour.
- Opens automatically on the Investor Home screen the first time the current Investor profile sees this guide version.
- Waits until the existing GrowVest entry motion has finished so both experiences do not compete.
- Explains Home, Portfolio, the centre GrowVest action, Bucket List and Reports.
- Uses a spotlight around the actual bottom-navigation control being explained.
- Includes Back, Next, Skip and Finish controls.
- Stores only a local completed flag in browser `localStorage`; no financial or profile data is stored by the guide.
- Can be replayed at any time from **GrowVest -> App guide**.
- Keeps tablet and desktop Investor layouts unchanged.

## Accessibility / safety
- Modal semantics are provided while the tour is open.
- Background interaction and page scrolling are blocked during the guide.
- Closing, skipping or finishing marks the guide as seen for this guide version.
- If browser storage is restricted, the guide continues to function but can appear again in a future session.

## No business-logic change
No Portfolio, Bucket List, report, authentication, publishing, notification, SIP, insurance or financial calculations are changed.
