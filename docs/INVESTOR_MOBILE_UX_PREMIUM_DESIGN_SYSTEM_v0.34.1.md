# v0.34.1 - Investor Mobile UX & Premium Design System Consolidation

v0.34.1 refines the existing GrowVest Investor App rather than redesigning it again. The release focuses on readability, navigation clarity, investor trust, and consistent financial-app behaviour while preserving the approved GrowVest visual direction and phone-only mobile architecture.

## Investor experience changes

- App-wide persistent financial privacy, controlled from Home and More.
- Calendar-based 1M / 3M / 6M / 1Y portfolio trend ranges instead of data-point slicing.
- Smarter Home `Next for you` prioritisation for protection renewals, SIP funding, meetings, and Monthly Review.
- One canonical Protection destination at `/investor/insurance`; legacy Portfolio protection links redirect there.
- New Goal Detail page connecting Bucket List progress to the investments building the goal.
- Holding Detail includes purpose, goal connection and role-in-plan context.
- Monthly Review language separates portfolio change from contributions/withdrawals and uses a one-minute summary first.
- Profile and More are simplified around identity, advisor relationship, preferences, security and support.
- Investor Actions require confirmation before Approve / Defer / Reject decisions are submitted.
- Login/OTP errors are investor-friendly; technical Firebase detail stays out of the client-facing recovery message.
- Protection uses `Protection setup` rather than an adequacy/confidence score unless an actual adequacy model exists.

## Design-system consolidation

- A canonical v0.34.1 phone layer in `globals.css` raises ultra-small 7-10px labels to a more readable mobile scale.
- Bottom navigation labels follow the same readable metadata scale.
- Mobile dark surfaces receive explicit overrides instead of inheriting conflicting light `!important` rules.
- Existing GrowVest brand colors, animated official SVG identity, app splash, route skeletons and phone-only scope are preserved.

## Scope

The release remains phone-first below 768px. Tablet, desktop, Staff and Admin layouts retain their established behaviour except where shared data/security logic is intentionally reused.
