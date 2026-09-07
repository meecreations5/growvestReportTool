import { FieldValue } from "firebase-admin/firestore";
import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  verifyAppRequest
} from "@/lib/server/firebaseAdmin";
import {
  buildInsuranceProtectionSnapshot,
  loadInsurancePoliciesForInvestor
} from "@/lib/server/insuranceServer";
import { businessDateKey } from "@/lib/utils/date";
import { normalisePortfolioGoalAllocations } from "@/lib/portfolioGoalAllocation";

export const runtime = "nodejs";

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  }
  return value;
}

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function reportSortValue(item = {}) {
  return String(item.reportMonthKey || item.statementDate || "") || String(timestampMillis(item.publishedAt || item.createdAt));
}

function maskedPanValue(value) {
  const pan = String(value || "").replace(/\s+/g, "").toUpperCase();
  if (!pan) return "";
  if (pan.length < 6) return "••••";
  return `${pan.slice(0, 5)}••••${pan.slice(-1)}`;
}

function publicInvestor(investor = {}) {
  return {
    id: investor.id,
    fullName: investor.fullName || investor.name || "Investor",
    name: investor.name || investor.fullName || "Investor",
    clientCode: investor.clientCode || "",
    email: investor.email || "",
    contactNo: investor.contactNo || investor.mobile || "",
    mobile: investor.mobile || investor.contactNo || "",
    city: investor.city || "",
    investorSince: investor.investorSince || null,
    personalProfile: investor.personalProfile || {},
    riskAssessment: investor.riskAssessment || {},
    riskProfile: investor.riskProfile || "",
    bucketList: Array.isArray(investor.bucketList) ? investor.bucketList : [],
    goals: Array.isArray(investor.goals) ? investor.goals : [],
    advisorName: investor.advisorName || investor.assignedAdvisorName || "",
    assignedAdvisorName: investor.assignedAdvisorName || investor.advisorName || "",
    advisorEmail: investor.advisorEmail || investor.assignedAdvisorEmail || "",
    assignedAdvisorEmail: investor.assignedAdvisorEmail || investor.advisorEmail || "",
    advisorPhone: investor.advisorPhone || investor.assignedAdvisorPhone || "",
    assignedAdvisorPhone: investor.assignedAdvisorPhone || investor.advisorPhone || "",
    advisorDesignation: investor.advisorDesignation || investor.assignedAdvisorDesignation || "",
    assignedAdvisorDesignation: investor.assignedAdvisorDesignation || investor.advisorDesignation || "",
    portalGoogleEmail: investor.portalGoogleEmail || "",
    panMasked: maskedPanValue(investor.panNumber || investor.panNormalized),
    aadhaarConfigured: Boolean(investor.aadhaarConfigured),
    aadhaarLast4: investor.aadhaarLast4 || "",
    advisorPhotoURL: investor.advisorPhotoURL || investor.advisorPhotoUrl || "",
    assignedAdvisorPhotoURL: investor.assignedAdvisorPhotoURL || investor.assignedAdvisorPhotoUrl || "",
    latestPortfolioSnapshotId: investor.latestPortfolioSnapshotId || "",
    latestPortfolioSnapshotDate: investor.latestPortfolioSnapshotDate || "",
    latestPortfolioValue: Number(investor.latestPortfolioValue || 0),
    latestPortfolioInvested: Number(investor.latestPortfolioInvested || 0),
    latestPortfolioGainLoss: Number(investor.latestPortfolioGainLoss || 0),
    latestPortfolioMonthlySip: Number(investor.latestPortfolioMonthlySip || 0),
    latestPortfolioReconciliationStatus: investor.latestPortfolioReconciliationStatus || "",
    latestPortfolioIssueCount: Number(investor.latestPortfolioIssueCount || 0),
    latestPortfolioUpdatedAt: investor.latestPortfolioUpdatedAt || null
  };
}

