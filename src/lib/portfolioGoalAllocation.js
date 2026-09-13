export const GENERAL_WEALTH_BUCKET_ID = "general_wealth";
export const GENERAL_WEALTH_BUCKET_NAME = "General Wealth";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedPercentage(value) {
  return Math.max(0, Math.min(100, number(value)));
}

export function normaliseGoalName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGeneralWealthName(value = "") {
  const normalized = normaliseGoalName(value);
  return normalized === "general wealth"
    || normalized === "general wealth corpus"
    || normalized === "general wealth corpus creation"
    || normalized === "corpus creation"
    || normalized === "unassigned"
    || normalized === "default";
}

export function isGeneralWealthAllocation(allocation = {}) {
  return allocation?.isDefault === true
    || allocation?.allocationType === "default"
    || String(allocation?.bucketId || "") === GENERAL_WEALTH_BUCKET_ID
    || (!allocation?.goalId && isGeneralWealthName(allocation?.goalName || allocation?.bucketName || ""));
}

export function generalWealthAllocation(percentage = 100) {
  return {
    goalId: "",
    bucketId: GENERAL_WEALTH_BUCKET_ID,
    goalName: GENERAL_WEALTH_BUCKET_NAME,
    bucketName: GENERAL_WEALTH_BUCKET_NAME,
    percentage: Number(boundedPercentage(percentage).toFixed(4)),
    allocationType: "default",
    isDefault: true
  };
}

export function normalisePortfolioGoalAllocations(allocations = []) {
  const source = Array.isArray(allocations) ? allocations : [];
  const specific = [];
  let used = 0;

  source.forEach((allocation) => {
    const goalId = String(allocation?.goalId || "").trim();
    if (!goalId) return;
    const requested = boundedPercentage(allocation?.percentage);
    if (requested <= 0 || used >= 100) return;
    const percentage = Math.min(requested, 100 - used);
    specific.push({
      ...allocation,
      goalId,
      goalName: String(allocation?.goalName || "Goal").trim() || "Goal",
      percentage: Number(percentage.toFixed(4)),
      allocationType: "goal",
      isDefault: false
    });
    used += percentage;
  });

  const remainder = Math.max(0, 100 - used);
  if (remainder > 0.0001) specific.push(generalWealthAllocation(remainder));
  if (!specific.length) return [generalWealthAllocation(100)];
  return specific;
}

export function specificGoalAllocations(allocations = []) {
  return normalisePortfolioGoalAllocations(allocations).filter((item) => Boolean(item.goalId));
}

export function defaultWealthPercentage(allocations = []) {
  return normalisePortfolioGoalAllocations(allocations)
    .filter(isGeneralWealthAllocation)
    .reduce((sum, item) => sum + boundedPercentage(item.percentage), 0);
}

export function portfolioAllocationStatus(allocations = []) {
  const normalized = normalisePortfolioGoalAllocations(allocations);
  const specificTotal = normalized
    .filter((item) => item.goalId)
    .reduce((sum, item) => sum + boundedPercentage(item.percentage), 0);
  if (specificTotal <= 0) return "general_wealth";
  if (specificTotal >= 99.9999) return "allocated";
  return "mixed";
}

export function primaryPortfolioBucket(allocations = []) {
  const normalized = normalisePortfolioGoalAllocations(allocations);
  return normalized.find((item) => item.goalId) || normalized.find(isGeneralWealthAllocation) || generalWealthAllocation();
}


