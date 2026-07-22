# Phase 3 — Client Assessment and Investor Conversion

Phase 3 digitises the GrowVest SOP 1 Client Assessment Sheet and connects it to the existing lead workflow.

## Implemented

- Assessment route: `/leads/[leadId]/assessment`
- Lead details automatically linked to the assessment
- Personal and financial profile
- Primary and secondary investment goals
- SIP, lump sum and preferred frequency
- Advisory areas of interest
- Four-question risk assessment
- Exact SOP risk calculation:
  - 1–8: Conservative
  - 9–14: Moderate
  - 15–20: Aggressive
- Advisor risk override with mandatory reason
- Exact SOP qualification score:
  - Goal clarity: maximum 2 points
  - Monthly surplus confirmed: maximum 1 point
  - Timeline of 3+ years: maximum 1 point
  - No blocking liabilities: maximum 1 point
- Qualification result:
  - 4–5: Qualified
  - 2–3: Follow-up Required
  - 0–1: Not Ready
- Advisor-only assessment notes
- Save draft and complete assessment actions
- Automatic proposal summary
- Automatic lead pipeline update after completion
- Qualified lead-to-investor conversion
- Automatic client code: `GV-CL-YYYY-0001`
- Investor list at `/investors`
- Investor profile at `/investors/[investorId]`
- Investor goals, risk profile, preferences and assessment context
- Lead and activity audit records
- Firestore rules and indexes for assessments and investors

## Firestore collections

```text
clientAssessments
investors
counters/investors
activityLogs
```

The assessment document ID is the linked Lead document ID. This ensures one active SOP 1 assessment per lead in the MVP.

## Test workflow

```text
Create/Open Lead
→ Start Assessment
→ Save Draft
→ Complete all required fields
→ Complete Assessment
→ Verify risk and qualification scores
→ Convert to Investor
→ Open Investor Profile
```

## Firebase deployment

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

The new investor list queries require the included composite indexes.

## Current limitation

Phase 3 creates the investor profile from the completed assessment. Investor profile editing, documents, MOM integration, portal account provisioning and monthly report creation are scheduled for later phases.
