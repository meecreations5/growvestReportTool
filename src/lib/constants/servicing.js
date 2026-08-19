export const SERVICING_TABS = [
  { key: "overview", label: "Overview" },
  { key: "master", label: "Setup" },
  { key: "queries", label: "Service Requests" },
  { key: "monthly", label: "Communication" },
  { key: "quarterly", label: "Reviews" },
  { key: "renewals", label: "Renewals" },
  { key: "addendum", label: "Escalations" },
  { key: "checklist", label: "Checklist" }
];

export const QUERY_TYPES = [
  { value: "general", label: "General", limitHours: 8 },
  { value: "action_required", label: "Action Required", limitHours: 4 },
  { value: "complaint", label: "Complaint", limitHours: 2 },
  { value: "urgent", label: "Urgent", limitHours: 1 }
];

export const QUERY_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
export const CLIENT_SERVICING_STATUSES = ["ACTIVE", "AT RISK", "STALLED", "CHURNED", "PENDING"];
export const ADDENDUM_CATEGORIES = ["A", "B", "C"];

export const TAT_RULES = [
  { area: "Monthly Update", rule: "WhatsApp by Day 3", limit: "3 days" },
  { area: "Monthly Update", rule: "Email by Day 5", limit: "5 days" },
  { area: "Query Handling", rule: "General query", limit: "8 hours" },
  { area: "Query Handling", rule: "Action required query", limit: "4 hours" },
  { area: "Query Handling", rule: "Complaint query", limit: "2 hours" },
  { area: "Query Handling", rule: "Urgent query", limit: "1 hour" },
  { area: "Quarterly Review", rule: "Review invite", limit: "7 days before" },
  { area: "Quarterly Review", rule: "Review frequency", limit: "90 days" },
  { area: "Quarterly Review", rule: "Recap after review", limit: "24 hours" },
  { area: "Quarterly Review", rule: "Rebalancing completion", limit: "2 days" },
  { area: "Renewal", rule: "Renewal flag", limit: "60 days before" }
];

export const SERVICING_COLLECTIONS = {
  master: "clientServicingMaster",
  queries: "clientQueries",
  monthly: "monthlyUpdateLogs",
  quarterly: "quarterlyReviewLogs",
  renewals: "renewalTrackers",
  addendum: "deadlineMissLogs",
  checklist: "servicingChecklists"
};
