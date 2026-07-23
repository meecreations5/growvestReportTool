# Dark Mode Consistency Fix — Version 0.26.1

## Issue

Published branding values were written directly to the application semantic CSS variables (`--gv-ink`, `--gv-surface`, and `--gv-muted`). Inline values have higher priority than the dark-theme class, so dark mode could change card backgrounds while headings, page backgrounds, and muted text continued using the light branding palette.

This caused:

- dark cards with black headings,
- light page canvases behind dark cards,
- unreadable blue informational text,
- low-contrast staff and Investor profile pages,
- a dark sidebar with the primary black logo,
- branding previews being recoloured by application dark mode.

## Correction

- Branding now writes to dedicated `--gv-brand-*` variables.
- Semantic application variables remain controlled by light and dark themes.
- Dark mode now applies a consistent page, card, border, field, heading, body-text and status-colour palette.
- Staff and Investor navigation use the white/inverse logo in dark mode.
- Branding mockups remain light-mode previews and are not recoloured by the application theme.
- Report, PDF and email output remain independent from application dark mode.

## Testing checklist

1. Toggle dark mode from the staff header.
2. Review Dashboard, Investors, Reports, My Profile, Settings and Users & Roles.
3. Confirm page canvas, cards, inner panels, headings and body copy are readable.
4. Collapse and expand the staff sidebar; verify the logo remains visible.
5. Sign in as an Investor and review Dashboard, Reports, Goals, Notifications and Profile.
6. Confirm the Investor mobile header and bottom navigation remain readable.
7. Open Branding live previews and confirm they still show their configured light/report/email appearance.
8. Toggle back to light mode and confirm published branding colours still apply.

No Firebase rules or database migration is required.
