import { NextResponse } from "next/server";
import { adminDb, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { momEmailContent } from "@/lib/server/emailTemplates";
import { getAdvisorEmailProfile, getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";

async function logCommunication(payload) {
  await adminDb.collection("communicationLogs").add({ ...payload, createdAt: new Date(), updatedAt: new Date() });
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { momId } = await request.json();
    if (!momId) return NextResponse.json({ error: "MOM ID is required." }, { status: 400 });

    const snapshot = await adminDb.collection("meetingMinutes").doc(momId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "MOM was not found." }, { status: 404 });
    const mom = { id: snapshot.id, ...snapshot.data() };
    const isAdmin = ["super_admin", "admin"].includes(actor.role);
    if (!isAdmin && mom.advisorUid !== actor.uid) {
      return NextResponse.json({ error: "You are not authorised to send this MOM." }, { status: 403 });
    }
    if (mom.status !== "completed" || !mom.investorVisible) {
      return NextResponse.json({ error: "Complete and publish the client-facing MOM before emailing it." }, { status: 400 });
    }
    if (!mom.investorEmail) return NextResponse.json({ error: "Investor email is missing." }, { status: 400 });

    const branding = await getServerBranding();
    const communicationSettings = await getServerCommunicationSettings();
    const advisor = await getAdvisorEmailProfile(mom.advisorUid, { fullName: mom.advisorName, email: mom.advisorEmail, designation: mom.advisorDesignation || "" });
    advisor.companyName = branding.companyName;
    advisor.defaultSenderName = communicationSettings.senderName;
    advisor.defaultSenderEmail = communicationSettings.senderEmail;
    advisor.replyToEmail = communicationSettings.replyToEmail;
    const content = momEmailContent(mom, { branding, advisor });
    try {
      const result = await sendTransactionalEmail({
        to: [{ name: mom.investorName, address: mom.investorEmail }],
        subject: content.subject,
        html: content.html,
        text: content.text,
        advisor
      });
      await logCommunication({
        eventType: "mom_published",
        channel: "email",
        provider: "brevo_smtp",
        recipientType: "investor",
        recipientName: mom.investorName,
        recipientEmail: mom.investorEmail,
        meetingId: mom.meetingId,
        momId,
        investorId: mom.investorId || null,
        advisorUid: mom.advisorUid,
        status: result.skipped ? "skipped" : "sent",
        providerMessageId: result.messageId || null,
        failureReason: result.reason || null,
        sentByUid: actor.uid,
        sentAt: result.skipped ? null : new Date()
      });
      await adminDb.collection("meetingMinutes").doc(momId).set({
        lastEmailAttemptAt: new Date(),
        lastEmailStatus: result.skipped ? "skipped" : "sent",
        updatedAt: new Date()
      }, { merge: true });
      return NextResponse.json({ success: true, status: result.skipped ? "skipped" : "sent" });
    } catch (error) {
      await logCommunication({
        eventType: "mom_published",
        channel: "email",
        provider: "brevo_smtp",
        recipientType: "investor",
        recipientName: mom.investorName,
        recipientEmail: mom.investorEmail,
        meetingId: mom.meetingId,
        momId,
        investorId: mom.investorId || null,
        advisorUid: mom.advisorUid,
        status: "failed",
        providerMessageId: null,
        failureReason: error.message,
        sentByUid: actor.uid,
        sentAt: null
      });
      throw error;
    }
  } catch (error) {
    console.error("MOM communication failed", error);
    return NextResponse.json({ error: error.message || "Unable to send MOM communication." }, { status: 500 });
  }
}