function activePositions(items = []) {
  return items.filter((item) => !["inactive", "exited", "closed"].includes(String(item.status || "").toLowerCase()));
}

function positionDate(item = {}) {
  return String(item.valuationDate || item.navDate || item.priceDate || item.updatedDate || "");
}


function portfolioAssetLabel(item = {}) {
  const asset = String(item.assetClass || "").trim();
  if (asset) return asset;
  const type = String(item.productType || item.investmentType || "").toLowerCase();
  if (type.includes("stock") || type.includes("equity")) return "Equity";
  if (type.includes("mutual")) return "Mutual Funds";
  if (type.includes("ulip")) return "ULIP";
  if (type.includes("gold") || type.includes("sgb")) return "Gold";
  if (type.includes("bond") || type.includes("debt") || type.includes("fixed") || type.includes("fd")) return "Fixed Income";
  if (type.includes("nps") || type.includes("ppf") || type.includes("retirement")) return "Retirement";
  if (type.includes("real")) return "Real Estate";
  return item.investmentTypeLabel || "Other";
}

function portfolioVisuals(positions = [], snapshots = []) {
  const active = activePositions(positions);
  const allocationMap = new Map();
  active.forEach((item) => {
    const label = portfolioAssetLabel(item);
    allocationMap.set(label, (allocationMap.get(label) || 0) + Number(item.currentValue || 0));
  });
  const assetAllocation = [...allocationMap.entries()]
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const trend = snapshots
    .slice(0, 12)
    .reverse()
    .map((item) => ({
      date: String(item.snapshotDate || ""),
      value: Number(item.summary?.currentValue || 0)
    }))
    .filter((item) => item.date && Number.isFinite(item.value));

  const topHoldings = [...active]
    .sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0))
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      instrumentName: item.instrumentName || item.schemeName || item.stockName || item.fundName || "Investment",
      provider: item.provider || "",
      productType: item.productType || "",
      assetClass: portfolioAssetLabel(item),
      currentValue: Number(item.currentValue || 0),
      totalInvested: Number(item.totalInvested ?? item.investedAmount ?? 0),
      gainLoss: Number(item.gainLoss || 0),
      gainLossPercentage: Number(item.gainLossPercentage || 0),
      valuationDate: positionDate(item)
    }));

  return { assetAllocation, trend, topHoldings };
}

function computePositionSummary(items = []) {
  const positions = activePositions(items);
  const summary = positions.reduce((acc, item) => {
    acc.currentValue += Number(item.currentValue || 0);
    acc.totalInvested += Number(item.totalInvested ?? item.investedAmount ?? 0);
    acc.gainLoss += Number(item.gainLoss ?? (Number(item.currentValue || 0) - Number(item.totalInvested ?? item.investedAmount ?? 0)));
    acc.monthlySip += Number(item.monthlySip || item.monthlyContribution || 0);
    return acc;
  }, { currentValue: 0, totalInvested: 0, gainLoss: 0, monthlySip: 0 });

  const latestValuationDate = positions
    .map(positionDate)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))[0] || "";

  return {
    ...summary,
    currentValue: Number(summary.currentValue.toFixed(2)),
    totalInvested: Number(summary.totalInvested.toFixed(2)),
    gainLoss: Number(summary.gainLoss.toFixed(2)),
    monthlySip: Number(summary.monthlySip.toFixed(2)),
    positionCount: positions.length,
    latestValuationDate
  };
}

