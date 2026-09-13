export function normaliseReconciliationIssueSeverity(value) {
  const severity = String(value || "").trim().toLowerCase();
  if (["block", "error", "critical", "fatal"].includes(severity)) return "block";
  if (["warn", "warning", "review", "needs_review"].includes(severity)) return "warn";
  return "info";
}

export function normaliseReconciliationIssues(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: String(item?.code || `reconciliation-${index + 1}`),
    code: String(item?.code || "reconciliation_issue"),
    severity: normaliseReconciliationIssueSeverity(item?.severity),
    title: String(item?.title || "Portfolio reconciliation item"),
    description: String(item?.description || item?.detail || "Review this portfolio reconciliation item."),
    count: Number(item?.count || 0)
  }));
}

export function resolveReconciliationVerification(reconciliation = null, fallbackStatus = "verified") {
  const aggregateStatus = String(reconciliation?.status || fallbackStatus || "verified").trim().toLowerCase();
  const rawIssues = Array.isArray(reconciliation?.issues) ? reconciliation.issues : [];
  const issues = normaliseReconciliationIssues(rawIssues);
  const actionableIssues = issues.filter((item) => item.severity !== "info");
  const hasDetailedIssues = rawIssues.length > 0;
  const blockingIssues = actionableIssues.filter((item) => item.severity === "block");
  const warningIssues = actionableIssues.filter((item) => item.severity === "warn");

  // Detailed issue severity is authoritative whenever the snapshot supplies it.
  // Aggregate status is only a fallback for legacy snapshots without issue rows.
  const status = blockingIssues.length
    ? "block"
    : warningIssues.length
      ? "warn"
      : actionableIssues.length
        ? "warn"
        : hasDetailedIssues
          ? "pass"
          : ["mismatch", "ownership_conflict"].includes(aggregateStatus)
            ? "block"
            : ["needs_review", "stale", "missing_source"].includes(aggregateStatus)
              ? "warn"
              : "pass";

  return {
    status,
    issues: actionableIssues,
    blockingIssueCount: blockingIssues.length,
    warningIssueCount: warningIssues.length,
    aggregateStatus,
    hasDetailedIssues
  };
}

function positionIdentity(item = {}) {
  return String(item.positionId || item.id || "");
}

export function resolveHoldingChangeVerification({ isOpening = false, positions = [], openingSnapshot = null, openingPositions = [] } = {}) {
  const activePositions = Array.isArray(positions) ? positions : [];
  const previousPositions = Array.isArray(openingPositions) ? openingPositions : [];
  const comparisonApplicable = !isOpening && Boolean(openingSnapshot);

  if (isOpening) {
    return {
      comparisonApplicable: false,
      label: "Opening portfolio holdings",
      status: "pass",
      detail: `${activePositions.length} active holding${activePositions.length === 1 ? "" : "s"} establish the investor's opening GrowVest portfolio baseline. New/exited holding comparison starts with the next Monthly Wealth Review.`,
      newHoldings: [],
      exitedHoldings: []
    };
  }

  if (!comparisonApplicable) {
    return {
      comparisonApplicable: false,
      label: "New / exited holdings review",
      status: "pass",
      detail: "Holding-change comparison will become available after an opening snapshot exists.",
      newHoldings: [],
      exitedHoldings: []
    };
  }

  const closingIds = new Set(activePositions.map(positionIdentity).filter(Boolean));
  const openingIds = new Set(previousPositions.map(positionIdentity).filter(Boolean));
  const newHoldings = activePositions.filter((item) => !openingIds.has(positionIdentity(item)));
  const exitedHoldings = previousPositions.filter((item) => !closingIds.has(positionIdentity(item)));

  return {
    comparisonApplicable: true,
    label: "New / exited holdings review",
    status: newHoldings.length || exitedHoldings.length ? "warn" : "pass",
    detail: `${newHoldings.length} new and ${exitedHoldings.length} exited holding${newHoldings.length + exitedHoldings.length === 1 ? "" : "s"} detected for the period.`,
    newHoldings,
    exitedHoldings
  };
}
