import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import {
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  INVESTOR_DECISIONS,
  INVESTOR_REQUEST_TYPES,
  STRUCTURED_WITHDRAWAL_REQUEST_TYPE,
  WITHDRAWAL_MODES,
  WITHDRAWAL_SIP_INSTRUCTIONS,
  actionDefaultTitle,
  actionFinancialImpactStatus,
  actionFinancialImpactType
} from "@/lib/constants/actions";
import { GENERAL_WEALTH_BUCKET_ID, GENERAL_WEALTH_BUCKET_NAME, isGeneralWealthAllocation, normalisePortfolioGoalAllocations } from "@/lib/portfolioGoalAllocation";

export function cleanActionText(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

export function actionActorName(actor = {}) {
  return actor.fullName || actor.displayName || actor.email || (actor.role === "investor" ? "Investor" : "GrowVest User");
}

export function actionAdvisorUid(investor = {}) {
  return investor.assignedAdvisorUid || investor.advisorUid || "";
}

export function actionInvestorPortalUid(investor = {}) {
  return investor.investorPortalUid || investor.portalUid || null;
}

export async function getAccessibleActionInvestor(actor, requestedInvestorId = "") {
  const investorId = actor.role === "investor" ? cleanActionText(actor.investorId, 160) : cleanActionText(requestedInvestorId, 160);
  if (!investorId) throw new Error("Investor is required.");

  const snapshot = await adminDb.collection("investors").doc(investorId).get();
  if (!snapshot.exists) throw new Error("Investor profile was not found.");
  const investor = { id: snapshot.id, ...snapshot.data() };

  if (actor.role === "investor") {
    if (actor.portalEnabled === false || actor.investorId !== investorId) throw new Error("You are not authorised to create requests for this investor.");
    return investor;
  }

  if (["super_admin", "admin"].includes(actor.role)) return investor;
  const advisorUid = actionAdvisorUid(investor);
  if (actor.role === "advisor" && advisorUid === actor.uid) return investor;
  throw new Error("You are not authorised to manage actions for this investor.");
}

export async function validateStructuredWithdrawalPayload(payload = {}, investor = {}) {
  if (String(payload.requestType || "") !== STRUCTURED_WITHDRAWAL_REQUEST_TYPE) return payload;

  const requestedItems = Array.isArray(payload.withdrawalItems) ? payload.withdrawalItems : [];
  if (!requestedItems.length) throw new Error("Select at least one Mutual Fund for the withdrawal request.");

  const bucketId = cleanActionText(payload.withdrawalBucketId || payload.relatedGoalId || GENERAL_WEALTH_BUCKET_ID, 180) || GENERAL_WEALTH_BUCKET_ID;
  const bucketName = cleanActionText(payload.withdrawalBucketName || payload.relatedGoalName || (bucketId === GENERAL_WEALTH_BUCKET_ID ? GENERAL_WEALTH_BUCKET_NAME : "Bucket List"), 240);
  const positionSnapshots = await adminDb.collection("portfolioPositions").where("investorId", "==", investor.id).get();
  const positions = new Map(positionSnapshots.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
  const seen = new Set();
  const normalisedItems = requestedItems.map((item, index) => {
    const positionId = cleanActionText(item.positionId || item.id, 180);
    if (!positionId || seen.has(positionId)) throw new Error(`Withdrawal fund ${index + 1} is invalid or duplicated.`);
    seen.add(positionId);
    const position = positions.get(positionId);
    if (!position || ["inactive", "exited"].includes(String(position.status || "").toLowerCase())) throw new Error(`The selected fund for withdrawal is no longer active in Portfolio Master.`);
    if (String(position.productType || "") !== "mutual_fund") throw new Error("Structured fund withdrawals currently support Mutual Fund holdings only. Use Trading Account Withdrawal for broker cash withdrawals.");

    const allocations = normalisePortfolioGoalAllocations(position.goalAllocations);
    const bucketAllocation = bucketId === GENERAL_WEALTH_BUCKET_ID
      ? allocations.find((allocation) => isGeneralWealthAllocation(allocation) && Number(allocation.percentage || 0) > 0)
      : allocations.find((allocation) => String(allocation.goalId || "") === bucketId && Number(allocation.percentage || 0) > 0);
    if (!bucketAllocation) throw new Error(`${position.instrumentName || position.schemeName || "Selected fund"} is not mapped to ${bucketName || "the selected Bucket List"}.`);
    const bucketPercentageAtRequest = Math.max(0, Number(bucketAllocation.percentage || 0));

    const withdrawalMode = WITHDRAWAL_MODES.includes(String(item.withdrawalMode || "").toLowerCase()) ? String(item.withdrawalMode).toLowerCase() : "partial";
    const sipInstruction = WITHDRAWAL_SIP_INSTRUCTIONS.includes(String(item.sipInstruction || "").toLowerCase()) ? String(item.sipInstruction).toLowerCase() : "continue";
    const currentValue = Math.max(0, Number(position.currentValue || 0));
    const currentUnits = Math.max(0, Number(position.totalUnits ?? position.quantity ?? position.units ?? 0));
    const bucketValueAtRequest = currentValue * bucketPercentageAtRequest / 100;
    const bucketUnitsAtRequest = currentUnits * bucketPercentageAtRequest / 100;
    const requestedAmount = withdrawalMode === "full" ? currentValue : Math.max(0, Number(item.requestedAmount || 0));
    const requestedUnits = Math.max(0, Number(item.requestedUnits || 0));
    if (withdrawalMode === "full" && bucketPercentageAtRequest < 99.999) {
      throw new Error(`Complete withdrawal of ${position.instrumentName || position.schemeName || "the selected fund"} is available only when the holding is 100% mapped to ${bucketName}. Use a partial withdrawal for this Bucket List or remap the holding first.`);
    }
    if (withdrawalMode === "partial" && !(requestedAmount > 0 || requestedUnits > 0)) throw new Error(`Enter an amount or units for ${position.instrumentName || position.schemeName || "the selected fund"}.`);
    if (withdrawalMode === "partial" && bucketValueAtRequest > 0 && requestedAmount > bucketValueAtRequest + Math.max(1, bucketValueAtRequest * 0.01)) throw new Error(`Requested amount for ${position.instrumentName || position.schemeName || "the selected fund"} exceeds the value mapped to ${bucketName}.`);
    if (withdrawalMode === "partial" && currentUnits > 0 && requestedUnits > bucketUnitsAtRequest + 0.0001) throw new Error(`Requested units for ${position.instrumentName || position.schemeName || "the selected fund"} exceed the units mapped to ${bucketName}.`);

    return {
      positionId,
      instrumentName: cleanActionText(position.instrumentName || position.schemeName || position.fundName || "Mutual Fund", 240),
      schemeName: cleanActionText(position.schemeName || position.instrumentName || "", 240),
      folioNo: cleanActionText(position.folioNo, 120),
      isin: cleanActionText(position.isin, 120),
      provider: cleanActionText(position.provider || position.source, 120),
      withdrawalMode,
      requestedAmount: Number(requestedAmount.toFixed(2)),
      requestedUnits: Number(requestedUnits.toFixed(6)),
      sipInstruction,
      currentValueAtRequest: Number(currentValue.toFixed(2)),
      bucketPercentageAtRequest: Number(bucketPercentageAtRequest.toFixed(4)),
      bucketValueAtRequest: Number(bucketValueAtRequest.toFixed(2)),
      bucketUnitsAtRequest: Number(bucketUnitsAtRequest.toFixed(6)),
      currentUnitsAtRequest: Number(currentUnits.toFixed(6)),
      monthlySipAtRequest: Number(position.monthlySip || 0),
      goalAllocations: allocations
    };
  });

  const requestedAmount = normalisedItems.reduce((sum, item) => sum + Number(item.requestedAmount || 0), 0);
  return {
    ...payload,
    withdrawalBucketId: bucketId,
    withdrawalBucketName: bucketName || (bucketId === GENERAL_WEALTH_BUCKET_ID ? GENERAL_WEALTH_BUCKET_NAME : "Bucket List"),
    relatedGoalId: bucketId === GENERAL_WEALTH_BUCKET_ID ? "" : bucketId,
    relatedGoalName: bucketId === GENERAL_WEALTH_BUCKET_ID ? GENERAL_WEALTH_BUCKET_NAME : bucketName,
    relatedInvestmentId: normalisedItems.length === 1 ? normalisedItems[0].positionId : "",
    relatedInvestmentName: normalisedItems.length === 1 ? normalisedItems[0].instrumentName : `${normalisedItems.length} Mutual Funds`,
    requestedAmount: Number(requestedAmount.toFixed(2)),
    withdrawalItems: normalisedItems
  };
}

export function normaliseCreateAction(payload = {}, actor = {}, investor = {}) {
  const actorIsInvestor = actor.role === "investor";
  const requestType = INVESTOR_REQUEST_TYPES.includes(payload.requestType)
    ? payload.requestType
    : cleanActionText(payload.requestType, 120) || "Other / Custom";
  const relatedInvestmentName = cleanActionText(payload.relatedInvestmentName, 240);
  const relatedGoalName = cleanActionText(payload.relatedGoalName, 240);
  const contextName = relatedInvestmentName || relatedGoalName;
  const title = cleanActionText(payload.title, 240) || actionDefaultTitle(requestType, contextName);
  const status = actorIsInvestor
    ? "Requested"
    : (ACTION_STATUSES.includes(payload.status) ? payload.status : "Recommended");
  const priority = ACTION_PRIORITIES.includes(payload.priority) ? payload.priority : "Planned";
  const owner = ["Advisor", "Investor", "GrowVest", "Joint"].includes(payload.owner) ? payload.owner : (actorIsInvestor ? "Advisor" : "Advisor");
  const investorDecision = INVESTOR_DECISIONS.includes(payload.investorDecision) ? payload.investorDecision : "Pending Discussion";
  const advisorUid = actionAdvisorUid(investor);
  const investorPortalUid = actionInvestorPortalUid(investor);
  const now = FieldValue.serverTimestamp();
  const financialImpactType = actionFinancialImpactType(requestType);
  const financialImpactStatus = actionFinancialImpactStatus(status, financialImpactType);

  return {
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    clientCode: investor.clientCode || "",
    investorPortalUid,
    advisorUid,
    assignedAdvisorUid: advisorUid,
    requestType,
    recommendationType: cleanActionText(payload.recommendationType, 120) || requestType,
    title,
    description: cleanActionText(payload.description, 3000),
    status,
    priority,
    owner,
    investorDecision,
    dueDate: cleanActionText(payload.dueDate, 20),
    completionDate: cleanActionText(payload.completionDate, 20),
    relatedGoalId: cleanActionText(payload.relatedGoalId, 180),
    relatedGoalName,
    relatedInvestmentId: cleanActionText(payload.relatedInvestmentId, 180),
    relatedInvestmentName,
    requestedAmount: Number(payload.requestedAmount || 0),
    requestedMonthlyAmount: Number(payload.requestedMonthlyAmount || 0),
    requestedUnits: Number(payload.requestedUnits || 0),
    requestedEffectiveDate: cleanActionText(payload.requestedEffectiveDate, 20),
    requestedTargetGoalId: cleanActionText(payload.requestedTargetGoalId, 180),
    requestedTargetGoalName: cleanActionText(payload.requestedTargetGoalName, 240),
    requestedAccountReference: cleanActionText(payload.requestedAccountReference, 240),
    requestedChangeDetails: cleanActionText(payload.requestedChangeDetails, 3000),
    withdrawalPurpose: cleanActionText(payload.withdrawalPurpose || payload.requestedChangeDetails, 1000),
    withdrawalBucketId: cleanActionText(payload.withdrawalBucketId, 180),
    withdrawalBucketName: cleanActionText(payload.withdrawalBucketName, 240),
    withdrawalItems: Array.isArray(payload.withdrawalItems) ? payload.withdrawalItems : [],
    withdrawalPortfolioApplied: false,
    withdrawalCompletion: null,
    financialImpactType,
    financialImpactStatus,
    portfolioConfirmedAt: null,
    portfolioConfirmedTransactionId: "",
    financialConfirmationMode: "",
    actualFinancialAmount: 0,
    actualFinancialDate: "",
    actualFinancialReference: "",
    sourceType: actorIsInvestor ? "investor_request" : (cleanActionText(payload.sourceType, 80) || "advisor_manual"),
    sourceReportId: cleanActionText(payload.sourceReportId, 180),
    sourceReportMonthKey: cleanActionText(payload.sourceReportMonthKey, 20),
    sourceMeetingId: cleanActionText(payload.sourceMeetingId, 180),
    investorVisible: actorIsInvestor ? true : payload.investorVisible !== false,
    requestedByUid: actor.uid,
    requestedByRole: actor.role,
    requestedByName: actionActorName(actor),
    requestedAt: now,
    createdByUid: actor.uid,
    createdByName: actionActorName(actor),
    createdAt: now,
    updatedByUid: actor.uid,
    updatedByName: actionActorName(actor),
    updatedAt: now
  };
}

export function actionCode(actionId = "") {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()).replaceAll("-", "");
  const suffix = String(actionId || "ACTION").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  return `GV-ACT-${day}-${suffix || "ACTION"}`;
}

export function actionEventPayload({ actionId, action = {}, actor = {}, eventType, note = "", fromStatus = "", toStatus = "", investorVisible = true }) {
  return {
    actionId,
    investorId: action.investorId || "",
    investorName: action.investorName || "",
    advisorUid: action.advisorUid || action.assignedAdvisorUid || "",
    investorPortalUid: action.investorPortalUid || null,
    eventType,
    note: cleanActionText(note, 3000),
    fromStatus: cleanActionText(fromStatus, 80),
    toStatus: cleanActionText(toStatus, 80),
    investorVisible: Boolean(investorVisible),
    createdByUid: actor.uid || "system",
    createdByRole: actor.role || "system",
    createdByName: actionActorName(actor),
    createdAt: FieldValue.serverTimestamp()
  };
}

export function actionNotification({ recipientUid, recipientType, title, message, actionId, action = {}, actor = {} }) {
  if (!recipientUid) return null;
  return {
    recipientUid,
    recipientType,
    title: cleanActionText(title, 220),
    message: cleanActionText(message, 1200),
    eventType: "investor_action_updated",
    link: recipientType === "investor" ? "/investor/actions" : "/actions",
    investorId: action.investorId || "",
    actionId,
    createdByUid: actor.uid || "system",
    status: "unread",
    createdAt: FieldValue.serverTimestamp(),
    readAt: null
  };
}