function goalTotalsFromPositions(items = []) {
  const totals = new Map();
  activePositions(items).forEach((position) => {
    const allocations = normalisePortfolioGoalAllocations(position.goalAllocations);
    allocations.forEach((allocation) => {
      if (!allocation.goalId) return;
      const percentage = Number(allocation.percentage || 0);
      if (!(percentage > 0)) return;
      const current = totals.get(String(allocation.goalId)) || {
        goalId: String(allocation.goalId),
        goalName: allocation.goalName || "",
        currentValue: 0,
        monthlyContribution: 0
      };
      current.currentValue += Number(position.currentValue || 0) * percentage / 100;
      current.monthlyContribution += Number(position.monthlySip || position.monthlyContribution || 0) * percentage / 100;
      totals.set(String(allocation.goalId), current);
    });
  });
  return [...totals.values()].map((item) => ({
    ...item,
    currentValue: Number(item.currentValue.toFixed(2)),
    monthlyContribution: Number(item.monthlyContribution.toFixed(2))
  }));
}

function goalInvestmentsFromPositions(items = []) {
  const result = [];
  activePositions(items).forEach((position) => {
    const allocations = normalisePortfolioGoalAllocations(position.goalAllocations);
    allocations.forEach((allocation) => {
      const goalId = String(allocation.goalId || "").trim();
      const percentage = Number(allocation.percentage || 0);
      if (!goalId || !(percentage > 0)) return;
      const currentValue = Number(position.currentValue || 0) * percentage / 100;
      const investedValue = Number(position.totalInvested ?? position.investedAmount ?? 0) * percentage / 100;
      const monthlyContribution = Number(position.monthlySip || position.monthlyContribution || 0) * percentage / 100;
      result.push({
        goalId,
        goalName: allocation.goalName || "",
        positionId: position.id,
        instrumentName: position.instrumentName || position.schemeName || position.stockName || "Investment",
        productType: position.productType || "",
        assetClass: position.assetClass || "",
        provider: position.provider || "",
        percentage,
        currentValue: Number(currentValue.toFixed(2)),
        investedValue: Number(investedValue.toFixed(2)),
        monthlyContribution: Number(monthlyContribution.toFixed(2))
      });
    });
  });
  return result.sort((a, b) => b.currentValue - a.currentValue);
}

function mergeGoals(investor = {}, liveGoalTotals = []) {
  const sourceGoals = Array.isArray(investor.bucketList) && investor.bucketList.length
    ? investor.bucketList
    : (Array.isArray(investor.goals) ? investor.goals : []);
  const totals = new Map((liveGoalTotals || []).map((item) => [String(item.goalId || ""), item]));

  return sourceGoals.map((goal) => {
    const goalId = String(goal.id || goal.goalId || "");
    const live = totals.get(goalId);
    if (!live) return goal;
    const currentAmount = Number(live.currentValue || 0);
    const monthlyContribution = Number(live.monthlyContribution || 0);
    const targetAmount = Number(goal.targetAmount || 0);
    return {
      ...goal,
      currentAmount,
      currentValue: currentAmount,
      monthlySip: monthlyContribution,
      monthlyContribution,
      progress: targetAmount > 0 ? currentAmount / targetAmount * 100 : Number(goal.progress || 0)
    };
  });
}

async function loadInvestor(actor) {
  if (actor.role !== "investor" || actor.portalEnabled === false) {
    throw new AppRequestError("Investor App access is required.", 403, "investor_app_required");
  }
  const investorId = String(actor.investorId || "").trim();
  if (!investorId) throw new AppRequestError("This login is not linked to an Investor profile.", 403, "investor_link_missing");
  const snapshot = await adminDb.collection("investors").doc(investorId).get();
  if (!snapshot.exists) throw new AppRequestError("Investor profile was not found.", 404, "investor_missing");
  const investor = { id: snapshot.id, ...snapshot.data() };
  if (investor.isDeleted === true || investor.lifecycleStatus === "deleted") {
    throw new AppRequestError("This Investor profile is no longer active.", 410, "investor_deleted");
  }
  return investor;
}

