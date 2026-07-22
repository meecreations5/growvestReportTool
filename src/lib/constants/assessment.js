export const ASSESSMENT_STATUS = {
  DRAFT: "draft",
  COMPLETED: "completed"
};

export const OCCUPATIONS = [
  "Salaried",
  "Business Owner",
  "Professional",
  "Self-employed",
  "Retired",
  "Homemaker",
  "Student",
  "Other"
];

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Other"];

export const GOAL_OPTIONS = [
  "Emergency Fund",
  "Children's Education",
  "Children's Marriage",
  "Home Purchase",
  "Retirement",
  "Travel",
  "Vehicle",
  "Business Goal",
  "Wealth Creation",
  "Tax Planning",
  "Insurance",
  "Estate Planning",
  "Other"
];

export const GOAL_PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const GOAL_TYPES = ["Fixed", "Flexible"];
export const GOAL_STATUSES = [
  "Not Started",
  "Planning",
  "SIP Running",
  "On Track",
  "Review Needed",
  "Paused",
  "Completed"
];

export const INVESTMENT_TYPES = ["SIP", "Lump Sum", "Both", "Undecided"];
export const INVESTMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half-Yearly", "Annually", "One-time"];

export const PRODUCTS_OF_INTEREST = [
  "Mutual Funds",
  "Fixed Deposits",
  "Stocks",
  "Insurance",
  "PMS",
  "AIF",
  "Retirement Planning",
  "Tax Planning",
  "Estate Planning",
  "Financial Planning",
  "Custom / Other"
];

export const EXISTING_INVESTMENT_TYPES = [
  "Mutual Fund",
  "Fixed Deposit",
  "PPF",
  "EPF",
  "NPS",
  "Stocks",
  "Bonds",
  "Insurance",
  "PMS",
  "AIF",
  "Gold",
  "Real Estate",
  "Other"
];

export const LIABILITY_TYPES = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Business Loan",
  "Education Loan",
  "Credit Card",
  "Other"
];

export const RISK_QUESTIONS = [
  {
    key: "marketFallResponse",
    question: "If your investment dropped 20%, what would you do?",
    helper: "Market fall response",
    options: [
      { value: 1, label: "Sell all investments" },
      { value: 2, label: "Sell some investments" },
      { value: 3, label: "Hold and wait" },
      { value: 4, label: "Continue the current investment" },
      { value: 5, label: "Buy more" }
    ]
  },
  {
    key: "investmentHorizon",
    question: "How long can you keep the money invested?",
    helper: "Investment horizon",
    options: [
      { value: 1, label: "Less than 1 year" },
      { value: 2, label: "1-3 years" },
      { value: 3, label: "3-5 years" },
      { value: 4, label: "5-10 years" },
      { value: 5, label: "More than 10 years" }
    ]
  },
  {
    key: "expectedReturn",
    question: "What annual return do you expect?",
    helper: "Expected annual return",
    options: [
      { value: 1, label: "Less than 8%" },
      { value: 2, label: "8-10%" },
      { value: 3, label: "10-15%" },
      { value: 4, label: "15-20%" },
      { value: 5, label: "More than 20%" }
    ]
  },
  {
    key: "investableSavings",
    question: "How much of your savings can you invest?",
    helper: "Investable share of savings",
    options: [
      { value: 1, label: "Less than 10%" },
      { value: 2, label: "10-30%" },
      { value: 3, label: "30-50%" },
      { value: 4, label: "50-70%" },
      { value: 5, label: "More than 70%" }
    ]
  }
];

export const RISK_PROFILES = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"];

export function createEmptyGoal({ primary = false } = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random()}`,
    name: "",
    targetAmount: "",
    currentAmount: "",
    timeline: "",
    targetYear: "",
    monthlyContribution: "",
    priority: primary ? "High" : "Medium",
    type: primary ? "Fixed" : "Flexible",
    status: "Planning",
    notes: "",
    isPrimary: primary
  };
}

export function createEmptyInvestment() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `investment-${Date.now()}-${Math.random()}`,
    type: "",
    institution: "",
    currentValue: "",
    monthlyContribution: "",
    startDate: "",
    maturityDate: "",
    notes: ""
  };
}

export function createEmptyLiability() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `liability-${Date.now()}-${Math.random()}`,
    type: "",
    lender: "",
    outstandingAmount: "",
    emiAmount: "",
    interestRate: "",
    remainingTenure: "",
    notes: ""
  };
}

export function createEmptyInvestmentPreference() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `preference-${Date.now()}-${Math.random()}`,
    investmentType: "",
    preferredFrequency: "Monthly",
    sipAmount: "",
    lumpSumAmount: "",
    productsOfInterest: []
  };
}

export function getInvestmentPreferenceRows(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value]
      : [];

  return source.map((item, index) => ({
    ...createEmptyInvestmentPreference(),
    ...item,
    id: item?.id || `preference-${index + 1}`,
    investmentType: item?.investmentType || "",
    preferredFrequency: item?.preferredFrequency || "Monthly",
    sipAmount: item?.sipAmount ?? "",
    lumpSumAmount: item?.lumpSumAmount ?? "",
    productsOfInterest: Array.isArray(item?.productsOfInterest) ? item.productsOfInterest : []
  }));
}

export function calculateInvestmentPreferenceTotals(value) {
  const rows = getInvestmentPreferenceRows(value).filter((item) =>
    item.investmentType
    || Number(item.sipAmount || 0) > 0
    || Number(item.lumpSumAmount || 0) > 0
    || item.productsOfInterest.length > 0
  );

  return rows.reduce(
    (totals, item) => ({
      sipAmount: totals.sipAmount + Number(item.sipAmount || 0),
      lumpSumAmount: totals.lumpSumAmount + Number(item.lumpSumAmount || 0),
      count: totals.count + 1
    }),
    { sipAmount: 0, lumpSumAmount: 0, count: 0 }
  );
}

export function calculateRiskScore(riskAnswers = {}) {
  return RISK_QUESTIONS.reduce(
    (total, question) => total + Number(riskAnswers?.[question.key] || 0),
    0
  );
}

export function calculateRiskProfile(score) {
  const numericScore = Number(score || 0);
  if (!numericScore) return "";
  if (numericScore <= 8) return "CONSERVATIVE";
  if (numericScore <= 14) return "MODERATE";
  return "AGGRESSIVE";
}

export function getRecommendedProfile(profile) {
  if (profile === "CONSERVATIVE") return "Low-risk: fixed deposits, debt mutual funds and liquid funds";
  if (profile === "MODERATE") return "Balanced: hybrid mutual funds, index funds and measured equity exposure";
  if (profile === "AGGRESSIVE") return "Growth-oriented: equity mutual funds, stocks and suitable alternatives";
  return "Complete the risk assessment to generate a recommendation.";
}

export function calculateQualificationScore(qualification = {}) {
  return [
    qualification?.goalDefined,
    qualification?.monthlySurplusConfirmed,
    qualification?.timelineSuitable,
    qualification?.liabilitiesManageable
  ].reduce((total, value) => total + Number(value || 0), 0);
}

export function getQualificationStatus(score) {
  const numericScore = Number(score || 0);
  if (numericScore >= 4) return "Qualified";
  if (numericScore >= 2) return "Follow-up Required";
  return "Not Ready";
}

export function getPrimaryGoal(bucketList = []) {
  return bucketList.find((goal) => goal.isPrimary) || bucketList[0] || null;
}

export function calculateTotalGoalTarget(bucketList = []) {
  return bucketList.reduce((total, goal) => total + Number(goal.targetAmount || 0), 0);
}
