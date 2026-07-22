export const REPORT_STATUS = {
  DRAFT: "draft",
  COMPLETED: "completed",
  LOCKED: "locked"
};

export const REPORT_STATUS_OPTIONS = [
  { value: REPORT_STATUS.DRAFT, label: "Draft" },
  { value: REPORT_STATUS.COMPLETED, label: "Completed" },
  { value: REPORT_STATUS.LOCKED, label: "Locked" }
];

export const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
].map((label, index) => ({ value: index + 1, label }));

export const ASSET_CLASS_OPTIONS = [
  "Equity",
  "Debt",
  "Liquid",
  "Cash",
  "Insurance",
  "Trading",
  "Gold",
  "Real Estate",
  "Other"
];

export const ASSET_CLASS_COLORS = {
  Equity: "#2557D6",
  Debt: "#737D8C",
  Liquid: "#20B8CD",
  Cash: "#F5B700",
  Insurance: "#D5DAE4",
  Trading: "#EF4444",
  Gold: "#D99A00",
  "Real Estate": "#7C3AED",
  Other: "#64748B"
};

export const GOAL_STATUS_OPTIONS = [
  "Not Started",
  "Planning",
  "SIP Running",
  "On Track",
  "Review Needed",
  "Paused",
  "Completed"
];

export const ACTION_STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Cancelled"];
export const ACTION_OWNER_OPTIONS = ["Investor", "Advisor", "GrowVest", "Joint"];
export const ACTION_PRIORITY_OPTIONS = ["High", "Medium", "Planned", "Future", "Low"];
export const HIGHLIGHT_TYPE_OPTIONS = [
  { value: "success", label: "Positive progress" },
  { value: "info", label: "Goal milestone" },
  { value: "warning", label: "Opportunity / review" },
  { value: "danger", label: "Priority attention" }
];

export const DEFAULT_REPORT_DISCLAIMER =
  "This report is prepared exclusively for the named investor and is confidential. It is intended as a portfolio communication and should not be treated as a solicitation or guarantee of future performance. Past performance is not indicative of future results.";

export function getMonthLabel(month) {
  return MONTH_OPTIONS.find((item) => item.value === Number(month))?.label || "";
}

export function getReportMonthKey(year, month) {
  return `${Number(year)}-${String(Number(month)).padStart(2, "0")}`;
}

export function calculatePercentage(value, total) {
  const numerator = Number(value || 0);
  const denominator = Number(total || 0);
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export function createEmptyHolding(index = 0) {
  const assetClass = ASSET_CLASS_OPTIONS[index] || "Other";
  return {
    id: `holding-${Date.now()}-${index}`,
    assetClass,
    currentValue: 0,
    percentage: 0,
    color: ASSET_CLASS_COLORS[assetClass] || ASSET_CLASS_COLORS.Other
  };
}

export function createEmptyAllocation(index = 0) {
  const assetClass = ASSET_CLASS_OPTIONS[index] || "Other";
  return {
    id: `allocation-${Date.now()}-${index}`,
    assetClass,
    currentValue: 0,
    monthlySip: 0,
    currentPercentage: 0,
    targetPercentage: 0,
    variance: 0
  };
}

export function createEmptyFund(index = 0) {
  return {
    id: `fund-${Date.now()}-${index}`,
    instrumentName: "",
    assetClass: "Equity",
    goalId: "",
    goalName: "",
    monthlySip: 0,
    currentValue: 0,
    type: "Fixed",
    notes: ""
  };
}

export function createEmptyAction(index = 0) {
  return {
    id: `action-${Date.now()}-${index}`,
    title: "",
    description: "",
    owner: "Advisor",
    priority: "Planned",
    dueDate: "",
    status: "Pending"
  };
}

export function createEmptyHighlight(index = 0) {
  return {
    id: `highlight-${Date.now()}-${index}`,
    type: index === 0 ? "success" : index === 1 ? "info" : index === 2 ? "warning" : "danger",
    title: "",
    description: ""
  };
}


function inferAssetClass(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("liquid")) return "Liquid";
  if (text.includes("cash")) return "Cash";
  if (text.includes("insurance") || text.includes("lic")) return "Insurance";
  if (text.includes("gold")) return "Gold";
  if (text.includes("trading") || text.includes("f&o") || text.includes("stock trading")) return "Trading";
  if (text.includes("real estate") || text.includes("property")) return "Real Estate";
  if (text.includes("fd") || text.includes("fixed deposit") || text.includes("ppf") || text.includes("bond") || text.includes("debt")) return "Debt";
  if (text.includes("mutual") || text.includes("equity") || text.includes("stock") || text.includes("pms") || text.includes("aif")) return "Equity";
  return ASSET_CLASS_OPTIONS.includes(value) ? value : "Other";
}

