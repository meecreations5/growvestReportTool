export const SIP_REMINDER_DAY_OPTIONS = [30, 14, 7, 5, 3, 1, 0];

export const SIP_FUNDING_RESPONSES = [
  { value: "funds_available", label: "Funds Already Available" },
  { value: "will_add_funds", label: "I Will Add Funds" },
  { value: "funds_added", label: "Funds Added" },
  { value: "withdrawal_transfer", label: "Need Withdrawal / Transfer" },
  { value: "discuss_advisor", label: "Discuss With Advisor" },
  { value: "bank_mandate_issue", label: "Bank / Mandate Issue" }
];

export const SIP_FUNDING_STATUS_LABELS = {
  pending: "Awaiting Investor",
  awaiting_funds: "Investor Will Add Funds",
  ready: "Ready for SIP",
  needs_advisor: "Advisor Follow-up",
  service_request: "Service Request",
  completed: "Completed"
};

export function sipFundingStatusLabel(status) {
  return SIP_FUNDING_STATUS_LABELS[status] || "Awaiting Investor";
}
