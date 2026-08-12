import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import {
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  INVESTOR_DECISIONS,
  INVESTOR_REQUEST_TYPES,
  actionDefaultTitle
} from "@/lib/constants/actions";

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
