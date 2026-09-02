import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAppRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { ACTION_FINANCIAL_IMPACT_STATUSES, ACTION_PRIORITIES, ACTION_STATUSES, INVESTOR_DECISIONS, isStructuredWithdrawalAction, actionFinancialImpactStatus, actionFinancialImpactType } from "@/lib/constants/actions";
import { actionActorName, actionEventPayload, actionNotification, cleanActionText } from "@/lib/server/actionServer";

export const runtime = "nodejs";

function canStaffManage(actor, action = {}) {
  if (["super_admin", "admin"].includes(actor.role)) return true;
  return actor.role === "advisor" && [action.advisorUid, action.assignedAdvisorUid].includes(actor.uid);
}

function decisionStatus(decision, currentStatus) {
  if (["Completed", "Cancelled"].includes(currentStatus)) return currentStatus;
  if (decision === "Approved") return "Approved";
  if (decision === "Rejected") return "Rejected";
  if (decision === "Deferred") return "Deferred";
  return currentStatus;
}

export async function PATCH(request, { params }) {
  try {
    const actor = await verifyAppRequest(request);
    const { actionId } = await params;
    const payload = await request.json().catch(() => ({}));
    const ref = adminDb.collection("investorActions").doc(actionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return Response.json({ error: "Action request was not found." }, { status: 404 });
    const current = { id: snapshot.id, ...snapshot.data() };
    const investorOwns = actor.role === "investor" && actor.investorId && actor.investorId === current.investorId && current.investorVisible !== false;
    const staffCanManage = canStaffManage(actor, current);
    if (!investorOwns && !staffCanManage) return Response.json({ error: "You are not authorised to update this action." }, { status: 403 });

    const updates = {
      updatedByUid: actor.uid,
      updatedByName: actionActorName(actor),
      updatedAt: FieldValue.serverTimestamp()
    };
    let note = cleanActionText(payload.note || payload.comment || payload.advisorResponse || payload.investorComment, 3000);

    if (investorOwns) {
      if (payload.investorDecision && INVESTOR_DECISIONS.includes(payload.investorDecision)) {
        updates.investorDecision = payload.investorDecision;
        updates.status = decisionStatus(payload.investorDecision, current.status);
      }
      if (payload.requestDiscussion === true && !["Completed", "Rejected", "Cancelled"].includes(current.status)) {
        updates.status = "Discussion Required";
      }
      if (note) updates.investorComment = note;
      updates.lastInvestorResponseAt = FieldValue.serverTimestamp();
      updates.lastInvestorResponseByUid = actor.uid;
    } else {
      if (payload.status === "Completed" && isStructuredWithdrawalAction(current) && current.withdrawalPortfolioApplied !== true) {
        throw new Error("Use Complete Withdrawal & Update Portfolio so the fund holdings and SIP instructions are applied together.");
      }
      if (payload.status && ACTION_STATUSES.includes(payload.status)) updates.status = payload.status;
      if (payload.priority && ACTION_PRIORITIES.includes(payload.priority)) updates.priority = payload.priority;
      if (payload.investorDecision && INVESTOR_DECISIONS.includes(payload.investorDecision)) updates.investorDecision = payload.investorDecision;
      if (payload.owner && ["Advisor", "Investor", "GrowVest", "Joint"].includes(payload.owner)) updates.owner = payload.owner;
      if (payload.title !== undefined) updates.title = cleanActionText(payload.title, 240) || current.title;
      if (payload.description !== undefined) updates.description = cleanActionText(payload.description, 3000);
      if (payload.dueDate !== undefined) updates.dueDate = cleanActionText(payload.dueDate, 20);
      if (payload.completionDate !== undefined) updates.completionDate = cleanActionText(payload.completionDate, 20);
      if (payload.advisorResponse !== undefined) updates.advisorResponse = cleanActionText(payload.advisorResponse, 3000);
      if (payload.investorVisible !== undefined) updates.investorVisible = Boolean(payload.investorVisible);
      if ((updates.status || current.status) === "Completed" && !updates.completionDate && !current.completionDate) {
        updates.completionDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      }
    }

    const nextStatus = updates.status || current.status || "Requested";
    const financialImpactType = current.financialImpactType || actionFinancialImpactType(current.requestType || current.recommendationType);
    updates.financialImpactType = financialImpactType;
    updates.financialImpactStatus = actionFinancialImpactStatus(nextStatus, financialImpactType, current.financialImpactStatus || "");

    // Financial actions are operationally complete only after staff confirm that
    // the provider/Portfolio Master has reflected the actual change. Report cash
    // flows still come from confirmed Portfolio Master transactions, never from
    // this workflow flag.
    if (!investorOwns && payload.confirmPortfolioImpact === true) {
      if (nextStatus !== "Completed") throw new Error("Mark the action Completed before confirming it in Portfolio Master.");
      if (!financialImpactType || financialImpactType === "none") throw new Error("This action does not require portfolio financial confirmation.");
      const investorSnapshot = await adminDb.collection("investors").doc(current.investorId).get();
      const investor = investorSnapshot.exists ? investorSnapshot.data() : {};
      const latestPortfolioSnapshotId = cleanActionText(investor?.latestPortfolioSnapshotId, 180);
      if (!latestPortfolioSnapshotId) throw new Error("No verified Portfolio Master snapshot is available for this investor yet.");
      const latestPortfolioSnapshot = await adminDb.collection("portfolioSnapshots").doc(latestPortfolioSnapshotId).get();
      const latestSnapshotDate = latestPortfolioSnapshot.exists ? cleanActionText(latestPortfolioSnapshot.data()?.snapshotDate, 20) : "";
      const externalImpact = ["external_inflow", "external_outflow"].includes(financialImpactType);
      const confirmationMode = externalImpact
        ? (payload.financialConfirmationMode === "manual_cash_movement" ? "manual_cash_movement" : "provider_transaction")
        : "provider_state";
      updates.financialConfirmationMode = confirmationMode;

      if (confirmationMode === "manual_cash_movement") {
        const actualFinancialAmount = Math.abs(Number(payload.actualFinancialAmount || current.requestedAmount || 0));
        const actualFinancialDate = cleanActionText(payload.actualFinancialDate || current.completionDate, 20);
        if (!(actualFinancialAmount > 0)) throw new Error("Enter the actual external cash movement amount before confirming it.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(actualFinancialDate)) throw new Error("Enter the actual external cash movement date before confirming it.");
        if (latestSnapshotDate && actualFinancialDate > latestSnapshotDate) {
          throw new Error(`The latest verified Portfolio Master is dated ${latestSnapshotDate}. Refresh the portfolio after the ${actualFinancialDate} cash movement before confirming it.`);
        }
        updates.actualFinancialAmount = Number(actualFinancialAmount.toFixed(2));
        updates.actualFinancialDate = actualFinancialDate;
        updates.actualFinancialReference = cleanActionText(payload.actualFinancialReference, 240);
      } else {
        updates.actualFinancialAmount = 0;
        updates.actualFinancialDate = "";
        updates.actualFinancialReference = "";
      }

      updates.financialImpactStatus = ACTION_FINANCIAL_IMPACT_STATUSES.CONFIRMED;
      updates.portfolioConfirmedAt = FieldValue.serverTimestamp();
      updates.portfolioConfirmedSnapshotId = latestPortfolioSnapshotId;
      updates.portfolioConfirmationNote = cleanActionText(payload.portfolioConfirmationNote, 1000);
      note = updates.portfolioConfirmationNote || note || "Confirmed as reflected in Portfolio Master.";
    }
    const nextInvestorVisible = updates.investorVisible !== undefined
      ? Boolean(updates.investorVisible)
      : current.investorVisible !== false;
    const visibilityEvents = updates.investorVisible !== undefined
      ? await adminDb.collection("investorActionEvents").where("actionId", "==", actionId).get()
      : null;
    const batch = adminDb.batch();
    batch.update(ref, updates);
    visibilityEvents?.docs.forEach((item) => {
      batch.set(item.ref, { investorVisible: nextInvestorVisible }, { merge: true });
    });
    batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
      actionId,
      action: { ...current, ...updates },
      actor,
      eventType: investorOwns ? "investor_response" : payload.confirmPortfolioImpact === true ? "portfolio_confirmation" : "advisor_update",
      note,
      fromStatus: current.status || "",
      toStatus: nextStatus,
      // Never expose a workflow event when the parent action is internal.
      investorVisible: nextInvestorVisible
    }));

    const statusChanged = nextStatus !== current.status;
    const decisionChanged = updates.investorDecision && updates.investorDecision !== current.investorDecision;
    if (investorOwns && current.advisorUid && (statusChanged || decisionChanged || note)) {
      const notification = actionNotification({
        recipientUid: current.advisorUid,
        recipientType: "advisor",
        title: "Investor updated an action",
        message: `${current.investorName || "Investor"}: ${current.title}`,
        actionId,
        action: current,
        actor
      });
      if (notification) batch.set(adminDb.collection("notifications").doc(), notification);
    } else if (staffCanManage && current.investorPortalUid && nextInvestorVisible && (statusChanged || decisionChanged || note || updates.advisorResponse)) {
      const notification = actionNotification({
        recipientUid: current.investorPortalUid,
        recipientType: "investor",
        title: statusChanged ? `Action ${nextStatus}` : "Advisor updated your action",
        message: current.title,
        actionId,
        action: current,
        actor
      });
      if (notification) batch.set(adminDb.collection("notifications").doc(), notification);
    }

    batch.set(adminDb.collection("activityLogs").doc(), {
      recordType: "investor_action",
      recordId: actionId,
      investorId: current.investorId,
      advisorUid: current.advisorUid || "",
      action: investorOwns ? "investor_action_response" : "investor_action_updated",
      title: current.title || "Investor action updated",
      description: `${actionActorName(actor)} updated the action${statusChanged ? ` to ${nextStatus}` : ""}.`,
      metadata: { fromStatus: current.status || "", toStatus: nextStatus, investorDecision: updates.investorDecision || current.investorDecision || "" },
      createdByUid: actor.uid,
      createdByName: actionActorName(actor),
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();
    return Response.json({ success: true, actionId, status: nextStatus });
  } catch (error) {
    console.error("Investor action update failed", error);
    return Response.json({ error: error?.message || "Unable to update the action." }, { status: appRequestErrorStatus(error, 500) });
  }
}