async function loadPortfolio(investorId) {
  const [positionSnapshot, portfolioSnapshot, ulipSnapshot] = await Promise.all([
    adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioSnapshots").where("investorId", "==", investorId).get(),
    adminDb.collection("ulipPolicies").where("investorId", "==", investorId).get()
  ]);

  const positions = rows(positionSnapshot);
  const ulipPolicies = rows(ulipSnapshot).filter((item) => String(item.status || "").toLowerCase() !== "inactive");
  const snapshots = rows(portfolioSnapshot).sort((a, b) => {
    const dateCompare = String(b.snapshotDate || "").localeCompare(String(a.snapshotDate || ""));
    return dateCompare || timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt);
  });
  const liveSummary = computePositionSummary(positions);
  // Keep dashboard totals identical to the Portfolio screen. ULIP current value
  // comes from its fund positions, while the invested basis comes from policy
  // premiums when available. Protection cover itself is never added to AUM.
  const livePositions = activePositions(positions);
  const regularInvested = livePositions
    .filter((item) => String(item.productType || "") !== "ulip")
    .reduce((sum, item) => sum + Number(item.totalInvested ?? item.investedAmount ?? 0), 0);
  const fallbackUlipPremiumByPolicy = [...new Map(livePositions
    .filter((item) => String(item.productType || "") === "ulip" && item.policyNumber)
    .map((item) => [String(item.policyNumber).toUpperCase(), Number(item.policyTotalPremiumPaid || 0)])).values()]
    .reduce((sum, value) => sum + Number(value || 0), 0);
  const ulipPremiumPaid = ulipPolicies.length
    ? ulipPolicies.reduce((sum, policy) => sum + Number(policy.totalPremiumPaid || 0), 0)
    : fallbackUlipPremiumByPolicy;
  const liveInvested = regularInvested + ulipPremiumPaid;
  const positionGain = livePositions.reduce((sum, item) => {
    if (String(item.productType || "") === "ulip" && item.gainLossAvailable === false) return sum;
    return sum + Number(item.gainLoss ?? (Number(item.currentValue || 0) - Number(item.totalInvested ?? item.investedAmount ?? 0)));
  }, 0);
  const liveGain = liveInvested > 0 ? Number(liveSummary.currentValue || 0) - liveInvested : positionGain;
  const liveGainPartial = false;
  const latestSnapshot = snapshots[0] || null;
  const previousSnapshot = snapshots.find((item, index) => index > 0 && String(item.snapshotDate || "") < String(latestSnapshot?.snapshotDate || "")) || null;
  const latestSnapshotValue = Number(latestSnapshot?.summary?.currentValue || 0);
  const previousSnapshotValue = Number(previousSnapshot?.summary?.currentValue || 0);
  const currentValue = liveSummary.positionCount ? liveSummary.currentValue : latestSnapshotValue;
  const totalInvested = liveSummary.positionCount ? liveInvested : Number(latestSnapshot?.summary?.totalInvested || 0);
  const gainLoss = liveSummary.positionCount ? liveGain : Number(latestSnapshot?.summary?.gainLoss || 0);
  const monthlySip = liveSummary.positionCount ? liveSummary.monthlySip : Number(latestSnapshot?.summary?.monthlySip || 0);
  const movement = previousSnapshot
    ? currentValue - previousSnapshotValue
    : Number(latestSnapshot?.intelligence?.valueChange || 0);
  const movementPercent = previousSnapshotValue > 0 ? (movement / previousSnapshotValue) * 100 : null;
  const asOfDate = liveSummary.latestValuationDate || latestSnapshot?.snapshotDate || "";
  const goalTotals = goalTotalsFromPositions(positions);
  const goalInvestments = goalInvestmentsFromPositions(positions);
  const visuals = portfolioVisuals(positions, snapshots);

  return {
    currentValue: Number(currentValue.toFixed(2)),
    totalInvested: Number(totalInvested.toFixed(2)),
    gainLoss: Number(gainLoss.toFixed(2)),
    monthlySip: Number(monthlySip.toFixed(2)),
    movement: Number(movement.toFixed(2)),
    movementPercent: Number.isFinite(movementPercent) ? Number(movementPercent.toFixed(2)) : null,
    movementLabel: previousSnapshot ? "since previous update" : "latest movement",
    positionCount: liveSummary.positionCount || Number(latestSnapshot?.summary?.positionCount || 0),
    asOfDate,
    snapshotId: latestSnapshot?.id || "",
    snapshotDate: latestSnapshot?.snapshotDate || "",
    previousSnapshotDate: previousSnapshot?.snapshotDate || "",
    reconciliationStatus: latestSnapshot?.reconciliationStatus || "",
    gainLossPartial: liveSummary.positionCount ? liveGainPartial : false,
    goalTotals,
    goalInvestments,
    assetAllocation: visuals.assetAllocation,
    trend: visuals.trend,
    topHoldings: visuals.topHoldings,
    hasPortfolio: Boolean(liveSummary.positionCount || latestSnapshot)
  };
}

