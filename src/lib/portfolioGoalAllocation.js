export const GENERAL_WEALTH_BUCKET_ID = "general_wealth";
export const GENERAL_WEALTH_BUCKET_NAME = "General Wealth";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedPercentage(value) {
  return Math.max(0, Math.min(100, number(value)));
}

export function isGeneralWealthName(value = "") {
  return /^(general\s*wealth(?:\s*corpus)?|unassigned|default)$/i.test(String(value || "").trim());
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