export function createReportFromInvestor(investor, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  const goals = (investor?.bucketList?.length ? investor.bucketList : investor?.goals || []).map((goal, index) => ({
    goalId: goal.id || `goal-${index + 1}`,
    name: goal.name || "",
    category: goal.category || "",
    type: goal.type || "Flexible",
    targetAmount: Number(goal.targetAmount || 0),
    currentAmount: Number(goal.currentAmount || 0),
    monthlySip: Number(goal.monthlyContribution || 0),
    targetYear: goal.targetYear || null,
    status: goal.status || "Planning",
    progress: calculatePercentage(goal.currentAmount, goal.targetAmount),
    isPrimary: Boolean(goal.isPrimary)
  }));

  const funds = (investor?.existingInvestments || []).map((investment, index) => ({
    id: investment.id || `fund-${index + 1}`,
    instrumentName: investment.institution || investment.type || "",
    assetClass: inferAssetClass(investment.type),
    goalId: "",
    goalName: "",
    monthlySip: Number(investment.monthlyContribution || 0),
    currentValue: Number(investment.currentValue || 0),
    type: "Fixed",
    notes: investment.notes || ""
  }));

  const totalCorpus = funds.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const lifetimeTarget = goals.reduce((sum, item) => sum + Number(item.targetAmount || 0), 0);
  const monthlySip = funds.reduce((sum, item) => sum + Number(item.monthlySip || 0), 0);
  const grouped = funds.reduce((map, item) => {
    const current = map.get(item.assetClass) || { currentValue: 0, monthlySip: 0 };
    current.currentValue += Number(item.currentValue || 0);
    current.monthlySip += Number(item.monthlySip || 0);
    map.set(item.assetClass, current);
    return map;
  }, new Map());
  const holdings = [...grouped.entries()].map(([assetClass, values], index) => ({
    id: `holding-${index + 1}`,
    assetClass,
    currentValue: values.currentValue,
    percentage: calculatePercentage(values.currentValue, totalCorpus),
    color: ASSET_CLASS_COLORS[assetClass] || ASSET_CLASS_COLORS.Other
  }));
  const allocation = [...grouped.entries()].map(([assetClass, values], index) => ({
    id: `allocation-${index + 1}`,
    assetClass,
    currentValue: values.currentValue,
    monthlySip: values.monthlySip,
    currentPercentage: calculatePercentage(values.currentValue, totalCorpus),
    targetPercentage: 0,
    variance: calculatePercentage(values.currentValue, totalCorpus)
  }));

  return {
    investorId: investor?.id || "",
    investorName: investor?.fullName || "",
    clientCode: investor?.clientCode || "",
    investorEmail: investor?.email || "",
    investorContactNo: investor?.contactNo || "",
    investorPortalUid: investor?.portalUid || null,
    advisorUid: investor?.assignedAdvisorUid || investor?.advisorUid || "",
    assignedAdvisorUid: investor?.assignedAdvisorUid || investor?.advisorUid || "",
    advisorName: investor?.assignedAdvisorName || investor?.advisorName || "",
    advisorEmail: investor?.assignedAdvisorEmail || investor?.advisorEmail || "",
    advisorPhone: investor?.assignedAdvisorPhone || investor?.advisorPhone || "",
    advisorDesignation: investor?.assignedAdvisorDesignation || "Relationship Manager",
    journeyDurationMonths: Number(investor?.journeyDurationMonths || 0),
    reportMonth: Number(month),
    reportYear: Number(year),
    reportMonthKey: getReportMonthKey(year, month),
    statementDate: "",
    title: `Monthly Portfolio Report — ${getMonthLabel(month)} ${year}`,
    status: REPORT_STATUS.DRAFT,
    investorVisible: false,
    summary: {
      totalCorpus,
      lifetimeTarget,
      overallProgress: calculatePercentage(totalCorpus, lifetimeTarget),
      monthlySip,
      newMoneyAdded: 0,
      investmentGain: 0
    },
    holdings,
    advisorNote: { content: "", highlight: "" },
    advisorInsights: {
      narrative: "",
      progressHighlight: { title: "", description: "" },
      priorityAttention: { title: "", description: "" },
      portfolioOpportunity: { title: "", description: "" }
    },
    monthlyHighlights: [],
    portfolioHealth: {
      observation: "",
      growthAssetClasses: ["Equity", "Trading", "Real Estate"],
      stableAssetClasses: ["Debt", "Liquid", "Cash", "Insurance", "Gold"]
    },
    goals,
    allocation,
    funds,
    nextSteps: [],
    nextReview: { date: "", note: "", mode: "" },
    disclaimer: DEFAULT_REPORT_DISCLAIMER
  };
}
