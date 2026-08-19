import {
  DEFAULT_REPORT_TEMPLATE_ID,
  createReportTemplateSnapshot,
  getSystemReportTemplate
} from "@/lib/constants/reportTemplates";

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

export const ACTION_STATUS_OPTIONS = ["Requested", "Recommended", "Under Review", "Discussion Required", "Approved", "In Progress", "Completed", "Deferred", "Rejected", "Pending", "Cancelled"];
export const INVESTOR_DECISION_OPTIONS = ["Pending Discussion", "Approved", "Rejected", "Deferred", "Not Required"];
export const RECOMMENDATION_TYPE_OPTIONS = ["Portfolio Review", "SIP", "Lump Sum", "Top-up", "Rebalance", "Switch", "Redemption", "Stock Delivery", "Goal Allocation", "Loan Repayment", "Loan Prepayment", "Emergency Fund", "Insurance", "Surplus Allocation", "Trading Profit Allocation", "Tax Planning", "Discuss Investment", "Increase SIP", "Start Lump Sum Investment", "Redemption Discussion", "Switch Fund Discussion", "Goal / Bucket List Change", "Loan Prepayment Discussion", "Insurance Review", "Portfolio Rebalancing", "Document Required", "Schedule Review Meeting", "Monthly Report Discussion", "Other / Custom", "Other"];
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


export const PORTFOLIO_REPORT_FRESH_DAYS = 7;
export const PORTFOLIO_REPORT_BLOCK_DAYS = 31;

function dateAgeDays(referenceDate, value) {
  if (!referenceDate || !value) return null;
  const reference = Date.parse(`${String(referenceDate).slice(0, 10)}T00:00:00Z`);
  const source = Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(reference) || Number.isNaN(source)) return null;
  return Math.max(0, Math.floor((reference - source) / 86400000));
}

function verificationCheck(id, label, status, detail) {
  return { id, label, status, detail };
}

