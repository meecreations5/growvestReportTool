# GrowVest Investor Report Tool — UI/UX Phase 4

UI/UX Phase 4 builds on Phase 3 and redesigns the operational client-engagement modules: Meetings, Minutes of Meeting (MOM), action items, and Client Servicing.

## Design foundation

- League Spartan for headings
- Open Sauce One for body and interface text
- GrowVest Royal Trust Blue, Deep Premium Black, Strategic Red, Insight Yellow, Soft Gray, Medium Gray and White
- Responsive cards on mobile instead of desktop-only tables
- Clear separation between Investor-visible information and internal advisory notes
- Touch-friendly actions and sticky mobile action bars

## Meetings workspace

### Meeting list

- Mobile meeting cards
- Desktop operational table
- Upcoming, Today, MOM Pending, Completed, Cancelled and All views
- Meeting, Investor, lead and Advisor search
- KPI summary for upcoming meetings, today's meetings, pending MOMs and completed meetings
- Direct Join and Open actions on mobile

### Meeting creation and editing

The previous long form is now a guided workflow:

1. Client Context
2. Schedule
3. Participants
4. Agenda
5. Notifications
6. Review

Enhancements:

- Desktop progress navigation
- Mobile horizontal progress navigation
- Section completion indicators
- Linked Investor/lead preview
- Agenda preview
- Participant-level Email and WhatsApp choices
- Notification cards for Email, in-app visibility and reminders
- Final review before scheduling
- Sticky mobile Back and Continue actions
- Existing Brevo email, `.ics`, WhatsApp and in-app notification behaviour retained

### Meeting detail

- Premium dark meeting header
- Prominent date, mode, Advisor and client context
- Direct Join Meeting action
- Responsive agenda and attendee cards
- Communication delivery panel
- MOM creation panel
- Mobile sticky Join/Create MOM actions

## Minutes of Meeting

### MOM list

- Mobile MOM cards and desktop table
- All, Draft, Completed, Open Actions and Investor Visible views
- KPI summary for completed records, drafts, open action items and published client-safe MOMs
- Clear visibility and open-action indicators

### MOM completion workflow

1. Summaries
2. Discussion
3. Decisions
4. Action Items
5. Publish

Enhancements:

- Clear **Visible to Investor** and **Internal Only** panels
- Separate client-facing summary and internal discussion record
- Structured financial discussion areas
- Repeatable decisions and action items
- Client visibility toggle on each decision/action
- Follow-up and publishing review
- Completion summary before publishing
- Sticky mobile actions

### MOM detail

- Premium header with status, client, open actions and Investor visibility
- Client-facing summary visually separated from internal record
- Clear decision and action visibility badges
- Responsive action cards
- Email, WhatsApp, print/PDF and linked-record actions
- Existing dynamic watermark and print branding retained

## Client Servicing

- Replaced basic tabs with responsive segmented navigation
- KPI dashboard for active clients, open queries, breaches, renewals and escalations
- Priority servicing queue for breached operational items
- Mobile cards for the 11-rule TAT monitor
- Mobile query cards with TAT and resolution actions
- Desktop tables retained for operational density
- Existing Client Master, Monthly Updates, Quarterly Reviews, Renewals, Addendum A and Checklist functionality retained

## Data and backend impact

This phase is presentation and workflow focused.

- No new Firestore collections
- No new Firestore indexes
- No new environment variables
- Existing meeting, MOM, notification, communication and servicing services remain unchanged

## Run and test

```powershell
npm install
npm run build
npm run dev
```

Test these routes:

```text
/meetings
/meetings/create
/meetings/[meetingId]
/mom
/mom/create?meetingId=[meetingId]
/mom/[momId]
/servicing
```

## Suggested test journey

```text
Schedule Meeting
→ Add participants
→ Configure email, WhatsApp and reminders
→ Review and schedule
→ Open meeting
→ Mark completed
→ Create MOM
→ Separate client-facing and internal content
→ Add decisions and action items
→ Publish MOM
→ Open Client Servicing
→ Log and resolve a query
→ Review TAT and escalation dashboard
```

## Validation completed in the delivery environment

- JavaScript and JSX syntax parsing across 176 files
- All local `@/` imports resolved
- JSON configuration validation
- ZIP integrity validation

The full Next.js production build still needs to be run locally after dependency installation.
