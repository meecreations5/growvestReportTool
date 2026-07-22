import { NextResponse } from "next/server";
import { adminDb, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { reportEmailContent } from "@/lib/server/emailTemplates";
import { getAdvisorEmailProfile, getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await request.json();
    if (!reportId) return NextResponse.json({ error: "Report ID is required." }, { status: 400 });

    const snapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "Monthly report was not found." }, { status: 404 });
    const report = { id: snapshot.id, ...snapshot.data() };
    const isAdmin = ["super_admin", "admin"].includes(actor.role);
    if (!isAdmin && report.advisorUid !== actor.uid && report.assignedAdvisorUid !== actor.uid) {
      return NextResponse.json({ error: "You are not authorised to send this report communication." }, { status: 403 });
    }
    if (report.status !== "completed" || report.investorVisible !== true) {
      return NextResponse.json({ error: "Publish the completed report before sending the investor email." }, { status: 422 });
    }
    const investorEmail = String(report.investorEmail || "").trim();
    if (!investorEmail) return NextResponse.json({ error: "Investor email address is missing." }, { status: 422 });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const viewUrl = `${String(origin).replace(/\/$/, "")}/investor/reports/${reportId}`;
    const branding = await getServerBranding();
    const communicationSettings = await getServerCommunicationSettings();
    const advisor = await getAdvisorEmailProfile(report.advisorUid, { fullName: report.advisorName || actor.fullName, email: report.advisorEmail || actor.email, designation: report.advisorDesignation || "" });
    advisor.companyName = branding.companyName;
    advisor.defaultSenderName = communicationSettings.senderName;
    advisor.defaultSenderEmail = communicationSettings.senderEmail;
    advisor.replyToEmail = communicationSettings.replyToEmail;
    const content = reportEmailContent(report, viewUrl, { branding, advisor });

    try {
      const result = await sendTransactionalEmail({
        to: [{ name: report.investorName || "Investor", address: investorEmail }],
        subject: content.subject,
        html: content.html,
        text: content.text,
        advisor
      });

      await adminDb.collection("communicationLogs").add({
        eventType: "monthly_report_published",
        channel: "email",
        provider: "brevo_smtp",
        recipientType: "investor",
        recipientName: report.investorName || "",
        recipientEmail: investorEmail,
        reportId,
        investorId: report.investorId || null,
        advisorUid: report.advisorUid || actor.uid,
        status: result.skipped ? "skipped" : "sent",
        providerMessageId: result.messageId || null,
        providerResponse: result.response || null,
        sentByUid: actor.uid,
        sentAt: result.skipped ? null : new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await adminDb.collection("monthlyReports").doc(reportId).set({
        lastEmailStatus: result.skipped ? "skipped" : "sent",
        lastEmailAttemptAt: new Date(),
        lastEmailError: result.reason || null,
        lastEmailMessageId: result.messageId || null,
        updatedAt: new Date()
      }, { merge: true });

      return NextResponse.json({ success: true, status: result.skipped ? "skipped" : "sent", messageId: result.messageId || null });
    } catch (error) {
      await adminDb.collection("communicationLogs").add({
        eventType: "monthly_report_published",
        channel: "email",
        provider: "brevo_smtp",
        recipientType: "investor",
        recipientName: report.investorName || "",
        recipientEmail: investorEmail,
        reportId,
        investorId: report.investorId || null,
        advisorUid: report.advisorUid || actor.uid,
        status: "failed",
        failureReason: error.message,
        sentByUid: actor.uid,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await adminDb.collection("monthlyReports").doc(reportId).set({ lastEmailStatus: "failed", lastEmailAttemptAt: new Date(), lastEmailError: error.message, updatedAt: new Date() }, { merge: true });
      return NextResponse.json({ error: `Report email could not be sent: ${error.message}`, success: false }, { status: 502 });
    }
  } catch (error) {
    console.error("Report communication failed", error);
    return NextResponse.json({ error: error.message || "Unable to send report communication." }, { status: 500 });
  }
}
