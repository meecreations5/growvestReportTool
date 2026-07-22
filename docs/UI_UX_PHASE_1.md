# GrowVest UI/UX Phase 1

## Scope completed

### Design foundation

- League Spartan for headings and display typography.
- Open Sauce One for body text, fields, tables, buttons and UI copy.
- Central GrowVest colour, spacing, radius, shadow and state tokens.
- Royal Trust Blue, Deep Premium Black, Strategic Red, Insight Yellow, Soft Gray, Medium Gray and White states.
- Visible focus states, reduced-motion support and minimum mobile touch targets.

### Shared components

- Updated Button, Card, Field and PageHeader primitives.
- Added StatusBadge, SectionHeader, EmptyState and Skeleton components.
- Consistent interaction, validation, disabled and focus states.

### Staff application shell

- Grouped role-aware navigation.
- Responsive mobile drawer.
- Branded sidebar profile card.
- Breadcrumb-style page context.
- Workspace search field.
- Quick-create menu.
- Notification and sign-out actions.

### Investor portal shell

- Mobile bottom navigation.
- Responsive desktop navigation panel.
- Dynamic GrowVest logo and profile context.
- Improved mobile safe-area spacing.

### Mobile-first Investor Login

- Mobile OTP is the default method.
- Password and Google remain available as secondary methods.
- Six-field OTP entry with auto-advance and paste support.
- OTP resend countdown.
- Password visibility control.
- Clear mobile-number guidance.
- Provider-specific success, error and Google-link setup states.
- Amber Google setup notice with direct fallback actions.
- Secure-access reassurance, staff-login handoff and support links.
- Full mobile layout without the desktop card border.

### Branding extensions

- Added white/inverse logo support for premium dark surfaces.
- Added separate application tagline, brand positioning and PDF footer tagline.
- Added letterhead contact defaults.
- Preserved original logo proportions in all shared logo placements.

### Shared PDF foundation

- Reusable React PDF page, header, footer and watermark shell.
- Letterhead-inspired top-right wordmark treatment.
- Reusable compact legal footer with icon, company name, contact data, document name and page number.
- Server-side `pdf-lib` document chrome helper.
- Monthly Report browser-print and server-generated PDFs now share the same visual hierarchy.

## New files

- `src/components/pdf/PdfDocumentShell.js`
- `src/lib/server/pdfDocumentShell.js`
- `src/components/ui/StatusBadge.js`
- `src/components/ui/SectionHeader.js`
- `src/components/ui/EmptyState.js`
- `src/components/ui/Skeleton.js`

## Important setup

Install the new font packages:

```bash
npm install
```

The project now includes:

```json
"@fontsource/league-spartan": "^5.3.0",
"@fontsource/open-sauce-one": "^5.3.0"
```

No manual font files are required.

## Testing checklist

1. Test staff navigation at 360 px, 768 px, 1024 px and 1440 px.
2. Test Investor Login with mobile OTP, password and Google states.
3. Test OTP paste, auto-advance, resend and invalid-code handling.
4. Test keyboard navigation through every login control.
5. Test Investor Portal bottom navigation on Android and iPhone-sized viewports.
6. Upload light, white, icon and watermark assets in Settings.
7. Generate browser-print and server PDFs and confirm the shared header/footer.
8. Run `npm run lint` and `npm run build` locally.

## Next UI/UX phase

UI/UX Phase 2 will redesign:

- Investor Dashboard
- Monthly Report list and mobile report experience
- Bucket List goals
- Meetings
- Profile and Login & Security
