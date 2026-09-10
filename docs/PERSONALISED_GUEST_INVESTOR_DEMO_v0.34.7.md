# GrowVest v0.34.7 — Personalised Guest Investor Demo

## Purpose

The Investor Demo is a public, Investor-only experience. A guest enters a name and mobile number and receives a deterministic synthetic Investor App experience. No real Investor Master, portfolio, report, document, household, staff, or Admin data is used by the demo.

## Lead conversion trigger

The lead is created at the moment the guest selects **Become part of GrowVest**.

That CTA is the explicit transition from demo exploration into the normal GrowVest prospect journey:

1. Guest explores the personalised Investor Demo.
2. Guest selects **Become part of GrowVest**.
3. `/api/demo/prospect` receives `action: "express_interest"`.
4. A normal document is created in the existing `leads` collection with `status: "NEW"` and `leadSource: "Investor App Demo"`.
5. The lead carries `originalLeadFlow: "SOP 1 - Lead to Conversion"` and the standard Lead module can continue from there.
6. The guest is shown an optional enrichment screen for email, city, area of interest and preferred contact.
7. Enrichment updates the same Lead. It never creates a second Lead for the same Demo session.

## Idempotency and duplicate protection

The demo Lead document ID is deterministic from the Demo session and mobile number. Repeated CTA clicks return/update the same Lead instead of consuming another Lead code.

A per-mobile daily limit remains in place for genuinely new Demo sessions. Re-engagement on an existing Demo Lead records an activity without resetting staff-managed status or assignment.

## Data-integrity rule

After a Demo Lead enters the normal workflow, public enrichment must not overwrite staff-entered contact/opportunity data. Guest-provided enrichment is retained in dedicated `demoGuest*` fields and only fills the normal email/city/purpose/preferred-contact fields when those fields are still empty.

## Lead fields created at CTA

Key fields include:

- `leadCode`
- `fullName`
- `contactNo` / `mobile`
- `leadSource: "Investor App Demo"`
- `leadOrigin: "personalised_guest_investor_demo"`
- `status: "NEW"`
- `serviceType: "Financial Planning"`
- `nextAction: "Contact prospect who chose Become part of GrowVest."`
- `consentToContact: true`
- `consentSource: "Become part of GrowVest CTA"`
- `conversionIntent: "BECOME_GROWVEST"`
- `demoSessionId`
- `originalLeadFlow: "SOP 1 - Lead to Conversion"`
- `originalLeadFlowStartedAt`

The Lead is intentionally created as **Unassigned**. Super Admin/Admin can assign the appropriate Advisor and continue the existing SOP 1 workflow without a parallel demo-specific pipeline.

## Guest-facing flow

The enrichment screen explains that the GrowVest conversation has already started. Email and city remain optional, and the guest may continue exploring the demo without filling them.

## Security boundary

`/api/demo/prospect` remains the only intentionally public application API. It is bounded by validation, honeypot handling, deterministic idempotency and per-mobile daily new-Lead limiting. Demo access does not grant any Admin, Advisor, Operations, Compliance, Vendor or real Investor permissions.