export function portfolioBucketLabel(allocations = [], { includePercentages = true } = {}) {
  const normalized = normalisePortfolioGoalAllocations(allocations);
  if (normalized.length === 1) {
    const only = normalized[0];
    if (isGeneralWealthAllocation(only)) return `${GENERAL_WEALTH_BUCKET_NAME} (Default)`;
    return only.goalName || "Bucket List";
  }
  return normalized.map((item) => {
    const name = isGeneralWealthAllocation(item)
      ? `${GENERAL_WEALTH_BUCKET_NAME} (Default)`
      : (item.goalName || "Bucket List");
    if (!includePercentages) return name;
    const percentage = Number(item.percentage || 0);
    return `${name} ${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
  }).join(" · ");
}


function goalIdentifier(goal = {}) {
  return String(goal.goalId || goal.id || "").trim();
}

function portfolioGoalStatus(currentAmount = 0, monthlyContribution = 0, targetAmount = 0) {
  const current = number(currentAmount);
  const monthly = number(monthlyContribution);
  const target = number(targetAmount);
  if (target > 0 && current >= target) return "Completed";
  if (monthly > 0) return "SIP Running";
  if (current > 0) return "Invested / No Active SIP";
  return "Not Started";
}

export function findPortfolioGoalMatch(goals = [], allocation = {}) {
  const goalRows = Array.isArray(goals) ? goals : [];
  const goalId = String(allocation?.goalId || allocation?.id || "").trim();
  const goalName = normaliseGoalName(allocation?.goalName || allocation?.bucketName || allocation?.name || "");

  if (goalId) {
    const exact = goalRows.find((goal) => goalIdentifier(goal) === goalId);
    if (exact) return exact;
  }

  if (goalName) {
    const exactName = goalRows.find((goal) => normaliseGoalName(goal.name || goal.goalName || "") === goalName);
    if (exactName) return exactName;
  }

  // Legacy/default General Wealth links must reconcile to the investor's
  // canonical General Wealth / Corpus Creation goal even when an old goal ID
  // is still present on the holding.
  if (isGeneralWealthAllocation(allocation)
    || isGeneralWealthName(allocation?.goalName || allocation?.bucketName || "")
    || isGeneralWealthName(goalId)) {
    return goalRows.find((goal) => isGeneralWealthName(goal.name || goal.goalName || "")) || null;
  }

  return null;
}

/**
 * Reconciles investor goal definitions with live Portfolio Master positions.
 * Goal definitions (name/target/timeline) stay on the investor profile, while
 * current corpus and active monthly SIP are always derived from investments.
 */
export function derivePortfolioGoalProgress(goals = [], positions = []) {
  const goalRows = (Array.isArray(goals) ? goals : []).map((goal, index) => ({
    ...goal,
    goalId: goalIdentifier(goal) || `goal-${index + 1}`,
    _sourceGoalId: goalIdentifier(goal),
    _normalizedName: normaliseGoalName(goal.name || goal.goalName || ""),
    currentAmount: 0,
    monthlyContribution: 0,
    monthlySip: 0,
    progress: 0
  }));

  const byId = new Map(goalRows.filter((goal) => goal._sourceGoalId).map((goal) => [goal._sourceGoalId, goal]));
  const byName = new Map();
  goalRows.forEach((goal) => {
    if (goal._normalizedName && !byName.has(goal._normalizedName)) byName.set(goal._normalizedName, goal);
  });
  const generalGoal = goalRows.find((goal) => isGeneralWealthName(goal.name || goal.goalName || "")) || null;

  let totalPortfolioValue = 0;
  let activeMonthlySip = 0;
  let assignedGoalCorpus = 0;
  let specificAssignedCorpus = 0;
  let generalWealthCorpus = 0;
  let generalWealthMonthlySip = 0;
  let nameMatchedGoalAllocations = 0;
  const invalidGoalAllocations = [];

  (Array.isArray(positions) ? positions : []).forEach((position) => {
    const positionValue = number(position.currentValue);
    const positionSip = number(position.monthlySip);
    totalPortfolioValue += positionValue;
    activeMonthlySip += positionSip;

    normalisePortfolioGoalAllocations(position.goalAllocations).forEach((allocation) => {
      const percentage = boundedPercentage(allocation.percentage);
      if (percentage <= 0) return;
      const allocatedValue = positionValue * percentage / 100;
      const allocatedSip = positionSip * percentage / 100;

      let matchedGoal = null;
      if (allocation.goalId) matchedGoal = byId.get(String(allocation.goalId).trim()) || null;
      if (!matchedGoal && allocation.goalName) {
        matchedGoal = byName.get(normaliseGoalName(allocation.goalName)) || null;
        if (matchedGoal) nameMatchedGoalAllocations += 1;
      }

      // A legacy General Wealth name/ID is an alias for the investor's
      // canonical General Wealth / Corpus Creation goal. Do this even when an
      // old goalId is present so launch portfolios do not show a false zero.
      if (!matchedGoal && generalGoal && (
        isGeneralWealthAllocation(allocation)
        || isGeneralWealthName(allocation.goalName || allocation.bucketName || "")
        || isGeneralWealthName(allocation.goalId || "")
      )) {
        matchedGoal = generalGoal;
        nameMatchedGoalAllocations += 1;
      }

      if (!allocation.goalId && !matchedGoal && generalGoal) matchedGoal = generalGoal;

      if (matchedGoal) {
        matchedGoal.currentAmount += allocatedValue;
        matchedGoal.monthlyContribution += allocatedSip;
        matchedGoal.monthlySip += allocatedSip;
        assignedGoalCorpus += allocatedValue;
        if (allocation.goalId) specificAssignedCorpus += allocatedValue;
        return;
      }

      if (allocation.goalId) {
        invalidGoalAllocations.push({
          positionId: position.positionId || position.id || "",
          instrumentName: position.instrumentName || position.schemeName || position.stockName || position.fundName || "Investment",
          goalId: allocation.goalId,
          goalName: allocation.goalName || "",
          percentage
        });
      } else {
        generalWealthCorpus += allocatedValue;
        generalWealthMonthlySip += allocatedSip;
      }
    });
  });

  const reconciledGoals = goalRows.map(({ _sourceGoalId, _normalizedName, ...goal }) => {
    const currentAmount = Number(number(goal.currentAmount).toFixed(2));
    const monthlyContribution = Number(number(goal.monthlyContribution).toFixed(2));
    const targetAmount = number(goal.targetAmount);
    const progress = targetAmount > 0 ? Number(Math.min(100, currentAmount / targetAmount * 100).toFixed(1)) : 0;
    return {
      ...goal,
      currentAmount,
      monthlyContribution,
      monthlySip: monthlyContribution,
      progress,
      status: portfolioGoalStatus(currentAmount, monthlyContribution, targetAmount),
      portfolioDerived: true
    };
  });

  return {
    goals: reconciledGoals,
    totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
    activeMonthlySip: Number(activeMonthlySip.toFixed(2)),
    assignedGoalCorpus: Number(assignedGoalCorpus.toFixed(2)),
    specificAssignedCorpus: Number(specificAssignedCorpus.toFixed(2)),
    generalWealthCorpus: Number(generalWealthCorpus.toFixed(2)),
    generalWealthMonthlySip: Number(generalWealthMonthlySip.toFixed(2)),
    invalidGoalAllocations,
    nameMatchedGoalAllocations
  };
}
