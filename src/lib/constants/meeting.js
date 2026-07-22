export const MEETING_TYPES = [
  { value: "initial_consultation", label: "Initial Consultation" },
  { value: "client_assessment", label: "Client Assessment" },
  { value: "financial_planning", label: "Financial Planning Discussion" },
  { value: "investment_proposal", label: "Investment Proposal Discussion" },
  { value: "portfolio_review", label: "Portfolio Review" },
  { value: "monthly_review", label: "Monthly Review" },
  { value: "quarterly_review", label: "Quarterly Review" },
  { value: "bucket_list_review", label: "Bucket List Review" },
  { value: "risk_profile_review", label: "Risk Profile Review" },
  { value: "service_review", label: "Service Review" },
  { value: "internal", label: "Internal Meeting" },
  { value: "other", label: "Other" }
];

export const MEETING_PROVIDERS = [
  { value: "microsoft_teams", label: "Microsoft Teams", online: true },
  { value: "google_meet", label: "Google Meet", online: true },
  { value: "zoom", label: "Zoom", online: true },
  { value: "whatsapp_call", label: "WhatsApp Call", online: false },
  { value: "phone_call", label: "Phone Call", online: false },
  { value: "physical", label: "Physical Meeting", online: false },
  { value: "manual_link", label: "Other Online Meeting", online: true }
];

export const MEETING_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "cancelled", label: "Cancelled" }
];

export const ACTION_PRIORITIES = ["high", "medium", "low"];
export const ACTION_STATUSES = ["pending", "in_progress", "completed", "cancelled"];
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";
export const DEFAULT_MEETING_DURATION_MINUTES = 60;

export function meetingTypeLabel(value) {
  return MEETING_TYPES.find((item) => item.value === value)?.label || value || "—";
}

export function meetingProviderLabel(value) {
  return MEETING_PROVIDERS.find((item) => item.value === value)?.label || value || "—";
}

export function isOnlineMeetingProvider(value) {
  return Boolean(MEETING_PROVIDERS.find((item) => item.value === value)?.online);
}
