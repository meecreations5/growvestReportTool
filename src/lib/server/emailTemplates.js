import { meetingProviderLabel, meetingTypeLabel } from "@/lib/constants/meeting";
import { SERVER_BRANDING_DEFAULTS } from "@/lib/server/settingsServer";
import { renderEmailSignatureHtml } from "@/lib/utils/emailSignature";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function htmlOrText(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return /<\/?[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text).replace(/\n/g, "<br>");
}

function companyDefaultSignature(branding = {}) {
  if (branding.defaultEmailSignatureHtml) {
    return `<div style="margin-top:28px;line-height:1.7">${htmlOrText(branding.defaultEmailSignatureHtml)}</div>`;
  }
  return renderEmailSignatureHtml({
    signature: {
      enabled: true,
      mode: "responsive_html",
      fullName: branding.companyName || "GrowVest",
      designation: branding.brandPositioning || "Your Conscious Wealth Partner",
      email: branding.supportEmail || "",
      mobile: branding.supportMobile || "",
      website: branding.website || "",
      officeAddress: branding.address || "",
      visibility: { designation: true, brandPositioning: false, email: true, mobile: true, website: true, address: true, watermark: true, footer: true, companyLogo: true }
    },
    user: {},
    branding
  });
}

function advisorSignature(advisor = {}, branding = {}) {
  const publishedSignature = advisor.emailSignature || null;
  if (publishedSignature) {
    if (publishedSignature.enabled === false) return companyDefaultSignature(branding);
    const rendered = renderEmailSignatureHtml({ signature: publishedSignature, user: advisor, branding });
    if (rendered) return rendered;
  }

  if (advisor.signatureEnabled === false) return companyDefaultSignature(branding);
  const legacySignature = advisor.emailSignatureHtml || "";
  if (legacySignature) return `<div style="margin-top:28px;line-height:1.7">${htmlOrText(legacySignature)}</div>`;

  return companyDefaultSignature(branding);
}

function frame(content, { branding: rawBranding = {}, advisor = {} } = {}) {
  const branding = { ...SERVER_BRANDING_DEFAULTS, ...rawBranding };
  const primary = branding.primaryColor || "#1f4ed8";
  const logo = branding.emailLogoUrl || branding.primaryLogoUrl || branding.iconLogoUrl || "";
  const logoHtml = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(branding.companyName)}" style="display:block;max-height:48px;max-width:220px;object-fit:contain">`
    : `<div style="font-size:22px;font-weight:800">${escapeHtml(branding.companyName)}</div>`;
  const footerParts = [branding.emailFooterText, branding.supportEmail, branding.website].filter(Boolean);

  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid #e4e9f2;border-radius:18px;overflow:hidden"><tr><td style="padding:24px 30px;background:${escapeHtml(primary)};color:#fff">${logoHtml}<div style="font-size:12px;opacity:.86;margin-top:8px">${escapeHtml(branding.tagline || "")}</div></td></tr><tr><td style="padding:30px">${content}${advisorSignature(advisor, branding)}</td></tr><tr><td style="padding:18px 30px;background:#f7f9fc;color:#667085;font-size:12px;line-height:1.6">${footerParts.map(escapeHtml).join(" · ")}</td></tr></table></td></tr></table></body></html>`;
}

function actionButton(label, url, branding = {}) {
  if (!url) return "";
  const primary = branding.primaryColor || "#1f4ed8";
  return `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${escapeHtml(primary)};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${escapeHtml(label)}</a></p>`;
}

export function meetingEmailContent(meeting, recipientType, eventType, options = {}) {
  const branding = { ...SERVER_BRANDING_DEFAULTS, ...(options.branding || {}) };
  const advisor = options.advisor || {
    fullName: meeting.advisorName,
    designation: meeting.advisorDesignation,
    emailSignatureHtml: meeting.advisorSignatureHtml,
    signatureEnabled: meeting.advisorSignatureEnabled
  };
  const personName = recipientType === "advisor" ? meeting.advisorName : meeting.investorName || meeting.leadName || "Client";
  const counterpart = recipientType === "advisor" ? meeting.investorName || meeting.leadName || "Client" : meeting.advisorName || `${branding.companyName} Advisor`;
  const titleMap = {
    meeting_scheduled: "Meeting Scheduled",
    meeting_rescheduled: "Meeting Rescheduled",
    meeting_cancelled: "Meeting Cancelled",
    meeting_reminder: "Meeting Reminder"
  };
  const subjectPrefix = titleMap[eventType] || "Meeting Update";
  const subject = `${subjectPrefix} — ${meeting.title}`;
  const agenda = meeting.agenda?.length
    ? `<div style="margin-top:20px"><strong>Agenda</strong><ol style="padding-left:22px;line-height:1.7">${meeting.agenda.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>`
    : "";
  const cancellation = eventType === "meeting_cancelled" && meeting.cancellationReason
    ? `<p style="padding:12px 14px;background:#fff3f3;border-radius:10px"><strong>Reason:</strong> ${escapeHtml(meeting.cancellationReason)}</p>`
    : "";
  const content = `
    <p style="margin-top:0">Hello ${escapeHtml(personName)},</p>
    <h2 style="font-size:22px;margin:10px 0">${escapeHtml(subjectPrefix)}</h2>
    <p style="line-height:1.7">Your meeting with ${escapeHtml(counterpart)} has been updated.</p>
    ${cancellation}
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:18px;border-collapse:collapse">
      <tr><td style="padding:9px 0;color:#667085;width:150px">Meeting</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meeting.title)}</td></tr>
      <tr><td style="padding:9px 0;color:#667085">Type</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meetingTypeLabel(meeting.meetingType))}</td></tr>
      <tr><td style="padding:9px 0;color:#667085">Date</td><td style="padding:9px 0;font-weight:700">${escapeHtml(formatDate(meeting.meetingDate))}</td></tr>
      <tr><td style="padding:9px 0;color:#667085">Time</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meeting.startTime)} – ${escapeHtml(meeting.endTime)}</td></tr>
      <tr><td style="padding:9px 0;color:#667085">Mode</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meetingProviderLabel(meeting.meetingProvider))}</td></tr>
      ${meeting.location ? `<tr><td style="padding:9px 0;color:#667085">Location</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meeting.location)}</td></tr>` : ""}
    </table>
    ${agenda}
    ${eventType !== "meeting_cancelled" ? actionButton("Join / View Meeting", meeting.meetingLink, branding) : ""}`;
  return {
    subject,
    html: frame(content, { branding, advisor }),
    text: `${subject}\n${meeting.title}\n${formatDate(meeting.meetingDate)} ${meeting.startTime}-${meeting.endTime}\n${meeting.meetingLink || meeting.location || ""}`
  };
}

