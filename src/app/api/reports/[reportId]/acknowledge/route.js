import { NextResponse } from "next/server";
import { adminDb, canInvestorAccessReport, verifyAppRequest } from "@/lib/server/firebaseAdmin";

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
    batch.set(acknowledgementRef, {
      reportId,
      reportVersionId: report.activePublishedVersionId || null,
      publishedVersion: report.publishedVersion || null,
      investorId: report.investorId,
      investorUid: actor.uid,
      investorName: actor.fullName || report.investorName || "Investor",
      advisorUid: report.advisorUid || null,
      acknowledged: true,
      acknowledgedAt: new Date(),
      requestDiscussion,
      discussionComment: comment,
      discussionStatus: requestDiscussion ? "requested" : "not_requested",
      updatedAt: new Date()
    }, { merge: true });

    if (report.advisorUid) {
      const notificationRef = adminDb.collection("notifications").doc();
      batch.set(notificationRef, {
        recipientUid: report.advisorUid,
        recipientType: "advisor",
        title: requestDiscussion ? "Investor requested a report discussion" : "Investor acknowledged monthly report",
        message: requestDiscussion
          ? `${actor.fullName || report.investorName || "Investor"} requested a discussion about ${report.title || "the monthly report"}.`
          : `${actor.fullName || report.investorName || "Investor"} acknowledged ${report.title || "the monthly report"}.`,
        eventType: requestDiscussion ? "report_discussion_requested" : "report_acknowledged",
        link: `/reports/${reportId}`,
        investorId: report.investorId,
        reportId,
        createdByUid: actor.uid,
        status: "unread",
        createdAt: new Date(),
        readAt: null,
        metadata: { comment, publishedVersion: report.publishedVersion || null }
      });
    }

    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "monthly_report",
      recordId: reportId,
      reportId,
      investorId: report.investorId,
      advisorUid: report.advisorUid || null,
      action: requestDiscussion ? "report_discussion_requested" : "report_acknowledged",
      title: requestDiscussion ? "Investor requested report discussion" : "Investor acknowledged report",
      description: `${actor.fullName || report.investorName || "Investor"} ${requestDiscussion ? "requested a discussion about" : "acknowledged"} ${report.title || "the monthly report"}.`,
      createdByUid: actor.uid,
      createdByName: actor.fullName || report.investorName || "Investor",
      createdAt: new Date()
    });
    await batch.commit();
    return NextResponse.json({ success: true, requestDiscussion });
  } catch (error) {
    console.error("Report acknowledgement failed", error);
    return NextResponse.json({ error: error.message || "Unable to acknowledge report." }, { status: 500 });
  }
}
