import { NextResponse } from "next/server";
import { adminDb, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { createAndUploadReportPdf, publishedSnapshotData } from "@/lib/server/reportServer";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { reportEmailContent } from "@/lib/server/emailTemplates";
import { getAdvisorEmailProfile, getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";


export const runtime = "nodejs";
export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const sendEmail = body.sendEmail !== false;
    const reportRef = adminDb.collection("monthlyReports").doc(reportId);
    const snapshot = await reportRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Monthly report was not found." }, { status: 404 });
    const report = { id: snapshot.id, ...snapshot.data() };
    if (!canStaffAccessRecord(actor, report)) return NextResponse.json({ error: "You are not authorised to publish this report." }, { status: 403 });
    if (report.status !== "completed") return NextResponse.json({ error: "Complete the report before publishing it." }, { status: 422 });

    const nextPublishedVersion = Number(report.publishedVersion || 0) + 1;
    const versionId = `${reportId}_v${nextPublishedVersion}`;
    const versionRef = adminDb.collection("reportVersions").doc(versionId);
    const snapshotData = publishedSnapshotData(report, nextPublishedVersion, versionId);
    const pdf = await createAndUploadReportPdf(snapshotData, { reportId, publishedVersion: nextPublishedVersion, versionId });
    const versionData = { ...snapshotData, ...pdf, reportId, isActive: true, publishedByUid: actor.uid, publishedByName: actor.fullName || actor.email };

    const batch = adminDb.batch();
    if (report.activePublishedVersionId) {
      batch.set(adminDb.collection("reportVersions").doc(report.activePublishedVersionId), { isActive: false, supersededAt: new Date(), supersededByVersionId: versionId }, { merge: true });
    }
    batch.set(versionRef, versionData);
    batch.set(reportRef, {
      investorVisible: true,
      publicationStatus: "published",
      activePublishedVersionId: versionId,
      publishedVersion: nextPublishedVersion,
      publishedSourceVersion: Number(report.version || 1),
      publishedAt: new Date(),
      publishedByUid: actor.uid,
      publishedByName: actor.fullName || actor.email,
      ...pdf,
      updatedAt: new Date()
    }, { merge: true });

    if (report.investorPortalUid) {
      const notificationRef = adminDb.collection("notifications").doc();
      batch.set(notificationRef, {
        recipientUid: report.investorPortalUid,
        recipientType: "investor",
        title: nextPublishedVersion > 1 ? "Updated Monthly Wealth Report Available" : "Monthly Wealth Report Available",
        message: `Your GrowVest report for ${report.title || report.reportMonthKey || "this month"} is ready.`,
        eventType: nextPublishedVersion > 1 ? "monthly_report_updated" : "monthly_report_published",
        link: `/investor/reports/${reportId}`,
        investorId: report.investorId || null,
        reportId,
        createdByUid: actor.uid,
        metadata: { reportCode: report.reportCode || "", publishedVersion: nextPublishedVersion },
        status: "unread",
        createdAt: new Date(),
        readAt: null
      });
    }

    if (report.advisorUid && report.advisorUid !== actor.uid) {
      const advisorNotificationRef = adminDb.collection("notifications").doc();
      batch.set(advisorNotificationRef, {
        recipientUid: report.advisorUid,
        recipientType: "advisor",
        title: "Monthly report published",
        message: `${report.investorName || "Investor"}'s monthly report version ${nextPublishedVersion} was published.`,
        eventType: "monthly_report_publish_confirmation",
        link: `/reports/${reportId}`,
        investorId: report.investorId || null,
        reportId,
        createdByUid: actor.uid,
        status: "unread",
        createdAt: new Date(),
        readAt: null
      });
    }

    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "monthly_report",
      recordId: reportId,
      reportId,
      investorId: report.investorId || null,
      advisorUid: report.advisorUid || actor.uid,
      action: nextPublishedVersion > 1 ? "monthly_report_revision_published" : "monthly_report_published",
      title: nextPublishedVersion > 1 ? "Monthly report revision published" : "Monthly report published",
      description: `${report.title || "Monthly report"} version ${nextPublishedVersion} was published by ${actor.fullName || actor.email}.`,
      metadata: { publishedVersion: nextPublishedVersion, versionId, pdfStoragePath: pdf.pdfStoragePath },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email,
      createdAt: new Date()
    });
    await batch.commit();

    let emailStatus = "not_requested";
    let emailError = null;
    if (sendEmail && report.investorEmail) {
      try {
        const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        const viewUrl = `${String(origin).replace(/\/$/, "")}/investor/reports/${reportId}`;
        const branding = await getServerBranding();
        const communicationSettings = await getServerCommunicationSettings();
        const advisorProfile = await getAdvisorEmailProfile(report.advisorUid, { fullName: report.advisorName || actor.fullName, email: report.advisorEmail || actor.email, designation: report.advisorDesignation || "" });
        advisorProfile.companyName = branding.companyName;
        advisorProfile.defaultSenderName = communicationSettings.senderName;
        advisorProfile.defaultSenderEmail = communicationSettings.senderEmail;
        advisorProfile.replyToEmail = communicationSettings.replyToEmail;
        const content = reportEmailContent({ ...report, publishedVersion: nextPublishedVersion }, viewUrl, { branding, advisor: advisorProfile });
        const emailResult = await sendTransactionalEmail({
          to: [{ name: report.investorName || "Investor", address: report.investorEmail }],
          subject: content.subject,
          html: content.html,
          text: content.text,
          advisor: advisorProfile
        });
        emailStatus = emailResult.skipped ? "skipped" : "sent";
        await adminDb.collection("communicationLogs").add({
          eventType: nextPublishedVersion > 1 ? "monthly_report_updated" : "monthly_report_published",
          channel: "email",
          provider: "brevo_smtp",
          recipientType: "investor",
          recipientName: report.investorName || "",
          recipientEmail: report.investorEmail,
          reportId,
          reportVersionId: versionId,
          investorId: report.investorId || null,
          advisorUid: report.advisorUid || actor.uid,
          status: emailStatus,
          providerMessageId: emailResult.messageId || null,
          sentByUid: actor.uid,
          sentAt: emailResult.skipped ? null : new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } catch (error) {
        emailStatus = "failed";
        emailError = error.message;
        await adminDb.collection("communicationLogs").add({
          eventType: nextPublishedVersion > 1 ? "monthly_report_updated" : "monthly_report_published",
          channel: "email",
          provider: "brevo_smtp",
          recipientType: "investor",
          recipientName: report.investorName || "",
          recipientEmail: report.investorEmail,
          reportId,
          reportVersionId: versionId,
          investorId: report.investorId || null,
          advisorUid: report.advisorUid || actor.uid,
          status: "failed",
          failureReason: error.message,
          sentByUid: actor.uid,
          sentAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    await reportRef.set({ lastEmailStatus: emailStatus, lastEmailError: emailError, lastEmailAttemptAt: sendEmail ? new Date() : null }, { merge: true });

    return NextResponse.json({ success: true, publishedVersion: nextPublishedVersion, versionId, ...pdf, emailStatus, emailError });
  } catch (error) {
    console.error("Report publication failed", error);
    return NextResponse.json({ error: error.message || "Unable to publish monthly report." }, { status: 500 });
  }
}
