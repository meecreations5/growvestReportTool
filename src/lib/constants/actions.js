export const ACTION_STATUSES = [
  "Requested",
  "Recommended",
  "Under Review",
  "Discussion Required",
  "Approved",
  "In Progress",
  "Completed",
  "Deferred",
  "Rejected",
  "Cancelled"
];

export const ACTION_TERMINAL_STATUSES = ["Completed", "Rejected", "Cancelled"];

export const ACTION_PRIORITIES = ["High", "Medium", "Planned", "Low", "Future"];

export const ACTION_OWNERS = ["Advisor", "Investor", "GrowVest", "Joint"];

export const INVESTOR_DECISIONS = [
  "Pending Discussion",
  "Approved",
  "Rejected",
  "Deferred",
  "Not Required"
];

export const INVESTOR_REQUEST_TYPES = [
  "Discuss Investment",
  "Increase SIP",
  "Start Lump Sum Investment",
  "Redemption Discussion",
  "Switch Fund Discussion",
  "Goal / Bucket List Change",
  "Loan Prepayment Discussion",
  "Insurance Review",
  "Portfolio Rebalancing",
  "Document Required",
  "Schedule Review Meeting",
  "Other / Custom"
];

export const ACTION_SOURCE_LABELS = {
  investor_request: "Investor Request",
  advisor_manual: "Advisor Action",
  monthly_report: "Monthly Report",
  portfolio: "Portfolio",
  goal: "Goal / Bucket List",
  meeting: "Meeting / MOM",
  system: "GrowVest"
};

export const ACTION_STATUS_TONES = {
  Requested: "blue",
  Recommended: "blue",
  "Under Review": "amber",
  "Discussion Required": "amber",
  Approved: "green",
  "In Progress": "cyan",
  Completed: "green",
  Deferred: "slate",
  Rejected: "red",
  Cancelled: "slate"
};

export function isActionOpen(status) {
  return !ACTION_TERMINAL_STATUSES.includes(String(status || ""));
}

export function actionDefaultTitle(requestType, contextName = "") {
  const type = String(requestType || "Other / Custom").trim();
  if (!contextName) return type;
  if (type === "Discuss Investment") return `Discuss ${contextName}`;
  if (type === "Goal / Bucket List Change") return `Review ${contextName}`;
  return `${type} — ${contextName}`;
}
