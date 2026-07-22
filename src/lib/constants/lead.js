export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "WARM",
  "NOT QUALIFIED",
  "IN PROPOSAL",
  "COMMITTED — PENDING",
  "CONVERTED",
  "LONG FOLLOW-UP",
  "DROPPED",
  "LAPSE — CLIENT SIDE",
  "LAPSE — COMPANY SIDE",
  "RECOVERED"
];

export const LEAD_CLOSURE_STATUSES = [
  "NOT QUALIFIED",
  "DROPPED",
  "LAPSE — CLIENT SIDE",
  "LAPSE — COMPANY SIDE"
];

export function requiresLeadClosureReason(status) {
  return LEAD_CLOSURE_STATUSES.includes(status);
}

export const LEAD_SOURCES = [
  "Referral",
  "Instagram",
  "LinkedIn",
  "Event / Seminar",
  "Walk-in",
  "Website",
  "Cold Outreach",
  "Existing Client",
  "Partner",
  "Other"
];

export const SERVICE_TYPES = [
  "Financial Planning",
  "MF/SIP",
  "Portfolio Management",
  "Debt Management",
  "Insurance Planning",
  "Retirement Planning",
  "Tax Planning",
  "Estate Planning",
  "PMS",
  "AIF",
  "Other"
];

export const CONTACT_CHANNELS = [
  "Call",
  "WhatsApp",
  "Email",
  "In Person",
  "Google Meet",
  "Microsoft Teams",
  "Zoom",
  "Other"
];

export const LEAD_TAT_RULES = [
  { step: "Lead Entry", action: "Log in tracker", limitHours: 2 },
  { step: "Lead Entry", action: "Send opening WhatsApp", limitHours: 2 },
  { step: "Qualification", action: "Complete qualification", limitHours: 24 },
  { step: "Consultation", action: "Schedule and complete consultation", limitHours: 48 },
  { step: "Proposal", action: "Deliver proposal", limitHours: 48 },
  { step: "Follow-up", action: "Day 2 check-in", day: 2 },
  { step: "Follow-up", action: "Proposal walk-through call", day: 4 },
  { step: "Follow-up", action: "Soft nudge", day: 7 },
  { step: "Follow-up", action: "Direct conversion call", day: 10 },
  { step: "Conversion", action: "Log final outcome", day: 14 },
  { step: "Conversion", action: "Trigger onboarding SOP", limitHours: 1 }
];
