import { ASSET_CLASS_COLORS } from "@/lib/constants/report";

export function compactCurrency(value) {
  const amount = Number(value || 0);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (absolute >= 10000000) return `${sign}₹${(absolute / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (absolute >= 100000) return `${sign}₹${(absolute / 100000).toFixed(2).replace(/\.00$/, "")} L`;
  if (absolute >= 1000) return `${sign}₹${(absolute / 1000).toFixed(0)}K`;
  return `${sign}₹${absolute.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function initials(name = "") {
  const value = String(name).trim();
  if (!value) return "GV";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
}

export function investorFacingAdvisorDesignation(value = "") {
  const designation = String(value || "").trim();
  const normalized = designation.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const internalTitles = new Set([
    "super admin",
    "super administrator",
    "administrator",
    "admin",
    "system admin",
    "system administrator"
  ]);

  if (!designation || internalTitles.has(normalized)) return "Relationship Advisor";
  return designation;
}

export function formatClientRelationship(months = 0, companyName = "GrowVest") {
  const totalMonths = Math.max(0, Number(months || 0));
  if (!totalMonths) return "Active client relationship";

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  const parts = [];

  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (remainingMonths) parts.push(`${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`);

  return `${parts.join(" ")} with ${companyName}`;
}

export function goalTone(goal = {}) {
  const status = String(goal.status || "").toLowerCase();
  const progress = Number(goal.progress || 0);
  if (status.includes("review") || status.includes("attention")) return "danger";
  if (status.includes("completed") || status.includes("on track")) return "success";
  if (progress >= 80) return "cyan";
  if (status.includes("not started") || progress === 0) return "muted";
  return "primary";
}

export function goalDisplayStatus(goal = {}) {
  const progress = Number(goal.progress || 0);
  const status = String(goal.status || "Planning");
  if (status === "Review Needed") return "Attention Required";
  if (status === "Completed") return "Completed";
  if (progress >= 80 && progress < 100) return "Near Completion";
  return status;
}

export function allocationStatus(item = {}) {
  const variance = Number(item.variance || 0);
  if (Math.abs(variance) < 1) return { label: "On Target", tone: "neutral" };
  if (variance > 0) return { label: "Above Target", tone: "danger" };
  return { label: "Below Target", tone: "success" };
}

export function holdingColor(item = {}) {
  return item.color || ASSET_CLASS_COLORS[item.assetClass] || ASSET_CLASS_COLORS.Other;
}

export function deriveReportHighlights(report = {}) {
  const summary = report.summary || {};
  const goals = report.goals || [];
  const allocation = report.allocation || [];
  const custom = Array.isArray(report.monthlyHighlights) ? report.monthlyHighlights.filter((item) => item?.description || item?.title) : [];
  if (custom.length) return custom.slice(0, 4);

  const bestGoal = [...goals].sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0))[0];
  const attentionGoal = goals.find((item) => String(item.status || "").toLowerCase().includes("review"));
  const largestGap = [...allocation].sort((a, b) => Math.abs(Number(b.variance || 0)) - Math.abs(Number(a.variance || 0)))[0];
  const highlights = [];

  if (Number(summary.investmentGain || 0) !== 0) {
    highlights.push({
      id: "gain",
      type: Number(summary.investmentGain) >= 0 ? "success" : "danger",
      title: "Portfolio movement",
      description: `Portfolio ${Number(summary.investmentGain) >= 0 ? "increased" : "decreased"} by ${compactCurrency(Math.abs(summary.investmentGain))} this month.`
    });
  }
  if (bestGoal) {
    highlights.push({
      id: "goal",
      type: "info",
      title: bestGoal.name,
      description: `${Number(bestGoal.progress || 0).toFixed(1)}% complete${Number(bestGoal.progress || 0) >= 80 ? " — near completion" : ""}.`
    });
  }
  if (largestGap) {
    highlights.push({
      id: "allocation",
      type: "warning",
      title: "Allocation review",
      description: `${largestGap.assetClass} is ${Math.abs(Number(largestGap.variance || 0)).toFixed(1)}% ${Number(largestGap.variance || 0) > 0 ? "above" : "below"} target allocation.`
    });
  }
  if (attentionGoal) {
    const gap = Math.max(0, Number(attentionGoal.targetAmount || 0) - Number(attentionGoal.currentAmount || 0));
    highlights.push({
      id: "attention",
      type: "danger",
      title: attentionGoal.name,
      description: gap ? `Requires ${compactCurrency(gap)} additional contribution.` : "Requires Advisor attention."
    });
  }
  return highlights.slice(0, 4);
}

