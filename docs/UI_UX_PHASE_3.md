# GrowVest UI/UX Phase 3

UI/UX Phase 3 redesigns the Staff-side Client Assessment and Investor workspace while preserving the existing Firebase data model, validation and workflow logic.

## 1. Client Assessment

The assessment remains one continuous data model but now behaves like a guided workspace.

### Added

- Desktop sticky progress navigation
- Mobile horizontal section navigator
- Live completion percentage
- Active-section tracking while scrolling
- Direct jump to any assessment section
- Clear read-only, draft and completed states
- Sticky mobile Save Draft and Complete Assessment actions
- Improved unsaved-change warning
- Existing live risk, qualification and conversion summary retained

### Sections

1. Linked details
2. Financial profile
3. Bucket List
4. Existing investments
5. Liabilities
6. Investment preferences
7. Risk profile
8. Qualification
9. Advisor notes

## 2. Investor List

- Responsive KPI cards
- Search by client code, investor, contact or Advisor
- Risk-profile filter
- Portal-status filter
- Mobile investor cards instead of a wide table
- Desktop operational table retained
- Primary Bucket List goal and portal status shown clearly

## 3. Investor Profile

The former long profile page is now a tabbed Investor workspace.

### Profile tabs

- Overview
- Bucket List
- Portfolio
- Assessment
- Meetings
- Reports
- Access & Documents

### Overview

- Branded dark Investor hero
- Investor identity, risk and status
- Edit, meeting and report quick actions
- Primary goal and combined target
- Monthly investment capacity
- Qualification score
- Personal and financial snapshot
- Portfolio versus liabilities summary
- Upcoming review
- Quick links to the source Lead, Reports and Access

### Mobile behaviour

- Scrollable profile tabs
- Two-column KPI cards
- Investments and liabilities become readable record cards
- Quick actions remain touch friendly

## 4. Investor Profile Editor

The editor is divided into focused sections rather than one long page:

- Profile
- Bucket List
- Portfolio
- Preferences
- Advisor Notes

The editor includes Back, Save and Next controls in a sticky mobile action area. Validation automatically opens the section containing the first error.

## 5. New shared UI components

```text
src/components/ui/MetricCard.js
src/components/ui/ProgressNav.js
src/components/ui/SegmentedTabs.js
```

## 6. No data migration required

This phase changes presentation and interaction only. Existing collections, security rules and document structures remain compatible.

## 7. Test checklist

```text
Investors
→ Search and filter
→ Open Investor
→ Switch through every profile tab
→ Verify mobile portfolio cards
→ Edit Profile
→ Move through all editor sections
→ Save Profile

Lead
→ Open Assessment
→ Use section navigation
→ Add multiple Bucket List goals
→ Add preferences, investments and liabilities
→ Save Draft
→ Complete Assessment
→ Convert to Investor
```

## 8. Build

```bash
npm install
npm run build
npm run dev
```

No new Firestore indexes, rules or environment variables are required for UI/UX Phase 3.
