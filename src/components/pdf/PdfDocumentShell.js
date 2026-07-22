"use client";

import { useBranding } from "@/contexts/BrandingContext";

function joinContact(branding) {
  return [branding.supportMobile, branding.supportEmail, branding.website].filter(Boolean).join(" · ");
}

export function PdfWatermark({ url }) {
  if (!url) return null;
  return <img src={url} alt="" aria-hidden="true" className="report-print-watermark" />;
}

export function PdfHeader({ title, compact = false }) {
  const { branding } = useBranding();
  const logo = branding.primaryLogoUrl || branding.emailLogoUrl || branding.iconLogoUrl;
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
  const icon = branding.iconLogoUrl;
  return (
    <footer className="report-print-footer pdf-document-footer">
      <div className="pdf-footer-brand">
        {icon ? <img src={icon} alt="" aria-hidden="true" className="pdf-footer-icon" /> : null}
        <div>
          <strong>{branding.legalName || "GrowVest Advisors Private Limited"}</strong>
          <span>{branding.documentFooterTagline || "Grow and Invest with Us"}</span>
        </div>
      </div>
      <div className="pdf-footer-meta">
        <span>{joinContact(branding)}</span>
        <span>Confidential · {report?.clientCode || "Client document"} · {documentTitle} · Page {String(number).padStart(2, "0")}</span>
      </div>
    </footer>
  );
}

export function PdfPage({ report, number, children, title = "", documentTitle = "Monthly Wealth Progress Report", compactHeader = false, className = "" }) {
  const { branding } = useBranding();
  return (
    <section className={`report-print-page ${className}`} style={{ "--report-primary": branding.primaryColor, "--report-secondary": branding.secondaryColor }}>
      <PdfWatermark url={branding.watermarkUrl} />
      <PdfHeader title={documentTitle} compact={compactHeader} />
      {title ? <h2 className="report-print-title"><span />{title}</h2> : null}
      <div className="report-print-content">{children}</div>
      <PdfFooter report={report} number={number} documentTitle={documentTitle} />
    </section>
  );
}
