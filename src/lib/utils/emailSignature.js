import {
  DEFAULT_EMAIL_SIGNATURE,
  DEFAULT_EMAIL_SIGNATURE_VISIBILITY
} from "@/lib/constants/emailSignature";

export function escapeSignatureHtml(value = "") {
  return String(value).replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);
}

function safeWebFontUrl(value = "") {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

export function safeSignatureUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(url)) return url;
  return "";
}

function safeExternalUrl(value = "") {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

export function getSignatureSocialLinks(branding = {}) {
  if (branding.signatureSocialEnabled === false) return [];
  return [
    { key: "linkedin", label: "LinkedIn", shortLabel: "in", url: safeExternalUrl(branding.signatureLinkedInUrl) },
    { key: "instagram", label: "Instagram", shortLabel: "ig", url: safeExternalUrl(branding.signatureInstagramUrl) },
    { key: "facebook", label: "Facebook", shortLabel: "f", url: safeExternalUrl(branding.signatureFacebookUrl) },
    { key: "youtube", label: "YouTube", shortLabel: "▶", url: safeExternalUrl(branding.signatureYouTubeUrl) },
    { key: "x", label: "X", shortLabel: "X", url: safeExternalUrl(branding.signatureXUrl) }
  ].filter((item) => item.url);
}

export function splitSignatureName(fullName = "", displaySurname = "") {
  const cleaned = String(fullName || "").trim();
  if (!cleaned) return { givenName: "GrowVest", surname: "Advisor" };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const surname = String(displaySurname || "").trim() || (parts.length > 1 ? parts.pop() : "");
  const givenName = parts.join(" ") || cleaned;
  return { givenName, surname };
}

export function normaliseEmailSignature(signature = {}, user = {}, branding = {}) {
  const merged = {
    ...DEFAULT_EMAIL_SIGNATURE,
    ...(signature || {}),
    visibility: {
      ...DEFAULT_EMAIL_SIGNATURE_VISIBILITY,
      ...(signature?.visibility || {})
    }
  };

  return {
    ...merged,
    enabled: merged.enabled !== false,
    fullName: String(merged.fullName || user.fullName || user.name || "GrowVest Advisor").trim(),
    displaySurname: String(merged.displaySurname || "").trim(),
    designation: String(merged.designation || user.designation || "Relationship Advisor").trim(),
    department: String(merged.department || user.department || "").trim(),
    brandPositioning: String(merged.brandPositioning || branding.signatureBrandPositioning || branding.brandPositioning || "Your Conscious Wealth Partner").trim(),
    email: String(merged.email || user.email || "").trim(),
    mobile: String(merged.mobile || user.mobile || branding.supportMobile || "").trim(),
    website: String(merged.website || branding.signatureWebsite || branding.website || "").trim(),
    officeAddress: String(merged.officeAddress || branding.signatureAddress || branding.address || "").trim(),
    footerLeftText: String(merged.footerLeftText || branding.signatureFooterLeftText || "Fulfill Your Bucketlist").trim(),
    footerRightText: String(merged.footerRightText || branding.signatureFooterRightText || "Experience the Wealth Every Moment").trim(),
    handwrittenNameUrl: safeSignatureUrl(merged.handwrittenNameUrl),
    fullSignatureImageUrl: safeSignatureUrl(merged.fullSignatureImageUrl)
  };
}

function contactRow(icon, value, color) {
  if (!value) return "";
  return `<tr>
    <td width="26" valign="top" style="padding:3px 8px 3px 0;color:${escapeSignatureHtml(color)};font-size:15px;line-height:20px">${icon}</td>
    <td valign="top" style="padding:3px 0;color:#172033;font-family:'Open Sauce One',Arial,sans-serif;font-size:14px;line-height:20px;overflow-wrap:anywhere">${escapeSignatureHtml(value)}</td>
  </tr>`;
}

function renderFullImageSignature(signature) {
  const image = safeSignatureUrl(signature.fullSignatureImageUrl);
  if (!image) return "";
  return `<div data-growvest-signature="full-image" style="margin-top:28px">
    <img src="${escapeSignatureHtml(image)}" alt="${escapeSignatureHtml(signature.fullName)} email signature" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none">
  </div>`;
}

function renderSocialLinks(branding, primary) {
  const links = getSignatureSocialLinks(branding);
  if (!links.length) return "";
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:10px;border-collapse:collapse"><tr>${links.map((item) => `<td style="padding:0 6px 0 0"><a href="${escapeSignatureHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeSignatureHtml(item.label)}" style="display:inline-block;min-width:25px;height:25px;padding:0 5px;border:1px solid ${escapeSignatureHtml(primary)};border-radius:13px;color:${escapeSignatureHtml(primary)};font-family:Arial,sans-serif;font-size:10px;font-weight:700;line-height:23px;text-align:center;text-decoration:none;box-sizing:border-box">${escapeSignatureHtml(item.shortLabel)}</a></td>`).join("")}</tr></table>`;
}

export function renderWhatsAppSignatureText({ signature: rawSignature = {}, user = {}, branding = {} } = {}) {
  const signature = normaliseEmailSignature(rawSignature, user, branding);
  if (!signature.enabled) return "";

  const lines = [signature.fullName];
  const roleLine = [
    signature.visibility.designation ? signature.designation : "",
    signature.visibility.brandPositioning ? signature.brandPositioning : ""
  ].filter(Boolean).join(" | ");
  if (roleLine) lines.push(roleLine);

  if (signature.visibility.email && signature.email) lines.push(`Email: ${signature.email}`);
  if (signature.visibility.mobile && signature.mobile) lines.push(`Mobile / WhatsApp: ${signature.mobile}`);
  if (signature.visibility.website && signature.website) lines.push(`Web: ${signature.website}`);
  if (signature.visibility.address && signature.officeAddress) lines.push(`Office: ${signature.officeAddress}`);

  const company = branding.legalName || branding.companyName || "GrowVest";
  if (signature.visibility.companyLogo && company) lines.push(company);

  if (signature.visibility.socialMedia !== false) {
    getSignatureSocialLinks(branding).forEach((item) => lines.push(`${item.label}: ${item.url}`));
  }

  return lines.join("\n");
}

export function renderEmailSignatureHtml({ signature: rawSignature = {}, user = {}, branding = {}, previewMode = "desktop" } = {}) {
  const signature = normaliseEmailSignature(rawSignature, user, branding);
  if (!signature.enabled) return "";
  if (signature.mode === "full_image") {
    const fullImage = renderFullImageSignature(signature);
    if (fullImage) return fullImage;
  }

  const forceMobile = previewMode === "mobile";
  const scriptFontUrl = safeWebFontUrl(branding.signatureScriptFontUrl);
  const primary = branding.primaryColor || "#1F4ED8";
  const dark = branding.darkColor || "#0B0B0F";
  const logo = safeSignatureUrl(
    branding.signatureLogoUrl
      || branding.emailLogoUrl
      || branding.primaryLogoUrl
      || branding.logoUrl
      || ""
  );
  const signatureIcon = signature.visibility.watermark
    ? safeSignatureUrl(
      branding.signatureIconUrl
        || branding.footerLogoUrl
        || branding.iconLogoUrl
        || branding.watermarkUrl
        || ""
    )
    : "";
  const { givenName, surname } = splitSignatureName(signature.fullName, signature.displaySurname);
  const handwritten = safeSignatureUrl(signature.handwrittenNameUrl);
  const nameHtml = handwritten && signature.mode === "hybrid"
    ? `<img src="${escapeSignatureHtml(handwritten)}" alt="${escapeSignatureHtml(givenName)}" style="display:inline-block;max-width:250px;max-height:68px;width:auto;height:auto;vertical-align:middle">${surname ? `<strong style="display:inline-block;margin-left:8px;color:${escapeSignatureHtml(dark)};font-family:'League Spartan','Arial Black',Arial,sans-serif;font-size:29px;line-height:34px;font-weight:700;vertical-align:middle">${escapeSignatureHtml(surname)}</strong>` : ""}`
    : `<span style="color:#E53935;font-family:'Emitha','Segoe Script','Brush Script MT',cursive;font-size:31px;line-height:36px;font-weight:400">${escapeSignatureHtml(givenName)}</span>${surname ? ` <strong style="color:${escapeSignatureHtml(dark)};font-family:'League Spartan','Arial Black',Arial,sans-serif;font-size:28px;line-height:34px;font-weight:700">${escapeSignatureHtml(surname)}</strong>` : ""}`;

  const designation = signature.visibility.designation && signature.designation
    ? `<div style="margin-top:4px;color:#172033;font-family:'Open Sauce One',Arial,sans-serif;font-size:15px;line-height:22px">${escapeSignatureHtml(signature.designation)}${signature.visibility.brandPositioning && signature.brandPositioning ? ` <em style="color:#737A86">${escapeSignatureHtml(signature.brandPositioning)}</em>` : ""}</div>`
    : "";

  const logoContent = signature.visibility.companyLogo && logo
    ? `<img src="${escapeSignatureHtml(logo)}" alt="${escapeSignatureHtml(branding.companyName || "GrowVest")}" width="160" style="display:inline-block;width:100%;max-width:160px;height:auto;max-height:64px;object-fit:contain">`
    : `<strong style="font-family:'League Spartan','Arial Black',Arial,sans-serif;font-size:24px;color:${escapeSignatureHtml(dark)}">${escapeSignatureHtml(branding.companyName || "GrowVest")}</strong>`;

  const addressContent = signature.visibility.address && signature.officeAddress
    ? escapeSignatureHtml(signature.officeAddress).replace(/,\s*/g, ",<br>")
    : escapeSignatureHtml(branding.legalName || branding.companyName || "GrowVest");

  const contactRows = [
    signature.visibility.email ? contactRow("✉", signature.email, primary) : "",
    signature.visibility.website ? contactRow("◎", signature.website, primary) : "",
    signature.visibility.mobile ? contactRow("☎", signature.mobile, primary) : ""
  ].join("") || contactRow("✉", branding.supportEmail || "", primary);
  const socialLinks = signature.visibility.socialMedia !== false ? renderSocialLinks(branding, primary) : "";

  const desktopDetails = `<tr class="gv-signature-details-row">
    <td class="gv-signature-block gv-signature-logo" width="30%" valign="middle" style="padding:22px;text-align:center;box-sizing:border-box">${logoContent}</td>
    <td class="gv-signature-block gv-signature-address" width="34%" valign="middle" style="padding:0 22px;border-left:2px dotted #98A2B3;border-right:2px dotted #98A2B3;color:#667085;font-family:'Open Sauce One',Arial,sans-serif;font-size:13px;line-height:20px;box-sizing:border-box">${addressContent}</td>
    <td class="gv-signature-block gv-signature-contact" width="36%" valign="middle" style="padding:18px 20px;box-sizing:border-box"><table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">${contactRows}</table>${socialLinks}</td>
  </tr>`;

  const mobileDetails = `<tr><td colspan="3" style="padding:16px;text-align:left;border-top:1px solid #E4E7EC;box-sizing:border-box">${logoContent}</td></tr>
    <tr><td colspan="3" style="padding:14px 16px;border-top:1px solid #E4E7EC;color:#667085;font-family:'Open Sauce One',Arial,sans-serif;font-size:13px;line-height:20px;box-sizing:border-box">${addressContent}</td></tr>
    <tr><td colspan="3" style="padding:14px 16px;border-top:1px solid #E4E7EC;box-sizing:border-box"><table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">${contactRows}</table>${socialLinks}</td></tr>`;

  const footer = signature.visibility.footer
    ? forceMobile
      ? `<tr><td colspan="3" style="padding:0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${escapeSignatureHtml(dark)}"><tr><td style="padding:9px 14px 4px;color:#fff;font-family:'Open Sauce One',Arial,sans-serif;font-size:11px;font-style:italic;line-height:16px">${escapeSignatureHtml(signature.footerLeftText)}</td></tr><tr><td style="padding:4px 14px 9px;color:#fff;font-family:'Open Sauce One',Arial,sans-serif;font-size:11px;font-style:italic;line-height:16px;text-align:right">${escapeSignatureHtml(signature.footerRightText)}</td></tr></table></td></tr>`
      : `<tr><td colspan="3" style="padding:0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${escapeSignatureHtml(dark)}"><tr><td class="gv-signature-footer-cell" style="padding:10px 16px;color:#fff;font-family:'Open Sauce One',Arial,sans-serif;font-size:12px;font-style:italic;line-height:18px">${escapeSignatureHtml(signature.footerLeftText)}</td><td class="gv-signature-footer-cell" align="right" style="padding:10px 16px;color:#fff;font-family:'Open Sauce One',Arial,sans-serif;font-size:12px;font-style:italic;line-height:18px">${escapeSignatureHtml(signature.footerRightText)}</td></tr></table></td></tr>`
    : "";

  return `<div data-growvest-signature="structured" style="margin-top:28px;max-width:${forceMobile ? "354px" : "640px"}">
    <style>${scriptFontUrl ? `@font-face{font-family:'Emitha';src:url('${escapeSignatureHtml(scriptFontUrl)}') format('${scriptFontUrl.toLowerCase().includes(".woff2") ? "woff2" : "woff"}');font-style:normal;font-weight:400;font-display:swap}` : ""}@media only screen and (max-width:520px){.gv-signature-details-row,.gv-signature-block,.gv-signature-footer-cell{display:block!important;width:100%!important;box-sizing:border-box!important}.gv-signature-block{border-left:0!important;border-right:0!important;border-top:1px solid #E4E7EC!important;padding:14px 16px!important}.gv-signature-logo{text-align:left!important}.gv-signature-footer-cell{text-align:left!important;padding:7px 14px!important}.gv-signature-footer-cell+ .gv-signature-footer-cell{text-align:right!important}}</style>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:${forceMobile ? "354px" : "640px"};border-collapse:collapse;border:1px solid #E4E7EC;background:#fff">
      <tr>
        <td colspan="3" style="position:relative;padding:${forceMobile ? "18px 16px 15px" : "20px 22px 17px"};background:#fff;box-sizing:border-box">
          ${signatureIcon ? `<img src="${escapeSignatureHtml(signatureIcon)}" alt="" width="105" style="display:block;position:absolute;right:18px;top:12px;width:${forceMobile ? "86px" : "105px"};max-height:92px;object-fit:contain;opacity:.12">` : ""}
          <div style="position:relative;z-index:1">${nameHtml}${designation}</div>
        </td>
      </tr>
      ${forceMobile ? mobileDetails : desktopDetails}
      ${footer}
    </table>
  </div>`;
}
