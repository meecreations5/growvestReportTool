export const CLIENT_STATUSES = ["ACTIVE", "AT RISK", "STALLED", "CHURNED", "PENDING"];

export const RISK_PROFILES = [
  "Conservative",
  "Moderately Conservative",
  "Moderate",
  "Moderately Aggressive",
  "Aggressive"
];

export const INVESTMENT_TYPES = ["SIP", "Lump Sum", "Both", "Undecided"];

export const ADVISORY_AREAS = [
  "Mutual Funds",
  "SIP",
  "Fixed Deposits",
  "Stocks",
  "Insurance",
  "PMS",
  "AIF",
  "Financial Planning",
  "Retirement Planning",
  "Tax Planning",
  "Estate Planning",
  "Other"
];

export const QUERY_TYPES = [
  { value: "general", label: "General", tatHours: 8 },
  { value: "action_required", label: "Action Required", tatHours: 4 },
  { value: "complaint", label: "Complaint", tatHours: 2 },
  { value: "urgent", label: "Urgent", tatHours: 1 }
];

export const SERVICING_TAT_RULES = [
  { area: "Monthly Update", rule: "WhatsApp by Day 3", limit: 3, unit: "days" },
  { area: "Monthly Update", rule: "Email by Day 5", limit: 5, unit: "days" },
  { area: "Query Handling", rule: "General query", limit: 8, unit: "hours" },
  { area: "Query Handling", rule: "Action required query", limit: 4, unit: "hours" },
  { area: "Query Handling", rule: "Complaint query", limit: 2, unit: "hours" },
  { area: "Query Handling", rule: "Urgent query", limit: 1, unit: "hour" },
  { area: "Quarterly Review", rule: "Review invite", limit: 7, unit: "days before" },
  { area: "Quarterly Review", rule: "Review frequency", limit: 90, unit: "days" },
  { area: "Quarterly Review", rule: "Recap after review", limit: 24, unit: "hours" },
  { area: "Quarterly Review", rule: "Rebalancing completion", limit: 2, unit: "days" },
  { area: "Renewal", rule: "Renewal flag", limit: 60, unit: "days before" }
];
