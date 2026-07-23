import { adminBucket, adminDb, canStaffAccessRecord } from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { reportEmailContent } from "@/lib/server/emailTemplates";
import { getAdvisorEmailProfile, getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";

function cleanEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanList(value) {
  const rows = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(rows.map(cleanEmail).filter(Boolean))];
}

function reportPeriod(report) {
  const month = Number(report.reportMonth || 0);
  const year = Number(report.reportYear || 0);
  if (!month || !year) return report.reportMonthKey || "Monthly report";
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function canSend(actor, report) {
  return canStaffAccessRecord(actor, report);
}

async function pdfAttachment(report, attachPdf) {
  if (!attachPdf || !report.pdfStoragePath) return [];
  const [buffer] = await adminBucket.file(report.pdfStoragePath).download();
  return [{
    filename: report.pdfFileName || `${report.reportCode || "GrowVest-report"}.pdf`,
    content: buffer,
    contentType: "application/pdf"
  }];
}

export async function loadDeliveryReport(reportId, actor) {
  const snapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
  if (!snapshot.exists) throw new Error("Monthly report was not found.");
  const report = { id: snapshot.id, ...snapshot.data() };
  if (!canSend(actor, report)) throw new Error("You are not authorised to manage this report delivery.");
  return report;
}

export function defaultReportDeliveryMessage(report, branding = {}) {
  return `Your ${branding.companyName || "GrowVest"} monthly wealth report for ${reportPeriod(report)} is ready. Please review the report through your secure Investor Portal. You may reply to this email or contact your Advisor if you would like to discuss any part of the report.`;
}

export async function createScheduledDelivery({ report, actor, payload }) {
  if (report.status !== "completed" || report.investorVisible !== true) {
    throw new Error("Publish the completed report before scheduling delivery.");
  }
  const recipientEmail = cleanEmail(payload.recipientEmail || report.investorEmail);
  if (!recipientEmail) throw new Error("Investor email address is required.");
  const scheduledFor = new Date(payload.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
    throw new Error("Choose a future date and time for scheduled delivery.");
  }
  const branding = await getServerBranding();
  const deliveryRef = adminDb.collection("emailDeliveries").doc();
  const record = {
    reportId: report.id,
    reportVersionId: report.activePublishedVersionId || null,
    publishedVersion: Number(report.publishedVersion || 0),
    reportCode: report.reportCode || "",
    reportTitle: report.title || "Monthly Wealth Report",
    reportMonthKey: report.reportMonthKey || "",
    reportMonth: report.reportMonth || null,
    reportYear: report.reportYear || null,
    investorId: report.investorId || null,
    investorName: report.investorName || "",
    clientCode: report.clientCode || "",
    recipientEmail,
    cc: cleanList(payload.cc),
    bcc: cleanList(payload.bcc),
    subject: String(payload.subject || `Your ${branding.companyName || "GrowVest"} Monthly Wealth Report — ${reportPeriod(report)}`).trim(),
    message: String(payload.message || defaultReportDeliveryMessage(report, branding)).trim(),
    attachPdf: payload.attachPdf !== false,
    pdfFileName: report.pdfFileName || null,
    advisorUid: report.advisorUid || actor.uid,
    advisorName: report.advisorName || actor.fullName || "",
    status: "scheduled",
    scheduledFor,
    sentAt: null,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    failedAt: null,
    failureReason: null,
    providerMessageId: null,
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "GrowVest User",
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await deliveryRef.set(record);
  await adminDb.collection("monthlyReports").doc(report.id).set({
    lastEmailStatus: "scheduled",
    scheduledDeliveryId: deliveryRef.id,
    scheduledDeliveryAt: scheduledFor,
    updatedAt: new Date()
  }, { merge: true });
  return { id: deliveryRef.id, ...record };
}

export async function sendReportDelivery({ report, actor, payload = {}, deliveryId = "", testMode = false }) {
  if (!testMode && (report.status !== "completed" || report.investorVisible !== true)) {
    throw new Error("Publish the completed report before sending the Investor email.");
  }
  const branding = await getServerBranding();
  const communicationSettings = await getServerCommunicationSettings();
  const recipientEmail = cleanEmail(testMode ? actor.email : (payload.recipientEmail || report.investorEmail));
  if (!recipientEmail) throw new Error(testMode ? "Your staff email address is missing." : "Investor email address is missing.");

  const reference = deliveryId
    ? adminDb.collection("emailDeliveries").doc(deliveryId)
    : adminDb.collection("emailDeliveries").doc();
  const snapshot = deliveryId ? await reference.get() : null;
  const existing = snapshot?.exists ? snapshot.data() : {};
  const subject = String(payload.subject || existing.subject || `Your ${branding.companyName || "GrowVest"} Monthly Wealth Report — ${reportPeriod(report)}`).trim();
  const message = String(payload.message || existing.message || defaultReportDeliveryMessage(report, branding)).trim();
  const cc = testMode ? [] : cleanList(payload.cc ?? existing.cc);
  const bcc = testMode ? [] : cleanList(payload.bcc ?? existing.bcc);
  const attachPdf = payload.attachPdf ?? existing.attachPdf ?? true;
  const viewUrl = `${String(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/investor/reports/${report.id}`;
  const advisor = await getAdvisorEmailProfile(report.advisorUid, {
    fullName: report.advisorName || actor.fullName,
    email: report.advisorEmail || actor.email,
    designation: report.advisorDesignation || ""
  });
  advisor.companyName = branding.companyName;
  advisor.defaultSenderName = communicationSettings.senderName;
  advisor.defaultSenderEmail = communicationSettings.senderEmail;
  advisor.replyToEmail = communicationSettings.replyToEmail;
  const content = reportEmailContent(report, viewUrl, {
    branding,
    advisor,
    subjectOverride: testMode ? `[TEST] ${subject}` : subject,
    messageOverride: message
  });
  const baseRecord = {
    reportId: report.id,
    reportVersionId: report.activePublishedVersionId || null,
    publishedVersion: Number(report.publishedVersion || 0),
    reportCode: report.reportCode || "",
    reportTitle: report.title || "Monthly Wealth Report",
    reportMonthKey: report.reportMonthKey || "",
    reportMonth: report.reportMonth || null,
    reportYear: report.reportYear || null,
    investorId: report.investorId || null,
    investorName: report.investorName || "",
    clientCode: report.clientCode || "",
    recipientEmail,
    cc,
    bcc,
    subject,
    message,
    htmlPreview: content.html,
    textPreview: content.text,
    attachPdf: Boolean(attachPdf),
    pdfFileName: report.pdfFileName || null,
    advisorUid: report.advisorUid || actor.uid,
    advisorName: report.advisorName || actor.fullName || "",
    testMode: Boolean(testMode),
    updatedAt: new Date()
  };

  await reference.set({
    ...baseRecord,
    status: "sending",
    sendingAt: new Date(),
    createdAt: existing.createdAt || new Date(),
    createdByUid: existing.createdByUid || actor.uid,
    createdByName: existing.createdByName || actor.fullName || actor.email || "GrowVest User"
  }, { merge: true });

  try {
    const attachments = await pdfAttachment(report, Boolean(attachPdf));
    const custom = `deliveryId:${reference.id}|reportId:${report.id}`;
    const result = await sendTransactionalEmail({
      to: [{ name: testMode ? actor.fullName || "GrowVest User" : report.investorName || "Investor", address: recipientEmail }],
      cc,
      bcc,
      subject: content.subject,
      html: content.html,
      text: content.text,
      advisor,
      attachments,
      headers: {
        "X-GrowVest-Delivery-ID": reference.id,
        "X-GrowVest-Report-ID": report.id,
        "X-Mailin-custom": custom
      }
    });

    const status = result.skipped ? "skipped" : "sent";
    const sentAt = result.skipped ? null : new Date();
    await reference.set({
      ...baseRecord,
      status,
      sentAt,
      provider: "brevo_smtp",
      providerMessageId: result.messageId || null,
      providerResponse: result.response || null,
      failureReason: result.reason || null,
      lastEvent: status,
      lastEventAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });

    await adminDb.collection("communicationLogs").add({
      eventType: testMode ? "monthly_report_test_email" : "monthly_report_delivery",
      channel: "email",
      provider: "brevo_smtp",
      deliveryId: reference.id,
      recipientType: testMode ? "staff" : "investor",
      recipientName: testMode ? actor.fullName || "" : report.investorName || "",
      recipientEmail,
      reportId: report.id,
      reportVersionId: report.activePublishedVersionId || null,
      investorId: report.investorId || null,
      advisorUid: report.advisorUid || actor.uid,
      subject,
      message,
      attachPdf: Boolean(attachPdf),
      pdfFileName: report.pdfFileName || null,
      status,
      providerMessageId: result.messageId || null,
      providerResponse: result.response || null,
      sentByUid: actor.uid,
      sentAt,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (!testMode) {
      await adminDb.collection("monthlyReports").doc(report.id).set({
        lastEmailStatus: status,
        lastEmailAttemptAt: new Date(),
        lastEmailError: result.reason || null,
        lastEmailMessageId: result.messageId || null,
        lastEmailDeliveryId: reference.id,
        scheduledDeliveryId: null,
        scheduledDeliveryAt: null,
        updatedAt: new Date()
      }, { merge: true });
    }
    return { id: reference.id, status, messageId: result.messageId || null };
  } catch (error) {
    const failure = error.message || "Email delivery failed.";
    await reference.set({
      ...baseRecord,
      status: "failed",
      failedAt: new Date(),
      failureReason: failure,
      lastEvent: "failed",
      lastEventAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    await adminDb.collection("communicationLogs").add({
      eventType: testMode ? "monthly_report_test_email" : "monthly_report_delivery",
      channel: "email",
      provider: "brevo_smtp",
      deliveryId: reference.id,
      recipientType: testMode ? "staff" : "investor",
      recipientName: testMode ? actor.fullName || "" : report.investorName || "",
      recipientEmail,
      reportId: report.id,
      investorId: report.investorId || null,
      advisorUid: report.advisorUid || actor.uid,
      subject,
      status: "failed",
      failureReason: failure,
      sentByUid: actor.uid,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    if (!testMode) {
      await adminDb.collection("monthlyReports").doc(report.id).set({
        lastEmailStatus: "failed",
        lastEmailAttemptAt: new Date(),
        lastEmailError: failure,
        lastEmailDeliveryId: reference.id,
        updatedAt: new Date()
      }, { merge: true });
    }
    throw error;
  }
}
