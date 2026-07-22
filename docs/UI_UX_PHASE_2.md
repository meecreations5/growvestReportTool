# GrowVest UI/UX Phase 2

UI/UX Phase 2 builds the mobile-first Investor experience on top of the Phase 1 design system and application shell.

## Scope delivered

### Investor Portal shell

- Compact mobile header with dynamic GrowVest branding
- Investor greeting, notification access and sign-out
- Desktop Investor navigation with a secure-access explanation
- Mobile bottom navigation: Home, Reports, Goals, Meetings and Profile
- Profile and security menu on desktop
- Safe-area support for modern mobile devices

### Investor Dashboard

- Mobile-first wealth-summary hero
- Latest portfolio value and month movement
- Overall Bucket List progress
- Monthly SIP, new money, gain and active-goal indicators
- Primary Bucket List goal card
- Quick access to Reports, Goals and Reviews
- Upcoming meeting card with join link
- Assigned Advisor contact card
- Latest client-visible MOM summary
- Responsive loading and error states

### Bucket List Goals

New route:

```text
/investor/goals
```

Features:

- Searchable goals
- On Track, Near Completion, Attention Required, Not Started and Completed filters
- Primary-goal badge
- Current versus target value
- Goal progress bar
- Target date and monthly contribution
- Mobile cards and responsive desktop grid

### Monthly Reports

- Featured latest report card
- Portfolio value and monthly movement
- Mobile-first report history cards
- Search and year filter
- Secure PDF download status
- Latest/published version indication
- Responsive empty and loading states

### Interactive report view

- Sticky mobile report section navigation
- Overview, Insights, Goals, Allocation, Holdings, Actions and Review anchors
- Asset-allocation table converted into mobile cards
- Fund-wise holdings converted into mobile cards
- Sticky mobile Download PDF and Discuss actions
- Improved mobile spacing and action-item layout

### Meetings and MOM

- Upcoming, Past and Meeting Summaries tabs
- Mobile meeting cards
- Join meeting action
- Downloadable calendar `.ics` file
- Client-visible MOM summary cards
- Meeting and summary status counters

### Investor Profile

- Strong profile identity header
- Client code, risk profile and portal status
- Personal details grouped for mobile
- Assigned Advisor card with Email and Call actions
- Primary Bucket List goal preview
- Direct links to Login & Security, Documents and Reports

### Documents

- Requested, uploaded and verified counters
- Responsive document cards
- Upload/replace/download actions
- Secure-storage reassurance

### Login & Security

- Phase 1 provider-aware authentication retained
- Updated mobile-first page hierarchy
- Linked Password, Mobile OTP and Google status cards
- Google account linking action
- Responsive password management form

### Staff Login refinement

- Mobile wide logo and Staff Workspace identity
- Improved vertical centring
- Clearer redirect sign-in treatment
- Improved Investor Portal handoff
- High-contrast desktop hero retained

## No database migration

UI/UX Phase 2 does not introduce new Firestore collections, indexes or security rules.

## Installation

Copy the existing `.env.local` into this project, then run:

```powershell
npm install
npm run build
npm run dev
```

The Phase 1 Fontsource packages remain required:

```powershell
npm install @fontsource/league-spartan@5.3.0 @fontsource/open-sauce-one@5.3.0
```

## Test checklist

### Mobile sizes

Test at approximately:

```text
360 x 800
390 x 844
430 x 932
```

Verify:

- Investor Login uses Mobile OTP by default
- Bottom navigation does not cover page content
- Dashboard portfolio value is visible without horizontal scrolling
- Goal cards fit one column
- Report allocation and fund data appear as cards
- PDF and Discuss actions remain reachable
- Meeting links open in a new tab
- `.ics` calendar downloads successfully
- Profile actions remain touch-friendly

### Desktop

Verify:

- Desktop Investor sidebar remains visible
- User menu opens correctly
- Report tables remain visible from `md` breakpoint upward
- Mobile card duplicates are hidden on desktop
- Report section navigation scrolls to the correct section

## Deferred to UI/UX Phase 3

- Admin Dashboard redesign
- Lead list and lead detail redesign
- Investor profile redesign for staff users
- Client assessment wizard
- Advisor operational dashboard