async function loadPublishedReports(investorId, count = 60) {
  const snapshot = await adminDb.collection("monthlyReports").where("investorId", "==", investorId).get();
  return rows(snapshot)
    .filter((item) => item.investorVisible === true && item.status === "completed" && item.activePublishedVersionId)
    .sort((a, b) => String(reportSortValue(b)).localeCompare(String(reportSortValue(a))))
    .slice(0, count);
}

async function loadMeetings(investorId) {
  const [meetingSnapshot, momSnapshot] = await Promise.all([
    adminDb.collection("meetings").where("investorId", "==", investorId).get(),
    adminDb.collection("meetingMinutes").where("investorId", "==", investorId).get()
  ]);
  const meetings = rows(meetingSnapshot)
    .filter((item) => item.investorVisible === true)
    .sort((a, b) => timestampMillis(b.startAt) - timestampMillis(a.startAt));
  const moms = rows(momSnapshot)
    .filter((item) => item.investorVisible === true)
    .sort((a, b) => timestampMillis(b.meetingDate || b.createdAt) - timestampMillis(a.meetingDate || a.createdAt));
  return { meetings, moms };
}

async function loadDocuments(investorId) {
  const snapshot = await adminDb.collection("investorDocuments").where("investorId", "==", investorId).get();
  return rows(snapshot)
    .filter((item) => item.investorVisible === true)
    .sort((a, b) => timestampMillis(b.createdAt || b.requestedAt) - timestampMillis(a.createdAt || a.requestedAt))
    .slice(0, 100);
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const investor = await loadInvestor(actor);
    const { searchParams } = new URL(request.url);
    const section = String(searchParams.get("section") || "dashboard").toLowerCase();
    const publicProfile = publicInvestor(investor);
    const storedGoals = Array.isArray(investor.bucketList) && investor.bucketList.length
      ? investor.bucketList
      : (Array.isArray(investor.goals) ? investor.goals : []);

    // Lightweight sections should not pay the cost of reading the full Portfolio
    // Master. This materially reduces first paint latency for utility screens.
    if (section === "security") {
      return Response.json(serialise({ investor: publicProfile }), { headers: { "Cache-Control": "private, no-store" } });
    }

    if (section === "profile") {
      return Response.json(serialise({ investor: publicProfile, goals: storedGoals }), { headers: { "Cache-Control": "private, no-store" } });
    }

    if (section === "documents") {
      const documents = await loadDocuments(investor.id);
      return Response.json(serialise({ investor: publicProfile, documents }), { headers: { "Cache-Control": "private, no-store" } });
    }

    if (section === "meetings") {
      const { meetings, moms } = await loadMeetings(investor.id);
      return Response.json(serialise({ investor: publicProfile, meetings, moms }), { headers: { "Cache-Control": "private, no-store" } });
    }

    if (section === "reports") {
      const reports = await loadPublishedReports(investor.id, 60);
      return Response.json(serialise({ investor: publicProfile, reports }), { headers: { "Cache-Control": "private, no-store" } });
    }

    if (section === "report") {
      const reportId = String(searchParams.get("reportId") || "").trim();
      if (!reportId) throw new AppRequestError("Monthly report is required.", 400, "report_required");
      const reportSnapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
      if (!reportSnapshot.exists) throw new AppRequestError("Monthly report was not found.", 404, "report_missing");
      const reportMeta = { id: reportSnapshot.id, ...reportSnapshot.data() };
      if (String(reportMeta.investorId || "") !== String(investor.id)) {
        throw new AppRequestError("You do not have access to this monthly report.", 403, "report_access_denied");
      }
      if (reportMeta.investorVisible !== true || reportMeta.status !== "completed" || !reportMeta.activePublishedVersionId) {
        throw new AppRequestError("This report has not been published to the Investor App.", 403, "report_not_published");
      }
      const [versionSnapshot, acknowledgementSnapshot, reports] = await Promise.all([
        adminDb.collection("reportVersions").doc(String(reportMeta.activePublishedVersionId)).get(),
        adminDb.collection("reportAcknowledgements").doc(`${reportId}_${actor.uid}`).get(),
        loadPublishedReports(investor.id, 60)
      ]);
      if (!versionSnapshot.exists) throw new AppRequestError("The published report version could not be loaded.", 404, "report_version_missing");
      const publishedVersion = {
        id: versionSnapshot.id,
        ...versionSnapshot.data(),
        reportId,
        versionId: versionSnapshot.id,
        activePublishedVersionId: versionSnapshot.id
      };
      const acknowledgement = acknowledgementSnapshot.exists
        ? { id: acknowledgementSnapshot.id, ...acknowledgementSnapshot.data() }
        : null;
      return Response.json(serialise({ investor: publicProfile, reportMeta, publishedVersion, history: reports, acknowledgement }), { headers: { "Cache-Control": "private, no-store" } });
    }

    const portfolio = await loadPortfolio(investor.id);
    const goals = mergeGoals(investor, portfolio.goalTotals);
    const base = { investor: publicProfile, portfolio, goals };

    if (section === "goals") {
      return Response.json(serialise(base), { headers: { "Cache-Control": "private, no-store" } });
    }

    const [reports, meetingData, policies] = await Promise.all([
      loadPublishedReports(investor.id, 2),
      loadMeetings(investor.id),
      loadInsurancePoliciesForInvestor(investor.id)
    ]);
    const nowMs = Date.now();
    const nextMeeting = meetingData.meetings
      .filter((item) => timestampMillis(item.startAt) >= nowMs && !["cancelled", "completed"].includes(String(item.status || "").toLowerCase()))
      .sort((a, b) => timestampMillis(a.startAt) - timestampMillis(b.startAt))[0] || null;
    const latestMom = meetingData.moms[0] || null;
    const protectionSnapshot = buildInsuranceProtectionSnapshot(policies, businessDateKey());

    return Response.json(serialise({
      ...base,
      reports,
      nextMeeting,
      latestMom,
      protectionSnapshot,
      generatedAt: new Date().toISOString()
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Investor App data failed", error);
    return Response.json(
      { error: error?.message || "Unable to load Investor App data." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    await loadInvestor(actor);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "password_changed") {
      const authEmail = String(body.authEmail || actor.authEmail || "").trim();
      const authMethods = Array.isArray(body.authMethods) ? body.authMethods.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12) : [];
      await adminDb.collection("users").doc(actor.uid).set({
        mustChangePassword: false,
        ...(authEmail ? { authEmail } : {}),
        ...(authMethods.length ? { authMethods } : {}),
        passwordChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return Response.json({ ok: true });
    }

    throw new AppRequestError("Unsupported Investor App action.", 400, "investor_app_action_invalid");
  } catch (error) {
    console.error("Investor App update failed", error);
    return Response.json(
      { error: error?.message || "Unable to update Investor App data." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