export function buildPortfolioReportVerification(portfolioSource, asOfDate) {
  const snapshot = portfolioSource?.snapshot || null;
  const positions = Array.isArray(portfolioSource?.positions) ? portfolioSource.positions : [];
  const openingSnapshot = portfolioSource?.openingSnapshot || null;
  const openingPositions = Array.isArray(portfolioSource?.openingPositions) ? portfolioSource.openingPositions : [];
  const transactions = Array.isArray(portfolioSource?.transactions) ? portfolioSource.transactions : [];
  const referenceDate = asOfDate || portfolioSource?.asOfDate || snapshot?.snapshotDate || "";

  if (!snapshot) {
    return {
      required: true,
      status: "blocked",
      asOfDate: referenceDate,
      snapshotId: "",
      snapshotDate: "",
      openingSnapshotId: "",
      openingSnapshotDate: "",
      checks: [verificationCheck("verified_snapshot", "Verified portfolio snapshot", "block", "No verified Portfolio Master snapshot exists on or before the report date.")],
      sourceFreshness: [],
      counts: { holdings: 0, transactions: 0, newHoldings: 0, exitedHoldings: 0, assignedHoldings: 0, generalWealthHoldings: 0 },
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedByUid: "",
      acknowledgedByName: ""
    };
  }

  const checks = [];
  const snapshotAgeDays = dateAgeDays(referenceDate, snapshot.snapshotDate);
  let snapshotStatus = "pass";
  if (snapshotAgeDays === null) snapshotStatus = "warn";
  else if (snapshotAgeDays > PORTFOLIO_REPORT_BLOCK_DAYS) snapshotStatus = "block";
  else if (snapshotAgeDays > PORTFOLIO_REPORT_FRESH_DAYS) snapshotStatus = "warn";
  checks.push(verificationCheck(
    "verified_snapshot",
    "Verified portfolio snapshot",
    snapshotStatus,
    snapshotAgeDays === null
      ? `Snapshot ${snapshot.snapshotDate || "date unavailable"} is verified; freshness could not be calculated.`
      : `Verified snapshot dated ${snapshot.snapshotDate}${snapshotAgeDays ? ` (${snapshotAgeDays} day${snapshotAgeDays === 1 ? "" : "s"} before report date)` : " (report-date snapshot)"}.`
  ));

  const sourceFreshness = (snapshot.sourceFreshness || []).map((item) => {
    const valuationDate = item.valuationDate || "";
    const ageDays = dateAgeDays(referenceDate, valuationDate);
    const status = ageDays === null
      ? "warn"
      : ageDays > PORTFOLIO_REPORT_BLOCK_DAYS
        ? "block"
        : ageDays > PORTFOLIO_REPORT_FRESH_DAYS
          ? "warn"
          : "pass";
    return { ...item, valuationDate, ageDays, status };
  });
  const sourceHasBlock = sourceFreshness.some((item) => item.status === "block");
  const sourceHasWarning = sourceFreshness.some((item) => item.status === "warn");
  checks.push(verificationCheck(
    "source_freshness",
    "Portfolio source freshness",
    sourceHasBlock ? "block" : sourceHasWarning || !sourceFreshness.length ? "warn" : "pass",
    sourceFreshness.length
      ? `${sourceFreshness.length} portfolio source${sourceFreshness.length === 1 ? "" : "s"} checked against the report date.`
      : "No source freshness metadata is available for this snapshot."
  ));

  const reconciliation = snapshot.intelligence || null;
  if (reconciliation) {
    const reconciliationStatus = String(reconciliation.status || snapshot.reconciliationStatus || "verified");
    const reconciliationCheckStatus = ["mismatch", "ownership_conflict"].includes(reconciliationStatus)
      ? "block"
      : ["needs_review", "stale", "missing_source"].includes(reconciliationStatus)
        ? "warn"
        : "pass";
    const actionableIssues = (reconciliation.issues || []).filter((item) => item.severity !== "info");
    checks.push(verificationCheck(
      "portfolio_reconciliation",
      "Portfolio reconciliation",
      reconciliationCheckStatus,
      reconciliationCheckStatus === "pass"
        ? "Latest verified snapshot reconciles without operational exceptions."
        : `${actionableIssues.length} reconciliation issue${actionableIssues.length === 1 ? "" : "s"} detected. Review Portfolio Intelligence before completing the monthly report.`
    ));
  }

  checks.push(verificationCheck(
    "opening_snapshot",
    "Opening portfolio snapshot",
    openingSnapshot ? "pass" : "warn",
    openingSnapshot
      ? `Opening reference ${openingSnapshot.snapshotDate} is available for monthly movement calculations.`
      : "No earlier verified snapshot is available. Fresh money can still be shown, but investment gain is not inferred from an unknown opening corpus."
  ));

  const positionIdentity = (item) => String(item.positionId || item.id || "");
  const closingIds = new Set(positions.map(positionIdentity).filter(Boolean));
  const openingIds = new Set(openingPositions.map(positionIdentity).filter(Boolean));
  const newHoldings = openingSnapshot ? positions.filter((item) => !openingIds.has(positionIdentity(item))) : [];
  const exitedHoldings = openingSnapshot ? openingPositions.filter((item) => !closingIds.has(positionIdentity(item))) : [];
  checks.push(verificationCheck(
    "holding_changes",
    "New / exited holdings review",
    newHoldings.length || exitedHoldings.length ? "warn" : "pass",
    openingSnapshot
      ? `${newHoldings.length} new and ${exitedHoldings.length} exited holding${newHoldings.length + exitedHoldings.length === 1 ? "" : "s"} detected for the period.`
      : "Holding-change comparison will become available after an opening snapshot exists."
  ));

  let assignedHoldings = 0;
  let generalWealthHoldings = 0;
  let invalidGoalAllocationCount = 0;
  positions.forEach((position) => {
    const allocations = Array.isArray(position.goalAllocations) ? position.goalAllocations : [];
    const assignedPercentage = allocations.reduce((sum, item) => sum + Math.max(0, Number(item?.percentage || 0)), 0);
    if (assignedPercentage > 100.01) invalidGoalAllocationCount += 1;
    if (assignedPercentage > 0) assignedHoldings += 1;
    else generalWealthHoldings += 1;
  });
  checks.push(verificationCheck(
    "goal_mapping",
    "Goal / General Wealth allocation",
    invalidGoalAllocationCount ? "block" : "pass",
    invalidGoalAllocationCount
      ? `${invalidGoalAllocationCount} holding${invalidGoalAllocationCount === 1 ? " has" : "s have"} goal allocation above 100%.`
      : `${assignedHoldings} holding${assignedHoldings === 1 ? " is" : "s are"} goal-linked; ${generalWealthHoldings} remain in General Wealth / Unassigned.`
  ));

  checks.push(verificationCheck(
    "cash_flows",
    "Monthly investment transactions",
    "pass",
    `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} found between the month start and report date. Fresh investment and withdrawals are kept separate from investment movement.`
  ));

  const hasBlock = checks.some((item) => item.status === "block");
  const hasWarning = checks.some((item) => item.status === "warn");
  const status = hasBlock ? "blocked" : hasWarning ? "review_required" : "ready";

  return {
    required: true,
    status,
    asOfDate: referenceDate,
    snapshotId: snapshot.id || "",
    snapshotDate: snapshot.snapshotDate || "",
    snapshotAgeDays,
    openingSnapshotId: openingSnapshot?.id || "",
    openingSnapshotDate: openingSnapshot?.snapshotDate || "",
    checks,
    sourceFreshness,
    counts: {
      holdings: positions.length,
      transactions: transactions.length,
      newHoldings: newHoldings.length,
      exitedHoldings: exitedHoldings.length,
      assignedHoldings,
      generalWealthHoldings
    },
    acknowledged: status === "ready",
    acknowledgedAt: status === "ready" ? new Date().toISOString() : null,
    acknowledgedByUid: "",
    acknowledgedByName: ""
  };
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
    recommendationType: "Portfolio Review",
    investorDecision: "Pending Discussion",
    relatedGoalId: "",
    relatedInvestmentId: "",
    sourceActionId: "",
    sourceReportId: "",
    sourceReportMonthKey: "",
    owner: "Advisor",
    priority: "Planned",
    dueDate: "",
    completionDate: "",
    status: "Recommended"
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

  // Portfolio values and holdings are intentionally not seeded from legacy
  // investor profile investments. Monthly reports must use a verified
  // Portfolio Master snapshot (or an explicit import flow) as their current
  // portfolio source so a Full Portfolio Reset cannot be revived by stale
  // profile/report data.
  const funds = [];

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
    portfolioVerification: {
      required: true,
      status: "pending",
      asOfDate: "",
      snapshotId: "",
      snapshotDate: "",
      openingSnapshotId: "",
      openingSnapshotDate: "",
      checks: [],
      sourceFreshness: [],
      counts: { holdings: 0, transactions: 0, newHoldings: 0, exitedHoldings: 0, assignedHoldings: 0, generalWealthHoldings: 0 },
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedByUid: "",
      acknowledgedByName: ""
    },
    templateId: DEFAULT_REPORT_TEMPLATE_ID,
    templateVersion: Number(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)?.version || 1),
    templateSnapshot: createReportTemplateSnapshot(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)),
    summary: {
      totalCorpus,
      lifetimeTarget,
      overallProgress: calculatePercentage(totalCorpus, lifetimeTarget),
      monthlySip,
      newMoneyAdded: 0,
      investmentGain: 0
    },
    holdings,
    financialPlan: {
      monthlySurplus: Number(investor?.personalProfile?.monthlySurplus || 0),
      surplusMode: investor?.personalProfile?.monthlySurplusMode || "fixed",
      surplusPercentage: Number(investor?.personalProfile?.monthlySurplusPercentage || 0),
      surplusAllocations: (investor?.surplusAllocations || []).map((item, index) => ({
        id: item.id || `surplus-${index + 1}`,
        category: item.category || "",
        mode: item.mode || "fixed",
        fixedAmount: Number(item.fixedAmount || 0),
        percentage: Number(item.percentage || 0),
        calculatedAmount: Number(item.calculatedAmount || (item.mode === "percentage" ? Number(investor?.personalProfile?.monthlySurplus || 0) * Number(item.percentage || 0) / 100 : item.fixedAmount || 0)),
        notes: item.notes || ""
      })),
      loans: (investor?.liabilities || []).map((item, index) => ({
        id: item.id || `loan-${index + 1}`,
        type: item.type || "Other",
        lender: item.lender || "",
        originalLoanAmount: Number(item.originalLoanAmount || 0),
        outstandingAmount: Number(item.outstandingAmount || 0),
        emiAmount: Number(item.emiAmount || 0),
        interestRate: Number(item.interestRate || 0),
        remainingTenure: item.remainingTenure || "",
        extraRepayment: Number(item.extraRepayment || 0),
        targetClosureDate: item.targetClosureDate || "",
        notes: item.notes || ""
      }))
    },
    advisorNote: { content: "", highlight: "" },
    advisorInsights: {
      narrative: "",
      progressHighlight: { title: "", description: "" },
      priorityAttention: { title: "", description: "" },
      portfolioOpportunity: { title: "", description: "" }
    },
    commentarySources: [],
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
export function createReportFromPortfolioSource(investor, portfolioSource, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  const base = createReportFromInvestor(investor, month, year);
  const snapshot = portfolioSource?.snapshot || null;
  const positions = Array.isArray(portfolioSource?.positions) ? portfolioSource.positions : [];
  const reportAsOfDate = portfolioSource?.asOfDate || `${year}-${String(month).padStart(2, "0")}-${String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, "0")}`;
  if (!snapshot) {
    return {
      ...base,
      portfolioVerification: buildPortfolioReportVerification(portfolioSource || { asOfDate: reportAsOfDate }, reportAsOfDate),
      reportGenerationSource: "portfolio_master"
    };
  }

  const totalCorpus = Number(snapshot.summary?.currentValue || positions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0));
  const totalInvested = Number(snapshot.summary?.totalInvested || positions.reduce((sum, item) => sum + Number(item.totalInvested ?? item.investedAmount ?? 0), 0));
  const portfolioGainLoss = Number(snapshot.summary?.gainLoss ?? (totalCorpus - totalInvested));
  const monthlySip = Number(snapshot.summary?.monthlySip || positions.reduce((sum, item) => sum + Number(item.monthlySip || 0), 0));
  const portfolioTransactions = Array.isArray(portfolioSource?.transactions) ? portfolioSource.transactions : [];
  const portfolioVerification = buildPortfolioReportVerification(portfolioSource, reportAsOfDate);
  const hasOpeningSnapshot = Boolean(portfolioSource?.openingSnapshot);
  const openingSnapshotValue = Number(portfolioSource?.openingSnapshot?.summary?.currentValue || 0);
  const flowSummary = portfolioTransactions.reduce((total, item) => {
    const type = String(item.transactionType || item.type || "").toLowerCase();
    const amount = Math.abs(Number(item.amount || 0));
    const cashFlowType = String(item.cashFlowType || "").toLowerCase();
    if (cashFlowType === "withdrawal" || (!cashFlowType && /redemption|withdraw/.test(type))) total.withdrawals += amount;
    else if (cashFlowType === "new_money" || (!cashFlowType && amount > 0 && !/switch\s*in|switch\s*out|sell|redemption|withdraw/.test(type))) total.newMoney += amount;
    return total;
  }, { newMoney: 0, withdrawals: 0 });
  // If there is no prior verified snapshot, market movement cannot be separated
  // reliably from the opening corpus. Infer an opening baseline from known cash
  // flows and leave investment gain at zero rather than overstating performance.
  const openingValue = hasOpeningSnapshot
    ? openingSnapshotValue
    : Math.max(0, totalCorpus - flowSummary.newMoney + flowSummary.withdrawals);
  const investmentGain = hasOpeningSnapshot
    ? totalCorpus - openingValue - flowSummary.newMoney + flowSummary.withdrawals
    : 0;
  const goalTotals = new Map((snapshot.goalTotals || []).map((item) => [String(item.goalId || ""), item]));

  const goals = (base.goals || []).map((goal) => {
    const live = goalTotals.get(String(goal.goalId || ""));
    const currentAmount = Number(live?.currentValue ?? goal.currentAmount ?? 0);
    const monthlyContribution = Number(live?.monthlyContribution ?? goal.monthlySip ?? 0);
    return {
      ...goal,
      currentAmount,
      monthlySip: monthlyContribution,
      progress: calculatePercentage(currentAmount, goal.targetAmount)
    };
  });

  const grouped = positions.reduce((map, position) => {
    const assetClass = position.assetClass || "Other";
    const current = map.get(assetClass) || { currentValue: 0, monthlySip: 0 };
    current.currentValue += Number(position.currentValue || 0);
    current.monthlySip += Number(position.monthlySip || 0);
    map.set(assetClass, current);
    return map;
  }, new Map());

  const holdings = [...grouped.entries()].map(([assetClass, values], index) => ({
    id: `holding-${index + 1}`,
    assetClass,
    currentValue: Number(values.currentValue.toFixed(2)),
    percentage: calculatePercentage(values.currentValue, totalCorpus),
    color: ASSET_CLASS_COLORS[assetClass] || ASSET_CLASS_COLORS.Other
  }));

  const allocation = [...grouped.entries()].map(([assetClass, values], index) => {
    const currentPercentage = calculatePercentage(values.currentValue, totalCorpus);
    return {
      id: `allocation-${index + 1}`,
      assetClass,
      currentValue: Number(values.currentValue.toFixed(2)),
      monthlySip: Number(values.monthlySip.toFixed(2)),
      currentPercentage,
      targetPercentage: 0,
      variance: currentPercentage
    };
  });

  const funds = positions.map((position, index) => {
    const goal = Array.isArray(position.goalAllocations) ? position.goalAllocations.find((item) => item?.goalId) : null;
    const productType = position.productType || "other";
    const investmentTypeLabel = productType === "mutual_fund"
      ? "Mutual Fund"
      : productType === "stock_delivery"
        ? "Direct Equity"
        : productType === "ulip"
          ? "ULIP"
          : productType === "pms"
            ? "PMS"
            : productType === "bond"
              ? "Bond"
              : productType === "fixed_deposit"
                ? "Fixed Deposit"
                : productType === "gold"
                  ? "Gold"
                  : productType === "real_estate"
                    ? "Real Estate"
                    : "Other";
    const investmentType = position.investmentMode
      || (productType === "stock_delivery" ? "Delivery" : productType === "ulip" ? "ULIP" : "Flexible");
    return {
      id: position.positionId || position.id || `portfolio-position-${index + 1}`,
      positionId: position.positionId || position.id || "",
      instrumentName: position.instrumentName || position.schemeName || position.stockName || position.fundName || "Investment",
      assetClass: position.assetClass || "Other",
      goalId: goal?.goalId || "",
      goalName: goal?.goalName || "",
      monthlySip: Number(position.monthlySip || 0),
      currentValue: Number(position.currentValue || 0),
      type: investmentType,
      investmentType: investmentTypeLabel,
      productType,
      source: position.source || "",
      provider: position.provider || "",
      investmentMode: position.investmentMode || "",
      totalInvested: Number(position.totalInvested ?? position.investedAmount ?? 0),
      units: Number(position.totalUnits || 0),
      currentNav: Number(position.currentNav || 0),
      navDate: position.navDate || "",
      quantity: Number(position.quantity || 0),
      averageBuyRate: Number(position.averageBuyRate || 0),
      currentRate: Number(position.currentRate || 0),
      valuationDate: position.valuationDate || position.navDate || "",
      returnPercentage: Number(position.returnPercentage || 0),
      profitLoss: Number(position.gainLoss || 0),
      isin: position.isin || "",
      folioNo: position.folioNo || "",
      symbol: position.symbol || "",
      policyNumber: position.policyNumber || "",
      planName: position.planName || "",
      fundName: position.fundName || "",
      fundCode: position.fundCode || "",
      insurer: position.insurer || "",
      premiumAmount: Number(position.premiumAmount || 0),
      premiumFrequency: position.premiumFrequency || "",
      policyTotalPremiumPaid: Number(position.policyTotalPremiumPaid || 0),
      policyStartDate: position.policyStartDate || "",
      maturityDate: position.maturityDate || "",
      sumAssured: Number(position.sumAssured || 0),
      policyStatus: position.policyStatus || "",
      gainLossAvailable: position.gainLossAvailable !== false,
      notes: position.notes || ""
    };
  });

  const lifetimeTarget = goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
  const goalCurrentCorpus = goals.reduce((sum, goal) => sum + Number(goal.currentAmount || 0), 0);
  const allocatedCorpus = Array.isArray(snapshot.goalTotals) && snapshot.goalTotals.length
    ? snapshot.goalTotals.reduce((sum, goal) => sum + Number(goal.currentValue || 0), 0)
    : positions.reduce((sum, position) => {
        const allocated = (position.goalAllocations || []).reduce((value, item) => value + Number(item.percentage || 0), 0);
        return sum + Number(position.currentValue || 0) * Math.min(100, allocated) / 100;
      }, 0);

  return {
    ...base,
    statementDate: snapshot.snapshotDate || base.statementDate,
    portfolioAsOfDate: snapshot.snapshotDate || "",
    sourcePortfolioSnapshotId: snapshot.id || "",
    portfolioVerificationStatus: snapshot.verificationStatus || "verified",
    portfolioSourceFreshness: snapshot.sourceFreshness || [],
    portfolioVerification,
    reportGenerationSource: "portfolio_master",
    tradingSummary: portfolioSource?.tradingSummary ? {
      monthKey: portfolioSource.tradingSummary.monthKey || `${year}-${String(month).padStart(2, "0")}`,
      totalTrades: Number(portfolioSource.tradingSummary.totalTrades || 0),
      winningTrades: Number(portfolioSource.tradingSummary.winningTrades || 0),
      losingTrades: Number(portfolioSource.tradingSummary.losingTrades || 0),
      turnover: Number(portfolioSource.tradingSummary.turnover || 0),
      grossPnl: Number(portfolioSource.tradingSummary.grossPnl || 0),
      totalCharges: Number(portfolioSource.tradingSummary.totalCharges || 0),
      netPnl: Number(portfolioSource.tradingSummary.netPnl || 0),
      tradingCapital: Number(portfolioSource.tradingSummary.tradingCapital || 0)
    } : null,
    summary: {
      ...base.summary,
      totalCorpus: Number(totalCorpus.toFixed(2)),
      totalInvested: Number(totalInvested.toFixed(2)),
      portfolioGainLoss: Number(portfolioGainLoss.toFixed(2)),
      generalWealthCorpus: Number(Math.max(0, totalCorpus - allocatedCorpus).toFixed(2)),
      lifetimeTarget,
      overallProgress: lifetimeTarget > 0 ? calculatePercentage(goalCurrentCorpus, lifetimeTarget) : 0,
      monthlySip: Number(monthlySip.toFixed(2)),
      openingValue: Number(openingValue.toFixed(2)),
      newMoneyAdded: Number(flowSummary.newMoney.toFixed(2)),
      totalWithdrawals: Number(flowSummary.withdrawals.toFixed(2)),
      investmentGain: Number(investmentGain.toFixed(2))
    },
    transactions: portfolioTransactions.map((item, index) => ({
      id: item.id || `portfolio-transaction-${index + 1}`,
      date: item.transactionDate || "",
      transactionDate: item.transactionDate || "",
      type: item.transactionType || item.investmentMode || "Investment",
      transactionType: item.transactionType || item.investmentMode || "Investment",
      instrumentName: item.instrumentName || item.schemeName || "Investment",
      amount: Number(item.amount || 0),
      notes: item.provider ? `${item.provider}${item.folioNo ? ` · Folio ${item.folioNo}` : ""}` : ""
    })),
    holdings,
    goals,
    allocation,
    funds
  };
}

