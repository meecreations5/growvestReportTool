export const COMMENTARY_STATUS = {
  DRAFT: "draft",
  APPROVED: "approved",
  ARCHIVED: "archived"
};

export const COMMENTARY_STATUS_LABELS = {
  [COMMENTARY_STATUS.DRAFT]: "Draft",
  [COMMENTARY_STATUS.APPROVED]: "Approved",
  [COMMENTARY_STATUS.ARCHIVED]: "Archived"
};

export const COMMENTARY_CATEGORY = {
  MONTHLY_SUMMARY: "monthly_summary",
  EQUITY: "equity",
  INDEX: "index",
  DEBT: "debt",
  RISK: "risk",
  STRATEGY: "strategy",
  OUTLOOK: "outlook",
  ADVISOR_NOTE: "advisor_note",
  DISCLAIMER: "disclaimer"
};

export const COMMENTARY_CATEGORY_OPTIONS = [
  {
    value: COMMENTARY_CATEGORY.MONTHLY_SUMMARY,
    label: "Monthly Market Summary",
    description: "High-level summary of market conditions and the month under review."
  },
  {
    value: COMMENTARY_CATEGORY.EQUITY,
    label: "Equity Commentary",
    description: "Equity market movement, portfolio participation and relevant observations."
  },
  {
    value: COMMENTARY_CATEGORY.INDEX,
    label: "Index Commentary",
    description: "NIFTY, SENSEX or other benchmark context for the reporting period."
  },
  {
    value: COMMENTARY_CATEGORY.DEBT,
    label: "Debt & Fixed Income",
    description: "Interest-rate, liquidity and fixed-income observations."
  },
  {
    value: COMMENTARY_CATEGORY.RISK,
    label: "Risk Commentary",
    description: "Risk, volatility, concentration or portfolio-protection observations."
  },
  {
    value: COMMENTARY_CATEGORY.STRATEGY,
    label: "Strategy Commentary",
    description: "Disciplined strategy, allocation or rebalancing guidance."
  },
  {
    value: COMMENTARY_CATEGORY.OUTLOOK,
    label: "Outlook",
    description: "Forward-looking themes and priorities for the next reporting period."
  },
  {
    value: COMMENTARY_CATEGORY.ADVISOR_NOTE,
    label: "Reusable Advisor Note",
    description: "Reusable language that Advisors can adapt for Investor reports."
  },
  {
    value: COMMENTARY_CATEGORY.DISCLAIMER,
    label: "Disclaimer",
    description: "Approved disclaimer or important-notes content for reports."
  }
];

export const COMMENTARY_SCOPE = {
  MONTHLY: "monthly",
  REUSABLE: "reusable"
};

export const COMMENTARY_SCOPE_OPTIONS = [
  { value: COMMENTARY_SCOPE.MONTHLY, label: "Reporting month" },
  { value: COMMENTARY_SCOPE.REUSABLE, label: "Reusable library" }
];

export const COMMENTARY_TARGET_OPTIONS = [
  { value: "narrative", label: "Advisor narrative" },
  { value: "progressHighlight", label: "Progress highlight" },
  { value: "priorityAttention", label: "Priority attention" },
  { value: "portfolioOpportunity", label: "Portfolio opportunity" },
  { value: "advisorHighlight", label: "Highlighted observation" },
  { value: "disclaimer", label: "Report disclaimer" }
];

export function getCommentaryCategoryLabel(category) {
  return COMMENTARY_CATEGORY_OPTIONS.find((item) => item.value === category)?.label || "Commentary";
}

export function defaultCommentaryTarget(category) {
  if (category === COMMENTARY_CATEGORY.RISK) return "priorityAttention";
  if (category === COMMENTARY_CATEGORY.STRATEGY || category === COMMENTARY_CATEGORY.OUTLOOK) return "portfolioOpportunity";
  if (category === COMMENTARY_CATEGORY.DISCLAIMER) return "disclaimer";
  if (category === COMMENTARY_CATEGORY.ADVISOR_NOTE) return "narrative";
  return "narrative";
}

export function createEmptyMarketCommentary(date = new Date()) {
  return {
    title: "",
    category: COMMENTARY_CATEGORY.MONTHLY_SUMMARY,
    status: COMMENTARY_STATUS.DRAFT,
    scope: COMMENTARY_SCOPE.MONTHLY,
    reportMonth: date.getMonth() + 1,
    reportYear: date.getFullYear(),
    reportMonthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    summary: "",
    content: "",
    tags: [],
    applicableAssetClasses: [],
    investorVisible: true,
    internalNote: "",
    version: 1,
    revision: 1
  };
}
