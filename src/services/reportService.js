import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/constants/roles";
import {
  ASSET_CLASS_COLORS,
  REPORT_STATUS,
  calculatePercentage,
  getMonthLabel,
  getReportMonthKey
} from "@/lib/constants/report";
import { sanitizeForFirestore } from "@/services/assessmentService";
import { syncMonthlyReportActions } from "@/services/actionService";
import { GENERAL_WEALTH_BUCKET_NAME, normalisePortfolioGoalAllocations, portfolioBucketLabel } from "@/lib/portfolioGoalAllocation";
import {
  DEFAULT_REPORT_TEMPLATE_ID,
  createReportTemplateSnapshot,
  getSystemReportTemplate
} from "@/lib/constants/reportTemplates";


function reportTimeValue(item) {
  const value = item?.reportMonthKey || item?.statementDate || item?.createdAt;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "string") return value;
  return value ? new Date(value).getTime() : 0;
}

function sortReportsDescending(items = []) {
  return [...items].sort((a, b) => String(reportTimeValue(b)).localeCompare(String(reportTimeValue(a))));
}

function isIndexUnavailable(error) {
  return error?.code === "failed-precondition" || /index.*building|requires an index/i.test(error?.message || "");
}

function rowsFromSnapshot(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function isPrivileged(currentUser) {
  return [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser?.role);
}

function cleanRows(rows = [], identifyingFields = []) {
  return rows.filter((row) => identifyingFields.some((field) => {
    const value = row?.[field];
    return value !== "" && value !== null && value !== undefined && Number(value || 0) !== 0;
  }));
}

function normaliseHoldings(rows = [], totalCorpus = 0) {
  return cleanRows(rows, ["currentValue", "percentage"]).map((item, index) => {
    const currentValue = Number(item.currentValue || 0);
    const assetClass = item.assetClass || "Other";
    return {
      id: item.id || `holding-${index + 1}`,
      assetClass,
      currentValue,
      percentage: Number(item.percentage || calculatePercentage(currentValue, totalCorpus)),
      color: item.color || ASSET_CLASS_COLORS[assetClass] || ASSET_CLASS_COLORS.Other
    };
  });
}

function normaliseGoals(rows = []) {
  return cleanRows(rows, ["name", "targetAmount", "currentAmount"]).map((goal, index) => ({
    goalId: goal.goalId || goal.id || `goal-${index + 1}`,
    name: goal.name || "",
    category: goal.category || "",
    type: goal.type || "Flexible",
    targetAmount: Number(goal.targetAmount || 0),
    currentAmount: Number(goal.currentAmount || 0),
    monthlySip: Number(goal.monthlySip || 0),
    targetYear: goal.targetYear ? Number(goal.targetYear) : null,
    status: goal.status || "Planning",
    progress: Number(goal.progress || calculatePercentage(goal.currentAmount, goal.targetAmount)),
    isPrimary: Boolean(goal.isPrimary)
  }));
}

function normaliseAllocation(rows = [], totalCorpus = 0) {
  return cleanRows(rows, ["currentValue", "targetPercentage", "monthlySip"]).map((item, index) => {
    const currentValue = Number(item.currentValue || 0);
    const currentPercentage = Number(item.currentPercentage || calculatePercentage(currentValue, totalCorpus));
    const targetPercentage = Number(item.targetPercentage || 0);
    return {
      id: item.id || `allocation-${index + 1}`,
      assetClass: item.assetClass || "Other",
      currentValue,
      monthlySip: Number(item.monthlySip || 0),
      currentPercentage,
      targetPercentage,
      variance: Number((currentPercentage - targetPercentage).toFixed(1))
    };
  });
}

function normaliseFunds(rows = []) {
  return cleanRows(rows, ["instrumentName", "currentValue", "monthlySip"]).map((item, index) => {
    const goalAllocations = normalisePortfolioGoalAllocations(item.goalAllocations);
    const primaryBucket = goalAllocations.find((allocation) => allocation.goalId) || goalAllocations[0];
    return ({
    id: item.id || `fund-${index + 1}`,
    positionId: item.positionId || "",
    instrumentName: item.instrumentName || "",
    assetClass: item.assetClass || "Other",
    goalId: item.goalId || primaryBucket?.goalId || "",
    goalName: item.goalName || primaryBucket?.goalName || GENERAL_WEALTH_BUCKET_NAME,
    goalAllocations,
    bucketLabel: item.bucketLabel || portfolioBucketLabel(goalAllocations),
    monthlySip: Number(item.monthlySip || 0),
    currentValue: Number(item.currentValue || 0),
    openingValue: Number(item.openingValue || 0),
    investment: Number(item.investment || 0),
    withdrawal: Number(item.withdrawal || 0),
    profitLoss: Number(item.profitLoss || 0),
    returnPercentage: Number(item.returnPercentage || 0),
    quantity: Number(item.quantity || 0),
    transactionDate: item.transactionDate || "",
    type: item.type || "Fixed",
    investmentType: item.investmentType || "",
    productType: item.productType || "",
    source: item.source || "",
    provider: item.provider || "",
    investmentMode: item.investmentMode || "",
    totalInvested: Number(item.totalInvested || 0),
    units: Number(item.units || 0),
    currentNav: Number(item.currentNav || 0),
    navDate: item.navDate || "",
    averageBuyRate: Number(item.averageBuyRate || 0),
    currentRate: Number(item.currentRate || 0),
    valuationDate: item.valuationDate || "",
    isin: item.isin || "",
    folioNo: item.folioNo || "",
    symbol: item.symbol || "",
    policyNumber: item.policyNumber || "",
    planName: item.planName || "",
    fundName: item.fundName || "",
    fundCode: item.fundCode || "",
    insurer: item.insurer || "",
    premiumAmount: Number(item.premiumAmount || 0),
    premiumFrequency: item.premiumFrequency || "",
    policyTotalPremiumPaid: Number(item.policyTotalPremiumPaid || 0),
    policyStartDate: item.policyStartDate || "",
    maturityDate: item.maturityDate || "",
    sumAssured: Number(item.sumAssured || 0),
    policyStatus: item.policyStatus || "",
    gainLossAvailable: item.gainLossAvailable !== false,
    notes: item.notes || ""
    });
  });
}



function normaliseTransactions(rows = []) {
  return cleanRows(rows, ["instrumentName", "transactionType", "amount", "notes"]).map((item, index) => ({
    id: item.id || `transaction-${index + 1}`,
    date: item.date || item.transactionDate || "",
    transactionDate: item.transactionDate || item.date || "",
    type: item.type || item.transactionType || "Investment",
    transactionType: item.transactionType || item.type || "Investment",
    instrumentName: item.instrumentName || item.schemeName || "Investment",
    amount: Number(item.amount || 0),
    cashFlowType: item.cashFlowType || "",
    financialImpactStatus: item.financialImpactStatus || "confirmed",
    notes: item.notes || ""
  }));
}

function normaliseFinancialPlan(value = {}) {
  return {
    monthlySurplus: Number(value.monthlySurplus || 0),
    surplusMode: value.surplusMode || "fixed",
    surplusPercentage: Number(value.surplusPercentage || 0),
    surplusAllocations: (value.surplusAllocations || []).filter((item) => item?.category || Number(item?.calculatedAmount || item?.fixedAmount || item?.percentage || 0)).map((item, index) => ({
      id: item.id || `surplus-${index + 1}`,
      category: item.category || "Other / Custom",
      mode: item.mode === "percentage" ? "percentage" : "fixed",
      fixedAmount: Number(item.fixedAmount || 0),
      percentage: Number(item.percentage || 0),
      calculatedAmount: Number(item.calculatedAmount || 0),
      notes: item.notes || ""
    })),
    loans: (value.loans || []).filter((item) => item?.type || item?.lender || Number(item?.outstandingAmount || 0)).map((item, index) => ({
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
  };
}

function normaliseActions(rows = []) {
  return cleanRows(rows, ["title", "description"]).map((item, index) => ({
    id: item.id || `action-${index + 1}`,
    title: item.title || "",
    description: item.description || item.title || "",
    recommendationType: item.recommendationType || "Portfolio Review",
    investorDecision: item.investorDecision || "Pending Discussion",
    relatedGoalId: item.relatedGoalId || "",
    relatedInvestmentId: item.relatedInvestmentId || "",
    sourceActionId: item.sourceActionId || "",
    sourceReportId: item.sourceReportId || "",
    sourceReportMonthKey: item.sourceReportMonthKey || "",
    owner: item.owner || "Advisor",
    priority: item.priority || "Planned",
    dueDate: item.dueDate || "",
    completionDate: item.completionDate || "",
    status: item.status || "Recommended",
    requestType: item.requestType || item.recommendationType || "",
    requestedAmount: Number(item.requestedAmount || 0),
    requestedMonthlyAmount: Number(item.requestedMonthlyAmount || 0),
    requestedUnits: Number(item.requestedUnits || 0),
    requestedEffectiveDate: item.requestedEffectiveDate || "",
    requestedTargetGoalId: item.requestedTargetGoalId || "",
    requestedTargetGoalName: item.requestedTargetGoalName || "",
    requestedAccountReference: item.requestedAccountReference || "",
    requestedChangeDetails: item.requestedChangeDetails || "",
    sourceType: item.sourceType || "",
    relatedGoalName: item.relatedGoalName || "",
    relatedInvestmentName: item.relatedInvestmentName || "",
    withdrawalPurpose: item.withdrawalPurpose || "",
    withdrawalBucketId: item.withdrawalBucketId || "",
    withdrawalBucketName: item.withdrawalBucketName || "",
    withdrawalItems: Array.isArray(item.withdrawalItems) ? item.withdrawalItems : [],
    withdrawalCompletion: item.withdrawalCompletion || null,
    withdrawalPortfolioApplied: Boolean(item.withdrawalPortfolioApplied),
    actualFinancialAmount: Number(item.actualFinancialAmount || 0),
    actualFinancialDate: item.actualFinancialDate || "",
    actualFinancialReference: item.actualFinancialReference || "",
    financialImpactType: item.financialImpactType || "none",
    financialImpactStatus: item.financialImpactStatus || "not_applicable"
  }));
}

function normaliseHighlights(rows = []) {
  return cleanRows(rows, ["title", "description"]).map((item, index) => ({
    id: item.id || `highlight-${index + 1}`,
    type: item.type || "info",
    title: item.title || "",
    description: item.description || ""
  })).slice(0, 4);
}

function renderableReportData(report = {}) {
  return {
    investorId: report.investorId || "",
    investorName: report.investorName || "",
    clientCode: report.clientCode || "",
    advisorUid: report.advisorUid || "",
    assignedAdvisorUid: report.assignedAdvisorUid || "",
    advisorName: report.advisorName || "",
    advisorEmail: report.advisorEmail || "",
    advisorPhone: report.advisorPhone || "",
    advisorDesignation: report.advisorDesignation || "",
    journeyDurationMonths: Number(report.journeyDurationMonths || 0),
    reportMonth: Number(report.reportMonth || 0),
    reportYear: Number(report.reportYear || 0),
    reportMonthKey: report.reportMonthKey || "",
    statementDate: report.statementDate || "",
    portfolioAsOfDate: report.portfolioAsOfDate || "",
    sourcePortfolioSnapshotId: report.sourcePortfolioSnapshotId || "",
    portfolioVerificationStatus: report.portfolioVerificationStatus || "",
    portfolioSourceFreshness: report.portfolioSourceFreshness || [],
    portfolioVerification: report.portfolioVerification || null,
    reportGenerationSource: report.reportGenerationSource || "",
    reportingPeriod: report.reportingPeriod || null,
    monthlyChanges: report.monthlyChanges || [],
    title: report.title || "",
    templateId: report.templateId || DEFAULT_REPORT_TEMPLATE_ID,
    templateVersion: Number(report.templateVersion || report.templateSnapshot?.version || 1),
    templateSnapshot: report.templateSnapshot || null,
    templateAppliedAt: report.templateAppliedAt || null,
    summary: report.summary || {},
    holdings: report.holdings || [],
    financialPlan: report.financialPlan || {},
    advisorNote: report.advisorNote || {},
    advisorInsights: report.advisorInsights || {},
    monthlyHighlights: report.monthlyHighlights || [],
    portfolioHealth: report.portfolioHealth || {},
    goals: report.goals || [],
    allocation: report.allocation || [],
    funds: report.funds || [],
    transactions: report.transactions || [],
    tradingSummary: report.tradingSummary || null,
    profileActions: report.profileActions || [],
    nextSteps: report.nextSteps || [],
    nextReview: report.nextReview || {},
    disclaimer: report.disclaimer || ""
  };
}

function stableSerializableValue(value) {
  if (Array.isArray(value)) return value.map(stableSerializableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableSerializableValue(value[key]);
      return result;
    }, {});
}

function stableSerialize(value) {
  return JSON.stringify(stableSerializableValue(value));
}

function reportRenderFingerprint(report = {}) {
  return stableSerialize(renderableReportData(report));
}

function reportTemplateChanged(existing = {}, next = {}) {
  return String(existing.templateId || DEFAULT_REPORT_TEMPLATE_ID) !== String(next.templateId || DEFAULT_REPORT_TEMPLATE_ID)
    || Number(existing.templateVersion || existing.templateSnapshot?.version || 1) !== Number(next.templateVersion || next.templateSnapshot?.version || 1)
    || stableSerialize(existing.templateSnapshot || null) !== stableSerialize(next.templateSnapshot || null);
}

function normaliseReportPayload(payload, currentUser, status) {
  const summary = {
    totalCorpus: Number(payload.summary?.totalCorpus || 0),
    totalInvested: Number(payload.summary?.totalInvested || 0),
    portfolioGainLoss: Number(payload.summary?.portfolioGainLoss || 0),
    generalWealthCorpus: Number(payload.summary?.generalWealthCorpus || 0),
    lifetimeTarget: Number(payload.summary?.lifetimeTarget || 0),
    overallProgress: Number(payload.summary?.overallProgress || calculatePercentage(payload.summary?.totalCorpus, payload.summary?.lifetimeTarget)),
    monthlySip: Number(payload.summary?.monthlySip || 0),
    newMoneyAdded: Number(payload.summary?.newMoneyAdded || 0),
    investmentGain: Number(payload.summary?.investmentGain || 0),
    openingValue: Number(payload.summary?.openingValue || 0),
    totalWithdrawals: Number(payload.summary?.totalWithdrawals || 0)
  };

  const reportMonth = Number(payload.reportMonth);
  const reportYear = Number(payload.reportYear);
  const reportMonthKey = getReportMonthKey(reportYear, reportMonth);

  return {
    investorId: payload.investorId,
    investorName: payload.investorName || "",
    clientCode: payload.clientCode || "",
    investorEmail: payload.investorEmail || "",
    investorContactNo: payload.investorContactNo || "",
    investorPortalUid: payload.investorPortalUid || null,
    advisorUid: payload.advisorUid || currentUser.id,
    assignedAdvisorUid: payload.assignedAdvisorUid || payload.advisorUid || currentUser.id,
    advisorName: payload.advisorName || currentUser.fullName || "",
    advisorEmail: payload.advisorEmail || currentUser.email || "",
    advisorPhone: payload.advisorPhone || currentUser.mobile || "",
    advisorDesignation: payload.advisorDesignation || currentUser.designation || "Relationship Manager",
    journeyDurationMonths: Number(payload.journeyDurationMonths || 0),
    reportMonth,
    reportYear,
    reportMonthKey,
    statementDate: payload.statementDate,
    portfolioAsOfDate: payload.portfolioAsOfDate || "",
    sourcePortfolioSnapshotId: payload.sourcePortfolioSnapshotId || null,
    portfolioVerificationStatus: payload.portfolioVerificationStatus || "",
    portfolioSourceFreshness: payload.portfolioSourceFreshness || [],
    portfolioVerification: payload.portfolioVerification ? {
      required: Boolean(payload.portfolioVerification.required),
      status: payload.portfolioVerification.status || "pending",
      asOfDate: payload.portfolioVerification.asOfDate || "",
      snapshotId: payload.portfolioVerification.snapshotId || payload.sourcePortfolioSnapshotId || "",
      snapshotDate: payload.portfolioVerification.snapshotDate || payload.portfolioAsOfDate || "",
      snapshotAgeDays: payload.portfolioVerification.snapshotAgeDays === null || payload.portfolioVerification.snapshotAgeDays === undefined ? null : Number(payload.portfolioVerification.snapshotAgeDays),
      openingSnapshotId: payload.portfolioVerification.openingSnapshotId || "",
      openingSnapshotDate: payload.portfolioVerification.openingSnapshotDate || "",
      checks: payload.portfolioVerification.checks || [],
      sourceFreshness: payload.portfolioVerification.sourceFreshness || [],
      counts: payload.portfolioVerification.counts || {},
      acknowledged: Boolean(payload.portfolioVerification.acknowledged),
      acknowledgedAt: payload.portfolioVerification.acknowledgedAt || null,
      acknowledgedByUid: payload.portfolioVerification.acknowledgedByUid || "",
      acknowledgedByName: payload.portfolioVerification.acknowledgedByName || ""
    } : null,
    reportGenerationSource: payload.reportGenerationSource || (payload.sourcePortfolioSnapshotId ? "portfolio_master" : ""),
    reportingPeriod: payload.reportingPeriod ? {
      monthKey: payload.reportingPeriod.monthKey || reportMonthKey,
      startDate: payload.reportingPeriod.startDate || `${reportMonthKey}-01`,
      endDate: payload.reportingPeriod.endDate || payload.statementDate || "",
      portfolioCutoffDate: payload.reportingPeriod.portfolioCutoffDate || payload.statementDate || ""
    } : { monthKey: reportMonthKey, startDate: `${reportMonthKey}-01`, endDate: payload.statementDate || "", portfolioCutoffDate: payload.statementDate || "" },
    monthlyChanges: (payload.monthlyChanges || []).slice(0, 24).map((item, index) => ({
      id: item.id || `change-${index + 1}`,
      type: item.type || "portfolio_change",
      title: item.title || "Portfolio change",
      description: item.description || "",
      amount: Number(item.amount || 0),
      previousAmount: Number(item.previousAmount || 0),
      date: item.date || "",
      status: item.status || "actual"
    })),
    title: payload.title || `Monthly Portfolio Report — ${getMonthLabel(reportMonth)} ${reportYear}`,
    status,
    investorVisible: Boolean(payload.investorVisible && status === REPORT_STATUS.COMPLETED),
    templateId: payload.templateId || payload.templateSnapshot?.id || DEFAULT_REPORT_TEMPLATE_ID,
    templateVersion: Number(
      payload.templateVersion
      || payload.templateSnapshot?.version
      || getSystemReportTemplate(payload.templateId || payload.templateSnapshot?.id || DEFAULT_REPORT_TEMPLATE_ID)?.version
      || 1
    ),
    templateSnapshot: createReportTemplateSnapshot(
      payload.templateSnapshot
        ? {
            ...payload.templateSnapshot,
            // The report's selected template fields must override any stale
            // id/version that may remain inside an older snapshot.
            id: payload.templateId || payload.templateSnapshot.id || DEFAULT_REPORT_TEMPLATE_ID,
            version: Number(payload.templateVersion || payload.templateSnapshot.version || 1)
          }
        : getSystemReportTemplate(payload.templateId || DEFAULT_REPORT_TEMPLATE_ID)
    ),
    templateAppliedAt: payload.templateAppliedAt || null,
    summary,
    holdings: normaliseHoldings(payload.holdings, summary.totalCorpus),
    financialPlan: normaliseFinancialPlan(payload.financialPlan),
    advisorNote: {
      content: payload.advisorNote?.content || "",
      highlight: payload.advisorNote?.highlight || ""
    },
    advisorInsights: {
      narrative: payload.advisorInsights?.narrative || payload.advisorNote?.content || "",
      progressHighlight: {
        title: payload.advisorInsights?.progressHighlight?.title || "",
        description: payload.advisorInsights?.progressHighlight?.description || ""
      },
      priorityAttention: {
        title: payload.advisorInsights?.priorityAttention?.title || "",
        description: payload.advisorInsights?.priorityAttention?.description || ""
      },
      portfolioOpportunity: {
        title: payload.advisorInsights?.portfolioOpportunity?.title || "",
        description: payload.advisorInsights?.portfolioOpportunity?.description || ""
      }
    },
    monthlyHighlights: normaliseHighlights(payload.monthlyHighlights),
    portfolioHealth: {
      observation: payload.portfolioHealth?.observation || "",
      growthAssetClasses: payload.portfolioHealth?.growthAssetClasses || ["Equity", "Trading", "Real Estate"],
      stableAssetClasses: payload.portfolioHealth?.stableAssetClasses || ["Debt", "Liquid", "Cash", "Insurance", "Gold"]
    },
    goals: normaliseGoals(payload.goals),
    allocation: normaliseAllocation(payload.allocation, summary.totalCorpus),
    funds: normaliseFunds(payload.funds),
    transactions: normaliseTransactions(payload.transactions),
    profileActions: normaliseActions(payload.profileActions),
    tradingSummary: payload.tradingSummary ? {
      monthKey: payload.tradingSummary.monthKey || reportMonthKey,
      totalTrades: Number(payload.tradingSummary.totalTrades || 0),
      winningTrades: Number(payload.tradingSummary.winningTrades || 0),
      losingTrades: Number(payload.tradingSummary.losingTrades || 0),
      turnover: Number(payload.tradingSummary.turnover || 0),
      grossPnl: Number(payload.tradingSummary.grossPnl || 0),
      totalCharges: Number(payload.tradingSummary.totalCharges || 0),
      netPnl: Number(payload.tradingSummary.netPnl || 0),
      tradingCapital: Number(payload.tradingSummary.tradingCapital || 0)
    } : null,
    nextSteps: normaliseActions(payload.nextSteps),
    nextReview: {
      date: payload.nextReview?.date || "",
      note: payload.nextReview?.note || "",
      mode: payload.nextReview?.mode || ""
    },
    disclaimer: payload.disclaimer || "",
    sourceReportId: payload.sourceReportId || null,
    sourceReportMonthKey: payload.sourceReportMonthKey || null,
    sourceImportId: payload.sourceImportId || null,
    sourceImportFileName: payload.sourceImportFileName || "",
    importedDataSummary: payload.importedDataSummary || null,
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName,
    updatedAt: serverTimestamp()
  };
}

export function subscribeMonthlyReports(currentUser, callback, onError) {
  const constraints = isPrivileged(currentUser)
    ? [orderBy("createdAt", "desc"), limit(150)]
    : [where("advisorUid", "==", currentUser.id), orderBy("createdAt", "desc"), limit(150)];

  return onSnapshot(
    query(collection(db, "monthlyReports"), ...constraints),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeInvestorReports(investorId, currentUser, callback, onError) {
  if (!investorId) {
    callback([]);
    return () => {};
  }

  if (!currentUser?.id) {
    callback([]);
    return () => {};
  }

  const constraints = [where("investorId", "==", investorId)];
  if (currentUser?.role === USER_ROLES.ADVISOR) constraints.push(where("advisorUid", "==", currentUser.id));
  if (currentUser?.role === USER_ROLES.INVESTOR) {
    constraints.push(where("investorVisible", "==", true));
    constraints.push(where("status", "==", REPORT_STATUS.COMPLETED));
  }

  let fallbackUnsubscribe = () => {};
  const primaryUnsubscribe = onSnapshot(
    query(
      collection(db, "monthlyReports"),
      ...constraints,
      orderBy("reportMonthKey", "desc"),
      limit(36)
    ),
    (snapshot) => callback(rowsFromSnapshot(snapshot)),
    (error) => {
      if (!isIndexUnavailable(error)) {
        onError?.(error);
        return;
      }
      fallbackUnsubscribe = onSnapshot(
        query(collection(db, "monthlyReports"), ...constraints),
        (snapshot) => callback(sortReportsDescending(rowsFromSnapshot(snapshot)).slice(0, 36)),
        onError
      );
    }
  );
  return () => { primaryUnsubscribe(); fallbackUnsubscribe(); };
}

export function subscribePublishedInvestorReports(investorId, callback, onError) {
  let fallbackUnsubscribe = () => {};
  const primaryUnsubscribe = onSnapshot(
    query(
      collection(db, "monthlyReports"),
      where("investorId", "==", investorId),
      where("investorVisible", "==", true),
      where("status", "==", REPORT_STATUS.COMPLETED),
      orderBy("reportMonthKey", "desc"),
      limit(36)
    ),
    (snapshot) => callback(rowsFromSnapshot(snapshot)),
    (error) => {
      if (!isIndexUnavailable(error)) {
        onError?.(error);
        return;
      }
      fallbackUnsubscribe = onSnapshot(
        query(
          collection(db, "monthlyReports"),
          where("investorId", "==", investorId),
          where("investorVisible", "==", true),
          where("status", "==", REPORT_STATUS.COMPLETED)
        ),
        (snapshot) => callback(sortReportsDescending(rowsFromSnapshot(snapshot)).slice(0, 36)),
        onError
      );
    }
  );
  return () => { primaryUnsubscribe(); fallbackUnsubscribe(); };
}

export async function getPublishedInvestorReportsOnce(investorId, limitCount = 36) {
  try {
    const snapshot = await getDocs(query(
      collection(db, "monthlyReports"),
      where("investorId", "==", investorId),
      where("investorVisible", "==", true),
      where("status", "==", REPORT_STATUS.COMPLETED),
      orderBy("reportMonthKey", "desc"),
      limit(limitCount)
    ));
    return rowsFromSnapshot(snapshot);
  } catch (error) {
    if (!isIndexUnavailable(error)) throw error;
    const snapshot = await getDocs(query(
      collection(db, "monthlyReports"),
      where("investorId", "==", investorId),
      where("investorVisible", "==", true),
      where("status", "==", REPORT_STATUS.COMPLETED)
    ));
    return sortReportsDescending(rowsFromSnapshot(snapshot)).slice(0, limitCount);
  }
}

export function subscribeMonthlyReport(reportId, callback, onError) {
  return onSnapshot(
    doc(db, "monthlyReports", reportId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export async function getMonthlyReport(reportId) {
  const snapshot = await getDoc(doc(db, "monthlyReports", reportId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function getLatestInvestorReport(investorId, excludeMonthKey = "") {
  let reports = [];
  try {
    const snapshot = await getDocs(query(
      collection(db, "monthlyReports"),
      where("investorId", "==", investorId),
      orderBy("reportMonthKey", "desc"),
      limit(12)
    ));
    reports = rowsFromSnapshot(snapshot);
  } catch (error) {
    if (!isIndexUnavailable(error)) throw error;
    const snapshot = await getDocs(query(collection(db, "monthlyReports"), where("investorId", "==", investorId)));
    reports = sortReportsDescending(rowsFromSnapshot(snapshot)).slice(0, 12);
  }
  return reports.find((item) => item.reportMonthKey !== excludeMonthKey) || null;
}

export async function saveMonthlyReport(payload, currentUser, { reportId = null, complete = false, autosave = false } = {}) {
  const status = complete ? REPORT_STATUS.COMPLETED : REPORT_STATUS.DRAFT;
  const normalised = normaliseReportPayload(payload, currentUser, status);
  const documentId = reportId || `${normalised.investorId}_${normalised.reportMonthKey}`;
  const reportRef = doc(db, "monthlyReports", documentId);
  const existingSnapshot = await getDoc(reportRef);
  const canonicalPeriodId = `${normalised.investorId}_${normalised.reportMonthKey}`;

  if (!reportId && existingSnapshot.exists()) {
    throw new Error(`A report already exists for ${normalised.investorName} for ${getMonthLabel(normalised.reportMonth)} ${normalised.reportYear}.`);
  }

  if (reportId && canonicalPeriodId !== reportId) {
    const targetPeriodSnapshot = await getDoc(doc(db, "monthlyReports", canonicalPeriodId));
    if (targetPeriodSnapshot.exists()) {
      throw new Error(`A report already exists for ${normalised.investorName} for ${getMonthLabel(normalised.reportMonth)} ${normalised.reportYear}. Open the existing report instead.`);
    }
  }

  const batch = writeBatch(db);
  const activityRef = doc(collection(db, "activityLogs"));
  const existing = existingSnapshot.data() || {};
  const hasPublishedSnapshot = Boolean(existing.investorVisible && existing.activePublishedVersionId);
  const reportingPeriodChanged = existingSnapshot.exists()
    && Boolean(existing.reportMonthKey)
    && existing.reportMonthKey !== normalised.reportMonthKey;
  const generatedReportCode = `GV-RPT-${normalised.reportYear}-${String(normalised.reportMonth).padStart(2, "0")}-${normalised.clientCode || documentId.slice(-8)}`;
  const reportCode = reportingPeriodChanged && !hasPublishedSnapshot
    ? generatedReportCode
    : (existing.reportCode || generatedReportCode);
  const version = autosave && existingSnapshot.exists()
    ? Math.max(1, Number(existing.version || 1))
    : Number(existing.version || 0) + 1;
  const renderChanged = existingSnapshot.exists()
    && reportRenderFingerprint(existing) !== reportRenderFingerprint(normalised);
  const templateChanged = existingSnapshot.exists() && reportTemplateChanged(existing, normalised);
  const workingPdfBecameStale = renderChanged
    && Boolean(existing.pdfStoragePath || existing.activePublishedVersionId);
  const reportWrite = {
    ...normalised,
    reportCode,
    version,
    status: hasPublishedSnapshot ? REPORT_STATUS.COMPLETED : normalised.status,
    investorVisible: hasPublishedSnapshot ? true : normalised.investorVisible,
    publicationStatus: hasPublishedSnapshot ? (complete ? "revision_ready" : "revision_draft") : (existing.publicationStatus || "internal"),
    activePublishedVersionId: existing.activePublishedVersionId || null,
    publishedVersion: existing.publishedVersion || 0,
    publishedSourceVersion: existing.publishedSourceVersion || null,
    publishedAt: existing.publishedAt || null,
    pdfStoragePath: renderChanged ? null : (existing.pdfStoragePath || null),
    pdfFileName: renderChanged ? null : (existing.pdfFileName || null),
    pdfSizeBytes: renderChanged ? null : (existing.pdfSizeBytes || null),
    pdfVersion: renderChanged ? null : (existing.pdfVersion || null),
    pdfGeneratedAt: renderChanged ? null : (existing.pdfGeneratedAt || null),
    pdfRendererVersion: renderChanged ? null : (existing.pdfRendererVersion || null),
    pdfIsStale: renderChanged ? workingPdfBecameStale : Boolean(existing.pdfIsStale),
    pdfInvalidatedAt: renderChanged
      ? (workingPdfBecameStale ? serverTimestamp() : null)
      : (existing.pdfInvalidatedAt || null),
    pdfInvalidationReason: renderChanged
      ? (workingPdfBecameStale
        ? (templateChanged ? "report_template_changed" : "report_content_changed")
        : null)
      : (existing.pdfInvalidationReason || null),
    completedAt: complete ? serverTimestamp() : existing.completedAt || null,
    createdAt: existing.createdAt || serverTimestamp(),
    createdByUid: existing.createdByUid || currentUser.id,
    createdByName: existing.createdByName || currentUser.fullName
  };

  batch.set(reportRef, sanitizeForFirestore(reportWrite), { merge: true });
  if (!autosave) {
    batch.set(activityRef, sanitizeForFirestore({
      recordType: "monthly_report",
      recordId: documentId,
      reportId: documentId,
      reportCode,
      investorId: normalised.investorId,
      clientCode: normalised.clientCode,
      leadName: normalised.investorName,
      advisorUid: normalised.advisorUid,
      assignedAdvisorUid: normalised.assignedAdvisorUid,
      action: complete ? "monthly_report_completed" : "monthly_report_saved",
      title: complete ? "Monthly report completed" : "Monthly report draft saved",
      description: `${normalised.title} was ${complete ? "completed" : "saved as a draft"} by ${currentUser.fullName}.`,
      metadata: {
        reportMonthKey: normalised.reportMonthKey,
        version,
        status,
        totalCorpus: normalised.summary.totalCorpus,
        goalCount: normalised.goals.length,
        fundCount: normalised.funds.length
      },
      createdByUid: currentUser.id,
      createdByName: currentUser.fullName,
      createdAt: serverTimestamp()
    }));
  }

  batch.update(doc(db, "investors", normalised.investorId), {
    latestReportId: documentId,
    latestReportMonthKey: normalised.reportMonthKey,
    latestReportStatus: reportWrite.status,
    latestReportedCorpus: normalised.summary.totalCorpus,
    nextReviewDate: normalised.nextReview.date || null,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  if (!autosave) {
    try {
      await syncMonthlyReportActions(documentId);
    } catch (syncError) {
      console.warn("Monthly report saved but action workflow sync could not complete", syncError);
    }
  }
  return { id: documentId, ...reportWrite };
}

export async function setReportInvestorVisibility(reportId, investorVisible, currentUser) {
  const reportRef = doc(db, "monthlyReports", reportId);
  const snapshot = await getDoc(reportRef);
  if (!snapshot.exists()) throw new Error("Monthly report was not found.");
  const report = snapshot.data();
  if (investorVisible && report.status !== REPORT_STATUS.COMPLETED) {
    throw new Error("Complete the monthly report before publishing it to the Investor Portal.");
  }

  const batch = writeBatch(db);
  batch.update(reportRef, {
    investorVisible: Boolean(investorVisible),
    publishedAt: investorVisible ? serverTimestamp() : null,
    publishedByUid: investorVisible ? currentUser.id : null,
    publishedByName: investorVisible ? currentUser.fullName : null,
    updatedAt: serverTimestamp()
  });

  if (investorVisible && report.investorPortalUid) {
    const notificationRef = doc(collection(db, "notifications"));
    batch.set(notificationRef, {
      recipientUid: report.investorPortalUid,
      recipientType: "investor",
      title: "Monthly Wealth Report Available",
      message: `Your GrowVest report for ${getMonthLabel(report.reportMonth)} ${report.reportYear} is ready.`,
      eventType: "monthly_report_published",
      link: `/investor/reports/${reportId}`,
      investorId: report.investorId,
      reportId,
      createdByUid: currentUser.id,
      metadata: { reportCode: report.reportCode || "", reportMonthKey: report.reportMonthKey || "" },
      status: "unread",
      createdAt: serverTimestamp(),
      readAt: null
    });
  }

  const activityRef = doc(collection(db, "activityLogs"));
  batch.set(activityRef, {
    recordType: "monthly_report",
    recordId: reportId,
    reportId,
    investorId: report.investorId,
    advisorUid: report.advisorUid,
    action: investorVisible ? "monthly_report_published" : "monthly_report_unpublished",
    title: investorVisible ? "Monthly report published" : "Monthly report removed from Investor Portal",
    description: `${report.title || "Monthly report"} was ${investorVisible ? "published" : "unpublished"} by ${currentUser.fullName}.`,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

export function subscribeReportVersion(versionId, callback, onError) {
  if (!versionId) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, "reportVersions", versionId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export function subscribeReportAcknowledgement(reportId, recipientUid, callback, onError) {
  if (!reportId || !recipientUid) return () => {};
  const acknowledgementId = `${reportId}_${recipientUid}`;
  return onSnapshot(
    doc(db, "reportAcknowledgements", acknowledgementId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export async function acknowledgePublishedReport(report, currentUser, { requestDiscussion = false, comment = "" } = {}) {
  if (!report?.id || !currentUser?.id) throw new Error("Report and investor profile are required.");
  const acknowledgementId = `${report.id}_${currentUser.id}`;
  const batch = writeBatch(db);
  const acknowledgementRef = doc(db, "reportAcknowledgements", acknowledgementId);
  batch.set(acknowledgementRef, sanitizeForFirestore({
    reportId: report.id,
    reportVersionId: report.versionId || report.activePublishedVersionId || null,
    publishedVersion: report.publishedVersion || null,
    investorId: report.investorId,
    investorUid: currentUser.id,
    investorName: currentUser.fullName || report.investorName || "Investor",
    advisorUid: report.advisorUid || null,
    acknowledged: true,
    acknowledgedAt: serverTimestamp(),
    requestDiscussion: Boolean(requestDiscussion),
    discussionComment: comment || "",
    discussionStatus: requestDiscussion ? "requested" : "not_requested",
    updatedAt: serverTimestamp()
  }), { merge: true });

  if (report.advisorUid) {
    const notificationRef = doc(collection(db, "notifications"));
    batch.set(notificationRef, {
      recipientUid: report.advisorUid,
      recipientType: "advisor",
      title: requestDiscussion ? "Investor requested a report discussion" : "Investor acknowledged monthly report",
      message: requestDiscussion
        ? `${currentUser.fullName || report.investorName || "Investor"} requested a discussion about ${report.title || "the monthly report"}.`
        : `${currentUser.fullName || report.investorName || "Investor"} acknowledged ${report.title || "the monthly report"}.`,
      eventType: requestDiscussion ? "report_discussion_requested" : "report_acknowledged",
      link: `/reports/${report.id}`,
      investorId: report.investorId,
      reportId: report.id,
      createdByUid: currentUser.id,
      status: "unread",
      createdAt: serverTimestamp(),
      readAt: null
    });
  }
  await batch.commit();
}
