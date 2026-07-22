# Firestore Data Model

## Core collections

- `users`
- `usernames`
- `leads`
- `leadFollowUps`
- `investors`
- `meetingMinutes`
- `monthlyReports`
- `clientQueries`
- `monthlyUpdateLogs`
- `quarterlyReviewLogs`
- `renewalTrackers`
- `deadlineMissLogs`
- `servicingChecklists`
- `reportSettings`
- `activityLogs`
- `counters`

## User roles and authentication

Valid roles:

- `super_admin`
- `admin`
- `advisor`
- `investor`

Staff users must authenticate through Microsoft 365. Investor users authenticate through Firebase Phone or Firebase Password.

Investor user profile example:

```javascript
{
  uid: "firebase-uid",
  fullName: "Arjun Mehta",
  role: "investor",
  status: "active",
  investorId: "investor-document-id",
  clientCode: "GV-CL-2026-0001",
  username: "arjun.mehta",
  mobile: "+919876543210",
  portalEnabled: true,
  mustChangePassword: true,
  authMethods: ["username_password", "phone"]
}
```

The visible username maps to the Firebase email alias `<username>@investor.growvest.internal`. Passwords are never stored in Firestore.

## Record ownership

Every operational record should include:

- `createdByUid`
- `createdByName`
- `assignedAdvisorUid` or `advisorUid`
- `createdAt`
- `updatedAt`
- `isDeleted` where soft deletion applies

Investor-facing records should additionally include:

- `investorId`
- `investorPortalUid` when available
- `investorVisible`

## Important codes

- Lead: `GV-LD-YYYY-0001`
- Investor: `GV-CL-YYYY-0001`
- MOM: `GV-MOM-YYYY-0001`
- Report: `GV-RPT-YYYY-MM-0001`

## Investor data separation

Permanent profile data stays in `investors`. Monthly values are copied into a report snapshot inside `monthlyReports`, preventing later investor edits from changing a previously generated report.

Investors can read only:

- Their linked `investors/{investorId}` document
- Completed monthly reports with `investorVisible: true`
- MOM records with `investorVisible: true`

## Phase 2 lead workflow fields

`leads` additionally uses:

- `receivedAt`
- `statusChangedAt`
- `stageEnteredAt`
- `lastContactAt`
- `lastContactChannel`
- `lastContactSummary`
- `nextAction`
- `followUpDue`
- `proposalSentAt`
- `convertedAt`

`leadFollowUps` keeps one document per contact attempt. `activityLogs` keeps the immutable lead audit timeline.

## Phase 3 additions

### `clientAssessments/{leadId}`

Stores one active SOP 1 assessment per lead.

Key fields:

```javascript
{
  leadId,
  leadCode,
  leadName,
  assignedAdvisorUid,
  assessmentDate,
  personalProfile: {
    age,
    occupation,
    annualIncome,
    monthlySurplus,
    numberOfDependants,
    maritalStatus,
    currentInvestments,
    activeLiabilities
  },
  goals: {
    primaryGoal,
    targetAmount,
    timeline,
    secondaryGoal,
    goalNotes
  },
  investmentPreferences: {
    investmentType,
    preferredFrequency,
    sipAmount,
    lumpSumAmount,
    productsOfInterest
  },
  riskAssessment: {
    marketFallResponse,
    investmentHorizon,
    expectedReturn,
    investableSavings,
    totalScore,
    calculatedProfile,
    advisorOverride,
    overrideReason,
    finalProfile,
    recommendedProfile
  },
  qualification: {
    goalDefined,
    monthlySurplusConfirmed,
    timelineSuitable,
    liabilitiesManageable,
    totalScore,
    status
  },
  advisorNotes,
  status,
  convertedInvestorId,
  createdAt,
  updatedAt
}
```

### `investors/{investorId}`

Created through a qualified completed assessment. The record preserves a snapshot of the assessment and creates initial financial goals for future monthly reporting.

## Phase 4 additions

### `meetings/{meetingId}`

Core fields:

```javascript
{
  meetingCode,
  linkedType, // investor | lead | internal
  investorId,
  leadId,
  title,
  meetingType,
  meetingProvider,
  meetingDate,
  startTime,
  endTime,
  startAt,
  endAt,
  meetingLink,
  location,
  agenda: [],
  attendees: [],
  advisorUid,
  advisorName,
  advisorEmail,
  status, // scheduled | rescheduled | completed | cancelled
  investorVisible,
  communicationSettings: {},
  reminders: {},
  momId
}
```

### `meetingMinutes/{momId}`

```javascript
{
  momCode,
  meetingId,
  investorId,
  leadId,
  advisorUid,
  discussionSummary,
  clientSummary,
  internalNotes,
  decisions: [],
  actionItems: [],
  clientVisibleActionItems: [],
  followUpRequired,
  followUpDate,
  followUpPurpose,
  investorVisible,
  status // draft | completed
}
```

### `followUps/{followUpId}`

Generic follow-ups generated from MOMs, linked to the Investor/Lead, Meeting and MOM.

### `notifications/{notificationId}`

In-app notifications are addressed by `recipientUid` and contain a deep link to the related record.

### `communicationLogs/{logId}`

Server-written audit records for Brevo SMTP attempts and delivery request outcomes.
