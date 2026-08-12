import { NextResponse } from "next/server";
import { adminDb, canInvestorAccessReport, verifyAppRequest } from "@/lib/server/firebaseAdmin";
import { actionCode, actionEventPayload, normaliseCreateAction } from "@/lib/server/actionServer";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const actor = await verifyAppRequest(request);
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const requestDiscussion = Boolean(body.requestDiscussion);
    const comment = String(body.comment || "").trim().slice(0, 2000);
    const reportSnapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
    if (!reportSnapshot.exists) return NextResponse.json({ error: "Monthly report was not found." }, { status: 404 });
    const report = { id: reportSnapshot.id, ...reportSnapshot.data() };
    if (!canInvestorAccessReport(actor, report)) return NextResponse.json({ error: "You are not authorised to acknowledge this report." }, { status: 403 });

    const acknowledgementId = `${reportId}_${actor.uid}`;
    const acknowledgementRef = adminDb.collection("reportAcknowledgements").doc(acknowledgementId);
    const batch = adminDb.batch();
    let discussionActionId = null;

    if (requestDiscussion) {
      const investorSnapshot = await adminDb.collection("investors").doc(report.investorId).get();
      if (investorSnapshot.exists) {
        const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
        const existingSnapshots = await adminDb.collection("investorActions").where("sourceReportId", "==", reportId).get();
        const existingAction = existingSnapshots.docs.find((item) => {
          const data = item.data();
          return data.requestedByUid === actor.uid
            && data.requestType === "Monthly Report Discussion"
            && !["Completed", "Rejected", "Cancelled"].includes(data.status);
        });
        const actionRef = existingAction ? existingAction.ref : adminDb.collection("investorActions").doc();
        const action = {
          ...normaliseCreateAction({
            investorId: report.investorId,
            requestType: "Monthly Report Discussion",
            title: `Discuss ${report.title || report.reportMonthKey || "monthly report"}`,
            description: comment,
            sourceReportId: reportId,
            sourceReportMonthKey: report.reportMonthKey || ""
          }, actor, investor),
          advisorUid: report.advisorUid || investor.assignedAdvisorUid || investor.advisorUid || "",
          assignedAdvisorUid: report.assignedAdvisorUid || report.advisorUid || investor.assignedAdvisorUid || investor.advisorUid || "",
          investorVisible: true,
          sourceType: "investor_request"
        };
        discussionActionId = actionRef.id;
        if (existingAction) {
          batch.set(actionRef, {
            description: comment || existingAction.data().description || "",
            status: existingAction.data().status || "Requested",
            updatedAt: new Date(),
            updatedByUid: actor.uid,
            updatedByName: actor.fullName || report.investorName || "Investor"
          }, { merge: true });
        } else {
          batch.set(actionRef, { ...action, actionCode: actionCode(actionRef.id) });
        }
        batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
          actionId: actionRef.id,
          action: existingAction ? { ...existingAction.data(), id: existingAction.id } : action,
          actor,
          eventType: existingAction ? "report_discussion_follow_up" : "report_discussion_action_created",
          note: comment || action.title,
          toStatus: existingAction ? existingAction.data().status : action.status,
          investorVisible: true
        }));
      }
    }
    const advisorRecipientUid = report.assignedAdvisorUid || report.advisorUid || null;
    batch.set(acknowledgementRef, {
      reportId,
      reportVersionId: report.activePublishedVersionId || null,
      publishedVersion: report.publishedVersion || null,
      investorId: report.investorId,
      investorUid: actor.uid,
      investorName: actor.fullName || report.investorName || "Investor",
      advisorUid: advisorRecipientUid,
      acknowledged: true,
      acknowledgedAt: new Date(),
      requestDiscussion,
      discussionComment: comment,
      discussionStatus: requestDiscussion ? "requested" : "not_requested",
      updatedAt: new Date()
    }, { merge: true });

    if (advisorRecipientUid) {
      const notificationRef = adminDb.collection("notifications").doc();
      batch.set(notificationRef, {
        recipientUid: advisorRecipientUid,
        recipientType: "advisor",
        title: requestDiscussion ? "Investor requested a report discussion" : "Investor acknowledged monthly report",
        message: requestDiscussion
          ? `${actor.fullName || report.investorName || "Investor"} requested a discussion about ${report.title || "the monthly report"}.`
          : `${actor.fullName || report.investorName || "Investor"} acknowledged ${report.title || "the monthly report"}.`,
        eventType: requestDiscussion ? "report_discussion_requested" : "report_acknowledged",
        link: requestDiscussion ? "/actions" : `/reports/${reportId}`,
        investorId: report.investorId,
        reportId,
        createdByUid: actor.uid,
        status: "unread",
        createdAt: new Date(),
        readAt: null,
        metadata: { comment, publishedVersion: report.publishedVersion || null, actionId: discussionActionId }
      });
    }

    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "monthly_report",
      recordId: reportId,
      reportId,
      investorId: report.investorId,
      advisorUid: advisorRecipientUid,
      action: requestDiscussion ? "report_discussion_requested" : "report_acknowledged",
      title: requestDiscussion ? "Investor requested report discussion" : "Investor acknowledged report",
      description: `${actor.fullName || report.investorName || "Investor"} ${requestDiscussion ? "requested a discussion about" : "acknowledged"} ${report.title || "the monthly report"}.`,
      createdByUid: actor.uid,
      createdByName: actor.fullName || report.investorName || "Investor",
      createdAt: new Date()
    });
    await batch.commit();
    return NextResponse.json({ success: true, requestDiscussion, actionId: discussionActionId });
  } catch (error) {
    console.error("Report acknowledgement failed", error);
    return NextResponse.json({ error: error.message || "Unable to acknowledge report." }, { status: 500 });
  }
}
