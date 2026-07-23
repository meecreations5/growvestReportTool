"use client";

import { useBranding } from "@/contexts/BrandingContext";
import { resolveReportTemplate } from "@/lib/constants/reportTemplates";
import { resolveReportBranding, resolveReportTheme } from "@/lib/utils/reportBranding";

function joinContact(branding) {
  if (branding.showContactInFooter === false) return "";
  return [branding.supportMobile, branding.supportEmail, branding.website].filter(Boolean).join(" · ");
}

export function PdfWatermark({ url, opacity = 4 }) {
  if (!url) return null;
  return <img src={url} alt="" aria-hidden="true" style={{ opacity: Math.min(0.15, Math.max(0, Number(opacity || 0) / 100)) }} className="report-print-watermark" />;
}

export function PdfHeader({ title, compact = false, branding }) {
  const logo = branding.pdfLogoUrl || branding.primaryLogoUrl || branding.emailLogoUrl || branding.iconLogoUrl;
  return (
    <>
      <header className={`pdf-document-header ${compact ? "is-compact" : ""}`}>
        <div className="min-w-0">
          {title ? <p className="pdf-document-name">{title}</p> : null}
          <p className="pdf-document-legal">{branding.legalName || "GrowVest Advisors Private Limited"}</p>
        </div>
        {logo ? <img src={logo} alt={`${branding.companyName || "GrowVest"} logo`} className="pdf-document-logo" /> : <div className="pdf-document-wordmark">{branding.companyName || "GrowVest"}</div>}
      </header>
      <div className="pdf-document-rule" />
    </>
  );
}

export function PdfFooter({ report, number, branding, documentSettings = {} }) {
  const icon = branding.footerLogoUrl || branding.iconLogoUrl;
  const showContact = documentSettings.showContactInformation !== false;
  const contact = showContact ? joinContact(branding) : "";
  const showPageNumbers = documentSettings.showPageNumbers !== false && branding.showPageNumbers !== false;
  const showClientCode = documentSettings.showClientCode !== false;
  const showReportMonth = documentSettings.showReportMonth !== false;
  const showConfidential = documentSettings.showConfidentialLabel !== false && branding.showConfidentialLabel !== false;
  const reportPeriod = [
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(report?.reportMonth) - 1],
    report?.reportYear
  ].filter(Boolean).join(" ");
  const footerMeta = [
    showConfidential ? (branding.confidentialLabel || "Confidential") : "",
    showClientCode ? (report?.clientCode || "Client document") : "",
    showReportMonth ? reportPeriod : "",
    showPageNumbers ? `Page ${String(number).padStart(2, "0")}` : ""
  ].filter(Boolean).join(" · ");

  return (
    <footer className="report-print-footer pdf-document-footer">
      <div className="pdf-footer-brand">
        {icon ? <img src={icon} alt="" aria-hidden="true" className="pdf-footer-icon" /> : null}
        <div>
          <strong>{branding.legalName || "GrowVest Advisors Private Limited"}</strong>
          {branding.showFooterTagline === false ? null : <span>{branding.documentFooterTagline || "Grow and Invest with Us"}</span>}
        </div>
      </div>
      <div className="pdf-footer-meta">
        {contact ? <span>{contact}</span> : null}
        <span>{footerMeta}</span>
      </div>
    </footer>
  );
}

export function PdfPage({ report, number, children, title = "", documentTitle = "Monthly Wealth Progress Report", compactHeader = false, className = "" }) {
  const { branding: liveBranding } = useBranding();
  const branding = resolveReportBranding(report, liveBranding);
  const template = resolveReportTemplate(report);
  const theme = resolveReportTheme(report, branding, template);
  const documentSettings = template.appearance?.document || {};
  return (
    <section
      className={`report-print-page ${className}`}
      style={{
        "--report-primary": theme.primaryColor,
        "--report-secondary": theme.secondaryColor,
        "--report-dark": theme.darkColor,
        "--report-danger": theme.dangerColor,
        "--report-warning": theme.warningColor,
        "--report-surface": theme.surfaceColor,
        "--report-muted": theme.mutedColor
      }}
    >
      <PdfWatermark url={branding.watermarkUrl} opacity={branding.watermarkOpacity} />
      <PdfHeader title={documentTitle} compact={compactHeader} branding={branding} />
      {title ? <h2 className="report-print-title"><span />{title}</h2> : null}
      <div className="report-print-content">{children}</div>
      <PdfFooter report={report} number={number} branding={branding} documentSettings={documentSettings} />
    </section>
  );
}
