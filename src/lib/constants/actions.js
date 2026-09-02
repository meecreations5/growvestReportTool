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

export const ACTION_FINANCIAL_IMPACT_TYPES = {
  NONE: "none",
  EXTERNAL_INFLOW: "external_inflow",
  EXTERNAL_OUTFLOW: "external_outflow",
  INTERNAL_CHANGE: "internal_change"
};

export const ACTION_FINANCIAL_IMPACT_STATUSES = {
  NOT_APPLICABLE: "not_applicable",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  AWAITING_PORTFOLIO_CONFIRMATION: "awaiting_portfolio_confirmation",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled"
};

export const ACTION_PRIORITIES = ["High", "Medium", "Planned", "Low", "Future"];

export const ACTION_OWNERS = ["Advisor", "Investor", "GrowVest", "Joint"];

export const INVESTOR_DECISIONS = [
  "Pending Discussion",
  "Approved",
  "Rejected",
  "Deferred",
  "Not Required"
];

export const STRUCTURED_WITHDRAWAL_REQUEST_TYPE = "Portfolio Withdrawal / Redemption";
export const WITHDRAWAL_MODES = ["partial", "full"];
export const WITHDRAWAL_SIP_INSTRUCTIONS = ["continue", "pause", "stop"];

export const INVESTOR_REQUEST_TYPES = [
  STRUCTURED_WITHDRAWAL_REQUEST_TYPE,
  "Discuss Investment",
  "Invest More",
  "Start SIP",
  "Increase SIP",
  "Reduce SIP",
  "Pause SIP",
  "Stop SIP",
  "Start Lump Sum Investment",
  "Trading Account Deposit",
  "Trading Account Withdrawal",
  "Partial Redemption",
  "Full Redemption",
  "Switch Investment",
  "Goal / Bucket List Change",
  "Correct Portfolio Information",
  "Add Investment Information",
  "SIP Funding / Withdrawal",
  "SIP Funding Discussion",
  "Redemption Discussion",
  "Switch Fund Discussion",
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
  sip_funding: "SIP Funding",
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

export function actionFinancialImpactType(requestType = "") {
  const type = String(requestType || "").trim();
  if (["Invest More", "Start SIP", "Increase SIP", "Start Lump Sum Investment", "Trading Account Deposit"].includes(type)) {
    return ACTION_FINANCIAL_IMPACT_TYPES.EXTERNAL_INFLOW;
  }
  if ([STRUCTURED_WITHDRAWAL_REQUEST_TYPE, "Partial Redemption", "Full Redemption", "Trading Account Withdrawal"].includes(type)) {
    return ACTION_FINANCIAL_IMPACT_TYPES.EXTERNAL_OUTFLOW;
  }
  if (["Reduce SIP", "Pause SIP", "Stop SIP", "Switch Investment", "Switch Fund Discussion", "Goal / Bucket List Change", "Portfolio Rebalancing"].includes(type)) {
    return ACTION_FINANCIAL_IMPACT_TYPES.INTERNAL_CHANGE;
  }
  return ACTION_FINANCIAL_IMPACT_TYPES.NONE;
}

export function actionFinancialImpactStatus(status = "", impactType = ACTION_FINANCIAL_IMPACT_TYPES.NONE, currentStatus = "") {
  if (currentStatus === ACTION_FINANCIAL_IMPACT_STATUSES.CONFIRMED) return currentStatus;
  if (impactType === ACTION_FINANCIAL_IMPACT_TYPES.NONE) return ACTION_FINANCIAL_IMPACT_STATUSES.NOT_APPLICABLE;
  const workflowStatus = String(status || "");
  if (["Rejected", "Cancelled"].includes(workflowStatus)) return ACTION_FINANCIAL_IMPACT_STATUSES.CANCELLED;
  if (workflowStatus === "Completed") return ACTION_FINANCIAL_IMPACT_STATUSES.AWAITING_PORTFOLIO_CONFIRMATION;
  if (workflowStatus === "In Progress") return ACTION_FINANCIAL_IMPACT_STATUSES.IN_PROGRESS;
  return ACTION_FINANCIAL_IMPACT_STATUSES.PLANNED;
}

export function isStructuredWithdrawalAction(actionOrType = {}) {
  const type = typeof actionOrType === "string"
    ? actionOrType
    : (actionOrType?.requestType || actionOrType?.recommendationType || "");
  return String(type || "").trim() === STRUCTURED_WITHDRAWAL_REQUEST_TYPE;
}

export function isActionOpen(actionOrStatus) {
  const action = actionOrStatus && typeof actionOrStatus === "object" ? actionOrStatus : { status: actionOrStatus };
  const status = String(action.status || "");
  if (status === "Completed" && action.financialImpactStatus === ACTION_FINANCIAL_IMPACT_STATUSES.AWAITING_PORTFOLIO_CONFIRMATION) return true;
  return !ACTION_TERMINAL_STATUSES.includes(status);
}

export function actionDefaultTitle(requestType, contextName = "") {
  const type = String(requestType || "Other / Custom").trim();
  if (!contextName) return type;
  if (type === "Discuss Investment") return `Discuss ${contextName}`;
  if (type === "Goal / Bucket List Change") return `Review ${contextName}`;
  return `${type} — ${contextName}`;
}
