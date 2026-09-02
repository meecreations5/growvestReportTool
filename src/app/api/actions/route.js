import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAppRequest,
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
