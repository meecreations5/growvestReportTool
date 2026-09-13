"use client";

import { useBranding } from "@/contexts/BrandingContext";
import { getLockedGrowVestSignatureTemplate, resolveReportTemplate } from "@/lib/constants/reportTemplates";
import { resolveReportBranding, resolveReportTheme } from "@/lib/utils/reportBranding";

function joinContact(branding) {
  if (branding.showContactInFooter === false) return "";
  return [branding.supportMobile, branding.supportEmail, branding.website].filter(Boolean).join(" · ");
}

function reportPeriodLabel(report = {}) {
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(report?.reportMonth) - 1] || "";
  return report?.reportType === "opening"
    ? [month, report?.reportYear].filter(Boolean).join(" ")
    : [month, report?.reportYear].filter(Boolean).join(" ");
}

function reportDocumentLabel(report = {}) {
  return report?.reportType === "opening" ? "Opening Wealth Review" : "Monthly Wealth Review";
}

export function PdfWatermark({ url, opacity = 4 }) {
  if (!url) return null;
  return <img src={url} alt="" aria-hidden="true" style={{ opacity: Math.min(0.15, Math.max(0, Number(opacity || 0) / 100)) }} className="report-print-watermark" />;
}

export function PdfHeader({ title, compact = false, branding, headerStyle = "compact", report = {} }) {
  const logo = branding.pdfLogoUrl || branding.primaryLogoUrl || branding.emailLogoUrl || branding.iconLogoUrl;
  if (headerStyle === "signature") {
    return (
      <>
        <header className="pdf-document-header pdf-document-header-signature is-compact">
          <div className="pdf-signature-brand">
            {logo ? <img src={logo} alt={`${branding.companyName || "GrowVest"} logo`} className="pdf-document-logo pdf-document-logo-signature" /> : <div className="pdf-signature-wordmark"><span aria-hidden="true">◆</span><strong>{branding.companyName || "GrowVest"}</strong></div>}
            <span className="pdf-signature-positioning">{branding.brandPositioning || "Your Conscious Wealth Partner"}</span>
          </div>
          <div className="pdf-signature-report-meta">
            <strong>{title || reportDocumentLabel(report)}</strong>
            <span>{reportPeriodLabel(report)}</span>
          </div>
        </header>
        <div className="pdf-document-rule pdf-document-rule-signature" />
      </>
    );
  }
  return (
    <>
      <header className={`pdf-document-header pdf-document-header-${headerStyle} ${compact ? "is-compact" : ""}`}>
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

export function PdfFooter({ report, number, branding, documentSettings = {}, footerStyle = "legal" }) {
  const icon = branding.footerLogoUrl || branding.iconLogoUrl;
  const showContact = documentSettings.showContactInformation !== false;
  const contact = showContact ? joinContact(branding) : "";
  const showPageNumbers = documentSettings.showPageNumbers !== false && branding.showPageNumbers !== false;
  const showClientCode = documentSettings.showClientCode !== false;
  const showReportMonth = documentSettings.showReportMonth !== false;
  const showConfidential = documentSettings.showConfidentialLabel !== false && branding.showConfidentialLabel !== false;
  const reportPeriod = reportPeriodLabel(report);

  if (footerStyle === "signature") {
    const left = [branding.companyName || "GrowVest", showConfidential ? "Private & Confidential" : ""].filter(Boolean).join(" | ");
    const right = [showReportMonth ? reportPeriod : "", showPageNumbers ? String(number) : ""].filter(Boolean).join("  ");
    return (
      <footer className="report-print-footer pdf-document-footer pdf-document-footer-signature">
        <span>{left}</span>
        <span>{right}</span>
      </footer>
    );
  }

  const footerMeta = [
    showConfidential ? (branding.confidentialLabel || "Confidential") : "",
    showClientCode ? (report?.clientCode || "Client document") : "",
    showReportMonth ? reportPeriod : "",
    showPageNumbers ? `Page ${String(number).padStart(2, "0")}` : ""
  ].filter(Boolean).join(" · ");

  return (
    <footer className={`report-print-footer pdf-document-footer pdf-document-footer-${footerStyle}`}>
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

export function PdfPage({ report, number, children, title = "", documentTitle = "", compactHeader = false, className = "", hideHeader = false, hideFooter = false }) {
  const { branding: liveBranding } = useBranding();
  const branding = resolveReportBranding(report, liveBranding);
  const resolvedTemplate = resolveReportTemplate(report);
  const signaturePage = String(className || "").split(/\s+/).includes("report-signature-page");
  const template = signaturePage ? getLockedGrowVestSignatureTemplate() : resolvedTemplate;
  const theme = resolveReportTheme(report, branding, template);
  const documentSettings = template.appearance?.document || {};
  const effectiveDocumentTitle = documentTitle || reportDocumentLabel(report);
  return (
    <section
      className={`report-print-page report-heading-${template.appearance?.headingStyle || "brand"} report-header-${template.appearance?.headerStyle || "compact"} report-footer-${template.appearance?.footerStyle || "legal"} report-table-density-${template.appearance?.tableDensity || "comfortable"} report-chart-${template.appearance?.chartStyle || "modern"} ${className}`}
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
      {hideHeader ? null : <PdfHeader title={effectiveDocumentTitle} report={report} compact={compactHeader || template.appearance?.headerStyle === "compact"} branding={branding} headerStyle={template.appearance?.headerStyle || "compact"} />}
      {title ? <h2 className="report-print-title"><span />{title}</h2> : null}
      <div className="report-print-content">{children}</div>
      {hideFooter ? null : <PdfFooter report={report} number={number} branding={branding} documentSettings={documentSettings} footerStyle={template.appearance?.footerStyle || "legal"} />}
    </section>
  );
}
