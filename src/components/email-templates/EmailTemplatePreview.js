"use client";

import { useMemo } from "react";
import { useBranding } from "@/contexts/BrandingContext";
import {
  createEmailTemplateSnapshot,
  defaultEmailTemplatePreviewFields,
  mergeEmailFields
} from "@/lib/constants/emailTemplates";
import { renderEmailSignatureHtml } from "@/lib/utils/emailSignature";

function signatureVisibility(template) {
  const visibility = template.signature?.visibility || {};
  return {
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
  };
}

export default function EmailTemplatePreview({ template: value, mode = "desktop" }) {
  const { branding } = useBranding();
  const template = useMemo(() => createEmailTemplateSnapshot(value), [value]);
  const fields = defaultEmailTemplatePreviewFields();
  const content = template.content;
  const design = template.design;
  const header = design.header;
  const typography = design.typography;
  const button = design.button;
  const logo = branding.emailLogoUrl || branding.primaryLogoUrl || branding.iconLogoUrl || "";
  const width = mode === "mobile" ? 354 : Math.min(Number(design.maxWidth || 640), 760);
  const signatureHtml = template.signature?.enabled && template.signature?.source !== "none"
    ? renderEmailSignatureHtml({
      signature: {
        enabled: true,
        mode: "responsive_html",
        fullName: fields.advisor_name,
        designation: fields.advisor_designation,
        email: fields.advisor_email,
        mobile: fields.advisor_mobile,
        website: branding.signatureWebsite || branding.website,
        officeAddress: branding.signatureAddress || branding.address,
        brandPositioning: branding.signatureBrandPositioning || branding.brandPositioning,
        visibility: signatureVisibility(template)
      },
      user: {},
      branding,
      previewMode: mode
    })
    : "";

  return (
    <div className="mx-auto w-full overflow-hidden shadow-lg" style={{ maxWidth: width, background: design.contentBackground, borderRadius: design.borderRadius, border: `1px solid ${design.footer?.borderColor || "#E4E9F2"}` }}>
      <div style={{ background: header.backgroundColor, color: header.textColor, padding: header.padding, textAlign: header.alignment }}>
        {logo ? <img src={logo} alt={branding.companyName || "GrowVest"} style={{ display: "inline-block", maxWidth: header.logoMaxWidth, maxHeight: header.logoMaxHeight, objectFit: "contain" }} /> : <strong style={{ fontSize: 22 }}>{branding.companyName || "GrowVest"}</strong>}
        {header.showTagline ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.86 }}>{branding.brandPositioning || branding.tagline}</div> : null}
      </div>
      {header.dividerVisible ? <div style={{ height: header.dividerThickness, background: header.dividerColor }} /> : null}
      <div style={{ padding: mode === "mobile" ? 22 : design.contentPadding, fontFamily: typography.bodyFont, color: typography.bodyColor, fontSize: typography.bodySize, lineHeight: typography.lineHeight }}>
        <p style={{ margin: 0, color: header.backgroundColor, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{mergeEmailFields(content.eyebrow, fields)}</p>
        <h2 style={{ margin: "10px 0 14px", color: typography.headingColor, fontFamily: typography.headingFont, fontSize: mode === "mobile" ? Math.max(22, typography.headingSize - 4) : typography.headingSize, lineHeight: 1.15 }}>{mergeEmailFields(content.heading, fields)}</h2>
        <p style={{ margin: "0 0 14px" }}>{mergeEmailFields(content.greeting, fields)}</p>
        <p style={{ margin: 0 }}>{mergeEmailFields(content.body, fields)}</p>
        {template.delivery?.includeSecureLink !== false ? <div style={{ marginTop: 24, textAlign: button.alignment }}><span style={{ display: button.fullWidth ? "block" : "inline-block", padding: "12px 18px", borderRadius: button.borderRadius, background: button.backgroundColor, color: button.textColor, fontWeight: 700, textAlign: "center" }}>{mergeEmailFields(content.ctaText, fields)}</span></div> : null}
        <p style={{ margin: "24px 0 0", color: typography.mutedColor, fontSize: 12 }}>{mergeEmailFields(content.privacyNote, fields)}</p>
        {signatureHtml ? <div dangerouslySetInnerHTML={{ __html: signatureHtml }} /> : null}
      </div>
      <div style={{ padding: "16px 22px", background: design.footer?.backgroundColor, color: design.footer?.textColor, fontSize: 11, lineHeight: 1.55, borderTop: `1px solid ${design.footer?.borderColor || "#E4E9F2"}` }}>{mergeEmailFields(content.footerText, fields)}<br />{branding.supportEmail} · {branding.website}</div>
    </div>
  );
}
