# Investor Mobile Sign-In UI Refinement

Version: 0.25.4

## Updated experience

The mobile Investor login page now presents the published white/inverse GrowVest logo directly on the dark gradient hero. The previous white rounded logo container has been removed.

Additional mobile refinements:

- Shorter hero section so the authentication form appears higher on the screen
- More focused Investor access headline and supporting copy
- Mobile OTP and Password remain the primary sign-in methods
- Google sign-in is displayed as a separate alternate action
- Compact secure-authentication reassurance beneath the sign-in actions
- Branding live preview reflects the revised Investor login presentation

## Branding requirement

For the strongest contrast, publish a transparent white/inverse logo under:

`Settings → Branding → Logo & assets → White / inverse logo`

The page falls back to the primary logo when an inverse logo is not available, but a dedicated inverse asset is recommended for the dark mobile hero.

## Deployment

No Firestore or Storage rules change is required.

Deploy the Next.js application normally. The PWA cache identifier was updated to `growvest-investor-v0.25.4`, allowing the new application shell to replace the previous cached login page.

## UAT checklist

1. Open `/investor-login` at a mobile viewport between 360px and 430px wide.
2. Confirm the logo appears directly on the dark background with no white box, border or rounded container.
3. Confirm the Investor App badge remains aligned to the right.
4. Confirm the heading and sign-in card are visible without excessive scrolling.
5. Test Mobile OTP request and verification.
6. Test Password sign-in.
7. Test Continue with Google.
8. Open Settings → Branding → Live previews → Investor Login and confirm the preview matches the revised hierarchy.
9. Install or refresh the PWA and confirm the updated login shell appears.
