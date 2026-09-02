import { FieldValue } from "firebase-admin/firestore";
import { adminDb, canStaffAccessRecord, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { ACTION_STATUSES, INVESTOR_DECISIONS, actionFinancialImpactStatus, actionFinancialImpactType } from "@/lib/constants/actions";
import { actionCode, actionEventPayload, actionNotification, actionActorName, cleanActionText } from "@/lib/server/actionServer";

export const runtime = "nodejs";

function safeActionId(value = "") {
  return String(value || "action").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120) || "action";
}

async function resolveActionRef(reportId, item, index) {
  const sourceId = cleanActionText(item?.sourceActionId, 180);
  if (sourceId) {
    const sourceRef = adminDb.collection("investorActions").doc(sourceId);
    const sourceSnapshot = await sourceRef.get();
    if (sourceSnapshot.exists) return { ref: sourceRef, snapshot: sourceSnapshot };
  }
  const ref = adminDb.collection("investorActions").doc(`${safeActionId(reportId)}_${safeActionId(item?.id || index)}`);
  return { ref, snapshot: await ref.get() };
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const payload = await request.json().catch(() => ({}));
    const reportId = cleanActionText(payload.reportId, 180);
    if (!reportId) return Response.json({ error: "Monthly report is required." }, { status: 400 });
    const reportSnapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
    if (!reportSnapshot.exists) return Response.json({ error: "Monthly report was not found." }, { status: 404 });
    const report = { id: reportSnapshot.id, ...reportSnapshot.data() };
    if (!canStaffAccessRecord(actor, report)) return Response.json({ error: "You are not authorised to sync actions for this report." }, { status: 403 });

    const nextSteps = Array.isArray(report.nextSteps) ? report.nextSteps : [];
    if (!nextSteps.length) return Response.json({ success: true, synced: 0 });
    const batch = adminDb.batch();
    const nextStepsWithIds = [];
    let createdCount = 0;

    for (let index = 0; index < nextSteps.length; index += 1) {
      const item = nextSteps[index] || {};
      if (!cleanActionText(item.title || item.description, 240)) {
        nextStepsWithIds.push(item);
        continue;
      }
      const { ref, snapshot } = await resolveActionRef(reportId, item, index);
      const existing = snapshot.exists ? snapshot.data() : null;
      if (existing && existing.investorId && existing.investorId !== report.investorId) {
        nextStepsWithIds.push(item);
        continue;
      }

      const incomingStatus = ACTION_STATUSES.includes(item.status) ? item.status : "Recommended";
      const incomingDecision = INVESTOR_DECISIONS.includes(item.investorDecision) ? item.investorDecision : "Pending Discussion";
      const advisorUid = report.assignedAdvisorUid || report.advisorUid || actor.uid;
      const requestType = cleanActionText(item.requestType || item.recommendationType, 120) || "Portfolio Review";
      const financialImpactType = actionFinancialImpactType(requestType);
      const base = {
        investorId: report.investorId,
        investorName: report.investorName || "Investor",
        clientCode: report.clientCode || "",
        investorPortalUid: report.investorPortalUid || null,
        advisorUid,
        assignedAdvisorUid: advisorUid,
        requestType,
        recommendationType: cleanActionText(item.recommendationType, 120) || requestType,
        title: cleanActionText(item.title || item.description, 240),
        description: cleanActionText(item.description, 3000),
        priority: cleanActionText(item.priority, 80) || "Planned",
        owner: cleanActionText(item.owner, 80) || "Advisor",
        dueDate: cleanActionText(item.dueDate, 20),
        relatedGoalId: cleanActionText(item.relatedGoalId, 180),
        relatedInvestmentId: cleanActionText(item.relatedInvestmentId, 180),
        requestedAmount: Number(item.requestedAmount || 0),
        requestedMonthlyAmount: Number(item.requestedMonthlyAmount || 0),
        requestedUnits: Number(item.requestedUnits || 0),
        requestedEffectiveDate: cleanActionText(item.requestedEffectiveDate, 20),
        requestedTargetGoalId: cleanActionText(item.requestedTargetGoalId, 180),
        requestedTargetGoalName: cleanActionText(item.requestedTargetGoalName, 240),
        requestedAccountReference: cleanActionText(item.requestedAccountReference, 240),
        financialImpactType,
        financialImpactStatus: existing?.financialImpactStatus || actionFinancialImpactStatus(incomingStatus, financialImpactType),
        sourceType: existing?.sourceType || "monthly_report",
        sourceReportId: existing?.sourceReportId || reportId,
        sourceReportMonthKey: existing?.sourceReportMonthKey || report.reportMonthKey || "",
        lastReportId: reportId,
        lastReportMonthKey: report.reportMonthKey || "",
        investorVisible: existing ? existing.investorVisible !== false : Boolean(report.investorVisible === true && report.status === "completed"),
        updatedByUid: actor.uid,
        updatedByName: actionActorName(actor),
        updatedAt: FieldValue.serverTimestamp(),
        reportHistory: FieldValue.arrayUnion(reportId)
      };

      if (existing) {
        batch.set(ref, base, { merge: true });
      } else {
        createdCount += 1;
        batch.set(ref, {
          ...base,
          actionCode: actionCode(ref.id),
          status: incomingStatus,
          investorDecision: incomingDecision,
          completionDate: cleanActionText(item.completionDate, 20),
          requestedByUid: actor.uid,
          requestedByRole: actor.role,
          requestedByName: actionActorName(actor),
          requestedAt: FieldValue.serverTimestamp(),
          createdByUid: actor.uid,
          createdByName: actionActorName(actor),
          createdAt: FieldValue.serverTimestamp()
        });
        batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
          actionId: ref.id,
          action: { ...base, status: incomingStatus },
          actor,
          eventType: "monthly_report_recommendation_created",
          note: base.description || base.title,
          toStatus: incomingStatus,
          investorVisible: base.investorVisible
        }));
        if (report.investorPortalUid && report.investorVisible === true && report.status === "completed") {
          const notification = actionNotification({
            recipientUid: report.investorPortalUid,
            recipientType: "investor",
            title: "New action in your monthly report",
            message: base.title,
            actionId: ref.id,
            action: base,
            actor
          });
          if (notification) batch.set(adminDb.collection("notifications").doc(), notification);
        }
      }

      nextStepsWithIds.push({
        ...item,
        sourceActionId: ref.id
      });
    }

    batch.update(reportSnapshot.ref, {
      nextSteps: nextStepsWithIds,
      actionsSyncedAt: FieldValue.serverTimestamp(),
      actionsSyncedByUid: actor.uid
    });
    await batch.commit();
    return Response.json({ success: true, synced: nextStepsWithIds.length, created: createdCount });
  } catch (error) {
    console.error("Monthly report action sync failed", error);
    return Response.json({ error: error?.message || "Unable to sync monthly report actions." }, { status: appRequestErrorStatus(error, 500) });
  }
}
