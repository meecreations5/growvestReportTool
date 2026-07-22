# Phase 3 Completion - Client Assessment and Investor Profile

Version: 0.4.0

## Completed scope

- Multiple financial goals / bucket-list rows inside the client assessment
- Exactly one primary goal with any number of additional goals
- Goal target, current corpus, target year, timeline, monthly contribution, priority, type and status
- Structured existing investment records
- Structured liability and EMI records
- Save draft and complete assessment
- Completed assessment read-only mode with explicit reassessment action
- Unsaved-change warning
- Assessment version history in `assessmentVersions`
- Risk and qualification scoring
- Advisor override and mandatory reason
- Proposal summary with browser Print / Save PDF
- Duplicate-safe lead-to-investor conversion through a Firestore transaction
- Automatic client-code generation
- Conversion of all assessment buckets, investments and liabilities into the investor profile
- Investor profile editing
- Investor bucket-list progress display
- Structured investor investments and liabilities display
- Investor-side bucket-list view
- Investor profile update activity log

## New routes

```text
/leads/[leadId]/assessment/summary
/investors/[investorId]/edit
```

## New Firestore collection

```text
assessmentVersions
```

Each version stores the assessment snapshot, version number, save status, user and timestamp.

## Required deployment

```bash
firebase use growvest-reporttool
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

The new `assessmentVersions` query requires the included composite index.

## Suggested verification

1. Create or open a lead.
2. Start the assessment.
3. Add three bucket-list goals.
4. Select exactly one primary goal.
5. Add an existing investment and a liability.
6. Save as draft.
7. Reopen and complete the assessment.
8. Open the proposal summary and use Print / Save PDF.
9. Edit the completed assessment and save a reassessment.
10. Confirm version history shows both versions.
11. Convert the lead to an investor.
12. Confirm duplicate conversion opens the same investor rather than creating another.
13. Edit the investor profile and add another bucket.
14. Confirm the staff and investor profile views show the updated bucket list.

## Phase 3 boundary

MOM, investor account provisioning UI, document uploads and the six-page monthly portfolio report generator remain future phases.
