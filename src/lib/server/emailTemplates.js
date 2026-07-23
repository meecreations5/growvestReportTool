import { meetingProviderLabel, meetingTypeLabel } from "@/lib/constants/meeting";
import {
  SIGNATURE_SOURCES,
  createEmailTemplateSnapshot,
  mergeEmailFields
} from "@/lib/constants/emailTemplates";
import { SERVER_BRANDING_DEFAULTS } from "@/lib/server/settingsServer";
import { renderEmailSignatureHtml } from "@/lib/utils/emailSignature";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  const source = typeof dateValue?.toDate === "function" ? dateValue.toDate() : dateValue;
  const date = source instanceof Date ? source : new Date(String(source).includes("T") ? source : `${source}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function htmlOrText(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return /<\/?[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text).replace(/\n/g, "<br>");
}

function companyDefaultSignature(branding = {}, visibility = {}) {
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
      website: branding.signatureWebsite || branding.website || "",
      officeAddress: branding.signatureAddress || branding.address || "",
      visibility: {
        designation: visibility.designation !== false,
        brandPositioning: visibility.brandPositioning !== false,
        email: visibility.email !== false,
        mobile: visibility.mobile !== false,
        website: visibility.website !== false,
        address: visibility.address !== false,
        watermark: visibility.signatureIcon !== false,
        footer: visibility.footerTaglines !== false,
        companyLogo: visibility.companyLogo !== false,
        socialMedia: visibility.socialMedia !== false
      }
    },
    user: {},
    branding
  });
}

function mappedSignatureVisibility(templateVisibility = {}, existing = {}) {
  return {
    ...existing,
    designation: templateVisibility.designation !== false && existing.designation !== false,
    brandPositioning: templateVisibility.brandPositioning !== false && existing.brandPositioning !== false,
    email: templateVisibility.email !== false && existing.email !== false,
    mobile: templateVisibility.mobile !== false && existing.mobile !== false,
    website: templateVisibility.website !== false && existing.website !== false,
    address: templateVisibility.address !== false && existing.address !== false,
    watermark: templateVisibility.signatureIcon !== false && existing.watermark !== false,
    footer: templateVisibility.footerTaglines !== false && existing.footer !== false,
    companyLogo: templateVisibility.companyLogo !== false && existing.companyLogo !== false,
    socialMedia: templateVisibility.socialMedia !== false && existing.socialMedia !== false
  };
}

function advisorSignature(advisor = {}, branding = {}, signatureConfig = {}) {
  if (signatureConfig.enabled === false || signatureConfig.source === SIGNATURE_SOURCES.NONE) return "";
  const visibility = signatureConfig.visibility || {};
  if (signatureConfig.source === SIGNATURE_SOURCES.COMPANY_DEFAULT) return companyDefaultSignature(branding, visibility);

  const publishedSignature = advisor.emailSignature || null;
  if (publishedSignature) {
    if (publishedSignature.enabled === false) return companyDefaultSignature(branding, visibility);
    const rendered = renderEmailSignatureHtml({
      signature: {
        ...publishedSignature,
        visibility: mappedSignatureVisibility(visibility, publishedSignature.visibility || {})
      },
      user: advisor,
      branding
    });
    if (rendered) return rendered;
  }

  if (advisor.signatureEnabled === false) return companyDefaultSignature(branding, visibility);
  const legacySignature = advisor.emailSignatureHtml || "";
  if (legacySignature) return `<div style="margin-top:28px;line-height:1.7">${htmlOrText(legacySignature)}</div>`;

  const fallbackSignature = {
    enabled: true,
    mode: "responsive_html",
    fullName: advisor.fullName || branding.companyName || "GrowVest",
    designation: advisor.designation || branding.brandPositioning || "Your Conscious Wealth Partner",
    email: advisor.email || branding.supportEmail || "",
    mobile: advisor.mobile || advisor.phone || branding.supportMobile || "",
    website: branding.signatureWebsite || branding.website || "",
    officeAddress: branding.signatureAddress || branding.address || "",
    visibility: mappedSignatureVisibility(visibility, {})
  };
  return renderEmailSignatureHtml({ signature: fallbackSignature, user: advisor, branding });
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

function numberBetween(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function firstName(value = "") {
  return String(value || "").trim().split(/\s+/)[0] || "Investor";
}

function reportPeriodParts(report) {
  const month = Number(report.reportMonth || 0);
  const year = Number(report.reportYear || 0);
  const monthLabel = month ? new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(year || 2026, month - 1, 1)) : "Monthly";
  return { monthLabel, yearLabel: year ? String(year) : "" };
}

function reportMergeFields(report, viewUrl, advisor, branding) {
  const { monthLabel, yearLabel } = reportPeriodParts(report);
  return {
    investor_name: report.investorName || "Investor",
    investor_first_name: firstName(report.investorName),
    report_month: monthLabel,
    report_year: yearLabel,
    report_reference: report.reportCode || "—",
    statement_date: formatDate(report.statementDate),
    advisor_name: advisor.fullName || report.advisorName || `${branding.companyName} Advisor`,
    advisor_designation: advisor.designation || report.advisorDesignation || "",
    advisor_mobile: advisor.mobile || advisor.phone || "",
    advisor_email: advisor.email || report.advisorEmail || "",
    report_url: viewUrl || "",
    company_name: branding.companyName || "GrowVest"
  };
}

function reportTemplateFrame({ report, viewUrl, branding, advisor, template, subjectOverride = "", messageOverride = "" }) {
  const snapshot = createEmailTemplateSnapshot(template);
  const fields = reportMergeFields(report, viewUrl, advisor, branding);
  const content = snapshot.content;
  const design = snapshot.design;
  const header = design.header;
  const typography = design.typography;
  const button = design.button;
  const footer = design.footer;
  const maxWidth = numberBetween(design.maxWidth, 640, 320, 760);
  const borderRadius = numberBetween(design.borderRadius, 18, 0, 32);
  const outerPadding = numberBetween(design.outerPadding, 28, 8, 60);
  const contentPadding = numberBetween(design.contentPadding, 30, 14, 60);
  const headingSize = numberBetween(typography.headingSize, 28, 18, 44);
  const bodySize = numberBetween(typography.bodySize, 15, 12, 20);
  const lineHeight = numberBetween(typography.lineHeight, 1.7, 1.2, 2.2);
  const headerPadding = numberBetween(header.padding, 24, 10, 60);
  const dividerThickness = header.dividerVisible === false ? 0 : numberBetween(header.dividerThickness, 4, 0, 12);
  const logo = branding.emailLogoUrl || branding.primaryLogoUrl || branding.iconLogoUrl || "";
  const logoHtml = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(branding.companyName)}" style="display:inline-block;max-height:${numberBetween(header.logoMaxHeight, 48, 24, 100)}px;max-width:${numberBetween(header.logoMaxWidth, 220, 80, 320)}px;object-fit:contain">`
    : `<strong style="font-size:22px">${escapeHtml(branding.companyName || "GrowVest")}</strong>`;
  const resolvedBody = String(messageOverride || "").trim() || mergeEmailFields(content.body, fields);
  const subject = String(subjectOverride || mergeEmailFields(content.subject, fields)).trim();
  const signatureHtml = advisorSignature(advisor, branding, snapshot.signature);
  const ctaVisible = snapshot.delivery.includeSecureLink !== false && viewUrl;
  const ctaDisplay = button.fullWidth ? "block" : "inline-block";
  const ctaWidth = button.fullWidth ? "width:100%;box-sizing:border-box;" : "";
  const ctaAlign = ["left", "center", "right"].includes(button.alignment) ? button.alignment : "left";
  const headerAlign = header.alignment === "center" ? "center" : "left";
  const tagline = header.showTagline === false ? "" : `<div style="font-size:12px;opacity:.86;margin-top:8px">${escapeHtml(branding.brandPositioning || branding.tagline || "")}</div>`;
  const footerParts = [mergeEmailFields(content.footerText, fields), branding.supportEmail, branding.website].filter(Boolean);

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:${escapeHtml(design.canvasBackground)};font-family:${escapeHtml(typography.bodyFont)};color:${escapeHtml(typography.bodyColor)}"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(mergeEmailFields(content.preheader, fields))}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${escapeHtml(design.canvasBackground)}"><tr><td align="center" style="padding:${outerPadding}px 14px"><table role="presentation" width="${maxWidth}" cellpadding="0" cellspacing="0" style="max-width:${maxWidth}px;width:100%;background:${escapeHtml(design.contentBackground)};border:1px solid ${escapeHtml(footer.borderColor)};border-radius:${borderRadius}px;overflow:hidden"><tr><td align="${headerAlign}" style="padding:${headerPadding}px;background:${escapeHtml(header.backgroundColor)};color:${escapeHtml(header.textColor)}">${logoHtml}${tagline}</td></tr>${dividerThickness ? `<tr><td style="height:${dividerThickness}px;background:${escapeHtml(header.dividerColor)};font-size:0;line-height:0">&nbsp;</td></tr>` : ""}<tr><td style="padding:${contentPadding}px;font-family:${escapeHtml(typography.bodyFont)};color:${escapeHtml(typography.bodyColor)};font-size:${bodySize}px;line-height:${lineHeight}"><p style="margin:0;color:${escapeHtml(header.backgroundColor)};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(mergeEmailFields(content.eyebrow, fields))}</p><h1 style="margin:10px 0 16px;color:${escapeHtml(typography.headingColor)};font-family:${escapeHtml(typography.headingFont)};font-size:${headingSize}px;line-height:1.15">${escapeHtml(mergeEmailFields(content.heading, fields))}</h1><p style="margin:0 0 14px">${escapeHtml(mergeEmailFields(content.greeting, fields))}</p><p style="margin:0;white-space:pre-line">${escapeHtml(resolvedBody)}</p><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;border-collapse:collapse"><tr><td style="padding:8px 0;color:${escapeHtml(typography.mutedColor)};width:160px">Report reference</td><td style="padding:8px 0;font-weight:700">${escapeHtml(fields.report_reference)}</td></tr><tr><td style="padding:8px 0;color:${escapeHtml(typography.mutedColor)}">Statement date</td><td style="padding:8px 0;font-weight:700">${escapeHtml(fields.statement_date)}</td></tr><tr><td style="padding:8px 0;color:${escapeHtml(typography.mutedColor)}">Advisor</td><td style="padding:8px 0;font-weight:700">${escapeHtml(fields.advisor_name)}</td></tr></table>${ctaVisible ? `<div style="margin-top:24px;text-align:${ctaAlign}"><a href="${escapeHtml(viewUrl)}" style="${ctaWidth}display:${ctaDisplay};background:${escapeHtml(button.backgroundColor)};color:${escapeHtml(button.textColor)};text-decoration:none;padding:12px 18px;border-radius:${numberBetween(button.borderRadius, 10, 0, 30)}px;font-weight:700;text-align:center">${escapeHtml(mergeEmailFields(content.ctaText, fields))}</a></div>` : ""}<p style="margin:24px 0 0;color:${escapeHtml(typography.mutedColor)};font-size:12px;line-height:1.7">${escapeHtml(mergeEmailFields(content.privacyNote, fields))}</p>${signatureHtml}</td></tr><tr><td style="padding:18px ${contentPadding}px;background:${escapeHtml(footer.backgroundColor)};color:${escapeHtml(footer.textColor)};font-size:12px;line-height:1.6;border-top:1px solid ${escapeHtml(footer.borderColor)}">${footerParts.map(escapeHtml).join(" · ")}</td></tr></table></td></tr></table></body></html>`;

  const text = `${subject}\n\n${mergeEmailFields(content.greeting, fields)}\n\n${resolvedBody}\n\n${ctaVisible ? `${mergeEmailFields(content.ctaText, fields)}: ${viewUrl}` : ""}\n\n${mergeEmailFields(content.privacyNote, fields)}`.trim();
  return { subject, html, text, templateSnapshot: snapshot, fields };
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
  const content = `<p style="margin-top:0">Hello ${escapeHtml(personName)},</p><h2 style="font-size:22px;margin:10px 0">${escapeHtml(subjectPrefix)}</h2><p style="line-height:1.7">Your meeting with ${escapeHtml(counterpart)} has been updated.</p>${cancellation}<table cellpadding="0" cellspacing="0" style="width:100%;margin-top:18px;border-collapse:collapse"><tr><td style="padding:9px 0;color:#667085;width:150px">Meeting</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meeting.title)}</td></tr><tr><td style="padding:9px 0;color:#667085">Type</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meetingTypeLabel(meeting.meetingType))}</td></tr><tr><td style="padding:9px 0;color:#667085">Date</td><td style="padding:9px 0;font-weight:700">${escapeHtml(formatDate(meeting.meetingDate))}</td></tr><tr><td style="padding:9px 0;color:#667085">Time</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meeting.startTime)} – ${escapeHtml(meeting.endTime)}</td></tr><tr><td style="padding:9px 0;color:#667085">Mode</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meetingProviderLabel(meeting.meetingProvider))}</td></tr>${meeting.location ? `<tr><td style="padding:9px 0;color:#667085">Location</td><td style="padding:9px 0;font-weight:700">${escapeHtml(meeting.location)}</td></tr>` : ""}</table>${agenda}${eventType !== "meeting_cancelled" ? actionButton("Join / View Meeting", meeting.meetingLink, branding) : ""}`;
  return { subject, html: frame(content, { branding, advisor }), text: `${subject}\n${meeting.title}\n${formatDate(meeting.meetingDate)} ${meeting.startTime}-${meeting.endTime}\n${meeting.meetingLink || meeting.location || ""}` };
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
  return reportTemplateFrame({
    report,
    viewUrl,
    branding,
    advisor,
    template: options.emailTemplate,
    subjectOverride: options.subjectOverride,
    messageOverride: options.messageOverride
  });
}