export function deriveAdvisorInsights(report = {}) {
  const custom = report.advisorInsights || {};
  const highlights = deriveReportHighlights(report);
  const goals = report.goals || [];
  const allocation = report.allocation || [];
  const bestGoal = [...goals].sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0))[0];
  const attentionGoal = goals.find((item) => String(item.status || "").toLowerCase().includes("review"));
  const largestGap = [...allocation].sort((a, b) => Math.abs(Number(b.variance || 0)) - Math.abs(Number(a.variance || 0)))[0];

  return {
    narrative: custom.narrative || report.advisorNote?.content || "Your wealth journey continues to move forward. Review the key progress areas and agreed next actions below.",
    progressHighlight: custom.progressHighlight?.title || custom.progressHighlight?.description
      ? custom.progressHighlight
      : {
          title: bestGoal?.name || highlights.find((item) => item.type === "info")?.title || "Portfolio Progress",
          description: bestGoal ? `${Number(bestGoal.progress || 0).toFixed(1)}% completed` : "Progress remains aligned to the plan."
        },
    priorityAttention: custom.priorityAttention?.title || custom.priorityAttention?.description
      ? custom.priorityAttention
      : {
          title: attentionGoal?.name || "Priority Review",
          description: attentionGoal
            ? `${compactCurrency(Math.max(0, Number(attentionGoal.targetAmount || 0) - Number(attentionGoal.currentAmount || 0)))} short`
            : "No urgent goal attention recorded."
        },
    portfolioOpportunity: custom.portfolioOpportunity?.title || custom.portfolioOpportunity?.description
      ? custom.portfolioOpportunity
      : {
          title: "Allocation Review",
          description: largestGap
            ? `${largestGap.assetClass} is ${Math.abs(Number(largestGap.variance || 0)).toFixed(1)}% ${Number(largestGap.variance || 0) > 0 ? "above" : "below"} target allocation.`
            : "Review allocation opportunities with your Advisor."
        }
  };
}

export function derivePortfolioHealth(report = {}) {
  const allocation = report.allocation || [];
  const growthClasses = new Set(report.portfolioHealth?.growthAssetClasses || ["Equity", "Trading", "Real Estate"]);
  const stableClasses = new Set(report.portfolioHealth?.stableAssetClasses || ["Debt", "Liquid", "Cash", "Insurance", "Gold"]);
  const growth = allocation.reduce((sum, item) => sum + (growthClasses.has(item.assetClass) ? Number(item.currentPercentage || 0) : 0), 0);
  const stable = allocation.reduce((sum, item) => sum + (stableClasses.has(item.assetClass) ? Number(item.currentPercentage || 0) : 0), 0);
  const gaps = allocation.filter((item) => Math.abs(Number(item.variance || 0)) >= 5).length;
  const needsRebalancing = gaps > 0;
  const observation = report.portfolioHealth?.observation || (needsRebalancing
    ? "One or more asset classes differ materially from the target allocation. Review the balance with your Advisor before making changes."
    : "The portfolio allocation is broadly aligned with the target allocation.");
  return { growth, stable, gaps, needsRebalancing, observation };
}

export function buildTrendData(report = {}, history = []) {
  const all = [...history];
  if (!all.find((item) => item.id === report.id)) all.push(report);
  const sorted = all
    .filter((item) => item?.reportMonthKey && Number(item?.summary?.totalCorpus || 0) >= 0)
    .sort((a, b) => String(a.reportMonthKey).localeCompare(String(b.reportMonthKey)));
  return sorted.slice(-12).map((item) => ({
    id: item.id,
    monthKey: item.reportMonthKey,
    label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(Number(item.reportYear), Number(item.reportMonth) - 1, 1)),
    value: Number(item.summary?.totalCorpus || 0)
  }));
}

export function previousReportFor(report = {}, history = []) {
  return [...history]
    .filter((item) => item.id !== report.id && String(item.reportMonthKey || "") < String(report.reportMonthKey || ""))
    .sort((a, b) => String(b.reportMonthKey || "").localeCompare(String(a.reportMonthKey || "")))[0] || null;
}

export function reportWhatsAppMessage(report = {}, viewUrl = "") {
  return [
    `Hello ${report.investorName || ""},`,
    "",
    `Your GrowVest Monthly Wealth Progress Report for ${report.title?.replace("Monthly Portfolio Report — ", "") || report.reportMonthKey || "the latest period"} is now available.`,
    viewUrl ? `View report: ${viewUrl}` : "Please log in to the GrowVest Investor Portal to view the report.",
    "",
    `Regards,`,
    `${report.advisorName || "GrowVest Advisor"}`,
    "GrowVest"
  ].join("\n");
}

export function deriveReportTransactions(report = {}) {
  if (Array.isArray(report.transactions) && report.transactions.length) {
    return report.transactions
      .map((item, index) => ({
        id: item.id || `transaction-${index + 1}`,
        date: item.date || item.transactionDate || report.statementDate || report.reportMonthKey || "",
        type: item.type || item.transactionType || "Investment",
        instrumentName: item.instrumentName || item.instrument || item.fundName || "Portfolio transaction",
        amount: Number(item.amount || item.value || 0),
        notes: item.notes || item.description || ""
      }))
      .filter((item) => item.amount !== 0 || item.instrumentName || item.notes);
  }

  return (report.funds || []).flatMap((item, index) => {
    const date = item.transactionDate || report.statementDate || report.reportMonthKey || "";
    const rows = [];
    if (Number(item.investment || 0) > 0) {
      rows.push({
        id: `${item.id || index}-investment`,
        date,
        type: "Investment",
        instrumentName: item.instrumentName,
        amount: Number(item.investment || 0),
        notes: item.notes || ""
      });
    }
    if (Number(item.withdrawal || 0) > 0) {
      rows.push({
        id: `${item.id || index}-withdrawal`,
        date,
        type: "Withdrawal",
        instrumentName: item.instrumentName,
        amount: Number(item.withdrawal || 0),
        notes: item.notes || ""
      });
    }
    return rows;
  });
}
