import { FieldValue } from "firebase-admin/firestore";
import { AppRequestError, adminDb, verifyAppRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  actionCode,
  actionEventPayload,
  actionNotification,
  getAccessibleActionInvestor,
  normaliseCreateAction,
  validateStructuredWithdrawalPayload
} from "@/lib/server/actionServer";

export const runtime = "nodejs";


function actionTimestamp(value) {
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
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  return value;
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const { searchParams } = new URL(request.url);
    const requestedInvestorId = String(searchParams.get("investorId") || "").trim();
    const investor = await getAccessibleActionInvestor(actor, requestedInvestorId);
    const snapshot = await adminDb.collection("investorActions").where("investorId", "==", investor.id).get();
    const actions = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => actor.role !== "investor" || item.investorVisible !== false)
      .filter((item) => actor.role !== "advisor" || [item.advisorUid, item.assignedAdvisorUid].includes(actor.uid))
      .sort((a, b) => actionTimestamp(b.updatedAt || b.createdAt) - actionTimestamp(a.updatedAt || a.createdAt))
      .slice(0, 200);
    return Response.json(serialise({ actions }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Investor action read failed", error);
    const status = error instanceof AppRequestError ? error.status : appRequestErrorStatus(error, 500);
    return Response.json({ error: error?.message || "Unable to load action requests." }, { status });
  }
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    const payload = await request.json().catch(() => ({}));
    const investor = await getAccessibleActionInvestor(actor, payload.investorId);
    const actionRef = adminDb.collection("investorActions").doc();
    const validatedPayload = await validateStructuredWithdrawalPayload(payload, investor);
    const action = normaliseCreateAction(validatedPayload, actor, investor);
    const batch = adminDb.batch();

    batch.set(actionRef, { ...action, actionCode: actionCode(actionRef.id) });
    batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
      actionId: actionRef.id,
      action,
      actor,
      eventType: actor.role === "investor" ? "investor_request_created" : "advisor_action_created",
      note: action.description || action.title,
      toStatus: action.status,
      investorVisible: true
    }));

    if (actor.role === "investor" && action.advisorUid) {
      const notification = actionNotification({
        recipientUid: action.advisorUid,
        recipientType: "advisor",
        title: "New investor action request",
        message: `${action.investorName} requested: ${action.title}`,
        actionId: actionRef.id,
        action,
        actor
      });
      if (notification) batch.set(adminDb.collection("notifications").doc(), notification);
    } else if (actor.role !== "investor" && action.investorPortalUid && action.investorVisible) {
      const notification = actionNotification({
        recipientUid: action.investorPortalUid,
        recipientType: "investor",
        title: "New action from your Advisor",
        message: action.title,
        actionId: actionRef.id,
        action,
        actor
      });
      if (notification) batch.set(adminDb.collection("notifications").doc(), notification);
    }

    batch.set(adminDb.collection("activityLogs").doc(), {
      recordType: "investor_action",
      recordId: actionRef.id,
      investorId: action.investorId,
      advisorUid: action.advisorUid,
      action: actor.role === "investor" ? "investor_action_requested" : "investor_action_created",
      title: action.title,
      description: `${actionActorLabel(actor)} created an investor action request.`,
      metadata: { status: action.status, priority: action.priority, sourceType: action.sourceType },
      createdByUid: actor.uid,
      createdByName: action.requestedByName,
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();
    return Response.json({ success: true, action: { id: actionRef.id, ...action, actionCode: actionCode(actionRef.id) } });
  } catch (error) {
    console.error("Investor action creation failed", error);
    return Response.json({ error: error?.message || "Unable to create the action request." }, { status: appRequestErrorStatus(error, 500) });
  }
}

function actionActorLabel(actor = {}) {
  return actor.role === "investor" ? "Investor" : "GrowVest staff";
}