export function momEmailContent(mom, options = {}) {
  const branding = { ...SERVER_BRANDING_DEFAULTS, ...(options.branding || {}) };
  const advisor = options.advisor || { fullName: mom.advisorName, designation: mom.advisorDesignation };
  const actionItems = (mom.clientVisibleActionItems || []).length
    ? `<div style="margin-top:20px"><strong>Agreed action items</strong><ol style="padding-left:22px;line-height:1.7">${mom.clientVisibleActionItems.map((item) => `<li>${escapeHtml(item.description)}${item.dueDate ? ` <em>(Due ${escapeHtml(item.dueDate)})</em>` : ""}</li>`).join("")}</ol></div>`
    : "";
  const subject = `${branding.companyName} Meeting Summary — ${mom.meetingTitle}`;
  const content = `<p style="margin-top:0">Hello ${escapeHtml(mom.investorName || "")},</p><h2 style="font-size:22px">Meeting Summary</h2><p style="line-height:1.8">${escapeHtml(mom.clientSummary).replace(/\n/g, "<br>")}</p>${actionItems}`;
  return { subject, html: frame(content, { branding, advisor }), text: `${subject}\n\n${mom.clientSummary}` };
}

export function reportEmailContent(report, viewUrl, options = {}) {
  const branding = { ...SERVER_BRANDING_DEFAULTS, ...(options.branding || {}) };
  const advisor = options.advisor || { fullName: report.advisorName, designation: report.advisorDesignation };
  const period = `${report.reportMonth ? new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(Number(report.reportYear), Number(report.reportMonth) - 1, 1)) : "Monthly"} ${report.reportYear || ""}`.trim();
  const subject = String(options.subjectOverride || `Your ${branding.companyName} Monthly Wealth Report — ${period}`).trim();
  const customMessage = String(options.messageOverride || "").trim();
  const messageHtml = customMessage
    ? `<p style="line-height:1.75">${escapeHtml(customMessage).replace(/\n/g, "<br>")}</p>`
    : `<p style="line-height:1.7">Your ${escapeHtml(branding.companyName)} report for <strong>${escapeHtml(period)}</strong> has been published to your secure Investor Portal.</p>`;
  const content = `
    <p style="margin-top:0">Hello ${escapeHtml(report.investorName || "Investor")},</p>
    <h2 style="font-size:22px;margin:10px 0">Your Monthly Wealth Progress Report is ready</h2>
    ${messageHtml}
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:18px;border-collapse:collapse">
      <tr><td style="padding:9px 0;color:#667085;width:160px">Report reference</td><td style="padding:9px 0;font-weight:700">${escapeHtml(report.reportCode || "—")}</td></tr>
      <tr><td style="padding:9px 0;color:#667085">Statement date</td><td style="padding:9px 0;font-weight:700">${escapeHtml(formatDate(report.statementDate))}</td></tr>
      <tr><td style="padding:9px 0;color:#667085">Advisor</td><td style="padding:9px 0;font-weight:700">${escapeHtml(report.advisorName || `${branding.companyName} Advisor`)}</td></tr>
    </table>
    ${actionButton("View Monthly Report", viewUrl, branding)}
    <p style="margin-top:24px;color:#667085;font-size:13px;line-height:1.7">For privacy, portfolio values are available only after secure login to the ${escapeHtml(branding.companyName)} Investor Portal.</p>`;
  return {
    subject,
    html: frame(content, { branding, advisor }),
    text: `${subject}\n\n${customMessage || `Your report is available in the ${branding.companyName} Investor Portal.`}\n${viewUrl || ""}`
  };
}
