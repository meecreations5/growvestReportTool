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
  return cleanRows(rows, ["instrumentName", "currentValue", "monthlySip"]).map((item, index) => ({
    id: item.id || `fund-${index + 1}`,
    instrumentName: item.instrumentName || "",
    assetClass: item.assetClass || "Other",
    goalId: item.goalId || "",
    goalName: item.goalName || "",
    monthlySip: Number(item.monthlySip || 0),
    currentValue: Number(item.currentValue || 0),
    type: item.type || "Fixed",
    notes: item.notes || ""
  }));
}

function normaliseActions(rows = []) {
  return cleanRows(rows, ["title", "description"]).map((item, index) => ({
    id: item.id || `action-${index + 1}`,
    title: item.title || "",
    description: item.description || item.title || "",
    owner: item.owner || "Advisor",
    priority: item.priority || "Planned",
    dueDate: item.dueDate || "",
    status: item.status || "Pending"
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

function normaliseReportPayload(payload, currentUser, status) {
  const summary = {
    totalCorpus: Number(payload.summary?.totalCorpus || 0),
    lifetimeTarget: Number(payload.summary?.lifetimeTarget || 0),
    overallProgress: Number(payload.summary?.overallProgress || calculatePercentage(payload.summary?.totalCorpus, payload.summary?.lifetimeTarget)),
    monthlySip: Number(payload.summary?.monthlySip || 0),
    newMoneyAdded: Number(payload.summary?.newMoneyAdded || 0),
    investmentGain: Number(payload.summary?.investmentGain || 0)
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
    title: payload.title || `Monthly Portfolio Report — ${getMonthLabel(reportMonth)} ${reportYear}`,
    status,
    investorVisible: Boolean(payload.investorVisible && status === REPORT_STATUS.COMPLETED),
    summary,
    holdings: normaliseHoldings(payload.holdings, summary.totalCorpus),
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
    nextSteps: normaliseActions(payload.nextSteps),
    nextReview: {
      date: payload.nextReview?.date || "",
      note: payload.nextReview?.note || "",
      mode: payload.nextReview?.mode || ""
    },
    disclaimer: payload.disclaimer || "",
    sourceReportId: payload.sourceReportId || null,
    sourceReportMonthKey: payload.sourceReportMonthKey || null,
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

export function subscribeInvestorReports(investorId, callback, onError) {
  let fallbackUnsubscribe = () => {};
  const primaryUnsubscribe = onSnapshot(
    query(
      collection(db, "monthlyReports"),
      where("investorId", "==", investorId),
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
        query(collection(db, "monthlyReports"), where("investorId", "==", investorId)),
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
        query(collection(db, "monthlyReports"), where("investorId", "==", investorId)),
        (snapshot) => callback(sortReportsDescending(rowsFromSnapshot(snapshot).filter((item) => item.investorVisible === true && item.status === REPORT_STATUS.COMPLETED)).slice(0, 36)),
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
    const snapshot = await getDocs(query(collection(db, "monthlyReports"), where("investorId", "==", investorId)));
    return sortReportsDescending(rowsFromSnapshot(snapshot).filter((item) => item.investorVisible === true && item.status === REPORT_STATUS.COMPLETED)).slice(0, limitCount);
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

  if (!reportId && existingSnapshot.exists()) {
    throw new Error(`A report already exists for ${normalised.investorName} for ${getMonthLabel(normalised.reportMonth)} ${normalised.reportYear}.`);
  }

  const batch = writeBatch(db);
  const activityRef = doc(collection(db, "activityLogs"));
  const existing = existingSnapshot.data() || {};
  const reportCode = existing.reportCode || `GV-RPT-${normalised.reportYear}-${String(normalised.reportMonth).padStart(2, "0")}-${normalised.clientCode || documentId.slice(-8)}`;
  const version = autosave && existingSnapshot.exists()
    ? Math.max(1, Number(existing.version || 1))
    : Number(existing.version || 0) + 1;
  const hasPublishedSnapshot = Boolean(existing.investorVisible && existing.activePublishedVersionId);
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
    pdfStoragePath: existing.pdfStoragePath || null,
    pdfFileName: existing.pdfFileName || null,
    pdfSizeBytes: existing.pdfSizeBytes || null,
    pdfVersion: existing.pdfVersion || null,
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
    latestReportStatus: status,
    latestReportedCorpus: normalised.summary.totalCorpus,
    nextReviewDate: normalised.nextReview.date || null,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
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
