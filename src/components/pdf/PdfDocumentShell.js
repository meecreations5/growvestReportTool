"use client";

import { useBranding } from "@/contexts/BrandingContext";

function joinContact(branding) {
  if (branding.showContactInFooter === false) return "";
  return [branding.supportMobile, branding.supportEmail, branding.website].filter(Boolean).join(" · ");
}

export function PdfWatermark({ url, opacity = 4 }) {
  if (!url) return null;
  return <img src={url} alt="" aria-hidden="true" style={{ opacity: Math.min(0.15, Math.max(0, Number(opacity || 0) / 100)) }} className="report-print-watermark" />;
}

export function PdfHeader({ title, compact = false }) {
  const { branding } = useBranding();
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

export function PdfFooter({ report, number, documentTitle }) {
  const { branding } = useBranding();
  const icon = branding.footerLogoUrl || branding.iconLogoUrl;
  const contact = joinContact(branding);
  const footerMeta = [
    branding.showConfidentialLabel === false ? "" : (branding.confidentialLabel || "Confidential"),
    report?.clientCode || "Client document",
    documentTitle,
    branding.showPageNumbers === false ? "" : `Page ${String(number).padStart(2, "0")}`
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
  const { branding } = useBranding();
  return (
    <section className={`report-print-page ${className}`} style={{ "--report-primary": branding.primaryColor, "--report-secondary": branding.secondaryColor }}>
      <PdfWatermark url={branding.watermarkUrl} opacity={branding.watermarkOpacity} />
      <PdfHeader title={documentTitle} compact={compactHeader} />
      {title ? <h2 className="report-print-title"><span />{title}</h2> : null}
      <div className="report-print-content">{children}</div>
      <PdfFooter report={report} number={number} documentTitle={documentTitle} />
    </section>
  );
}
