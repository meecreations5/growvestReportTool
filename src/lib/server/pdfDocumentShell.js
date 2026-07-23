import { rgb } from "pdf-lib";
import { resolveReportBranding } from "@/lib/utils/reportBranding";

export const PDF_A4_WIDTH = 595.28;
export const PDF_A4_HEIGHT = 841.89;
export const PDF_MARGIN = 44;

const DEFAULT_BLUE = rgb(0.12, 0.31, 0.82);
const DEFAULT_CYAN = rgb(0.09, 0.73, 0.83);
const INK = rgb(0.04, 0.04, 0.06);
const MUTED = rgb(0.42, 0.45, 0.5);

export function pdfSafeText(value) {
  return String(value ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00b7/g, "|")
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

export function pdfHexColor(value, fallback = DEFAULT_BLUE) {
  const text = String(value || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(text)) return fallback;
  return rgb(
    parseInt(text.slice(0, 2), 16) / 255,
    parseInt(text.slice(2, 4), 16) / 255,
    parseInt(text.slice(4, 6), 16) / 255
  );
}

function monthLabel(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1] || "";
}

export function drawPdfImageFit(page, image, { x, y, maxWidth, maxHeight, align = "left", valign = "bottom", opacity = 1 } = {}) {
  if (!image) return { width: 0, height: 0, x, y };
  const natural = image.scale(1);
  const ratio = Math.min(maxWidth / natural.width, maxHeight / natural.height, 1);
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  const drawX = align === "right" ? x + maxWidth - width : align === "center" ? x + (maxWidth - width) / 2 : x;
  const drawY = valign === "top" ? y + maxHeight - height : valign === "center" ? y + (maxHeight - height) / 2 : y;
  page.drawImage(image, { x: drawX, y: drawY, width, height, opacity });
  return { width, height, x: drawX, y: drawY };
}

function drawWatermark(page, report, branding) {
  const image = report.__brandingAssets?.watermark;
  if (!image) return;
  const natural = image.scale(1);
  const ratio = Math.min(340 / natural.width, 290 / natural.height, 1);
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  const opacity = Math.min(0.15, Math.max(0, Number(branding.watermarkOpacity || 4) / 100));
  page.drawImage(image, {
    x: (PDF_A4_WIDTH - width) / 2,
    y: (PDF_A4_HEIGHT - height) / 2 - 18,
    width,
    height,
    opacity
  });
}

function fitText(font, text, preferredSize, maxWidth, minimumSize = 5.2) {
  let size = preferredSize;
  while (size > minimumSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
  return size;
}

export function drawPdfDocumentChrome(page, fonts, report, pageNo, options = {}) {
  const { bold, regular, italic } = fonts;
  const branding = resolveReportBranding(report, report.branding || {});
  const primary = pdfHexColor(options.primaryColor || branding.primaryColor, DEFAULT_BLUE);
  const secondary = pdfHexColor(options.secondaryColor || branding.secondaryColor, DEFAULT_CYAN);
  const documentTitle = options.documentTitle || "Monthly Wealth Progress Report";
  const showLogo = options.showLogo !== false;
  const showClientCode = options.showClientCode !== false;
  const showReportMonth = options.showReportMonth !== false;
  const showPageNumbers = options.showPageNumbers !== false && branding.showPageNumbers !== false;
  const showContact = options.showContactInformation !== false && branding.showContactInFooter !== false;
  const showConfidential = options.showConfidentialLabel !== false && branding.showConfidentialLabel !== false;
  const totalPages = Number(options.totalPages || 0);
  drawWatermark(page, report, branding);

  page.drawText(pdfSafeText(documentTitle).toUpperCase(), { x: PDF_MARGIN, y: 817, size: 7.5, font: bold, color: primary });
  page.drawText(pdfSafeText(branding.legalName || "GrowVest Advisors Private Limited").toUpperCase(), { x: PDF_MARGIN, y: 805, size: 6.5, font: regular, color: MUTED });
  const logo = report.__brandingAssets?.logo;
  if (showLogo && logo) {
    drawPdfImageFit(page, logo, { x: 350, y: 798, maxWidth: 201, maxHeight: 38, align: "right", valign: "top" });
  } else if (showLogo) {
    const wordmark = pdfSafeText(branding.companyName || "GrowVest");
    const size = fitText(bold, wordmark, 14, 150, 9);
    const width = bold.widthOfTextAtSize(wordmark, size);
    page.drawText(wordmark, { x: 551 - width, y: 807, size, font: bold, color: INK });
  }

  page.drawRectangle({ x: PDF_MARGIN, y: 792, width: 370, height: 2.5, color: primary });
  page.drawRectangle({ x: PDF_MARGIN + 370, y: 792, width: 137, height: 2.5, color: secondary });

  page.drawLine({ start: { x: PDF_MARGIN, y: 38 }, end: { x: 551, y: 38 }, thickness: 0.55, color: rgb(0.84, 0.86, 0.89) });
  const icon = report.__brandingAssets?.icon;
  if (icon) drawPdfImageFit(page, icon, { x: PDF_MARGIN, y: 10, maxWidth: 22, maxHeight: 22, valign: "center" });
  const footerX = icon ? PDF_MARGIN + 29 : PDF_MARGIN;
  const legal = pdfSafeText(branding.legalName || "GrowVest Advisors Private Limited").toUpperCase();
  const legalSize = fitText(bold, legal, 6.4, 225, 5.2);
  page.drawText(legal, { x: footerX, y: 25, size: legalSize, font: bold, color: INK });
  if (branding.showFooterTagline !== false) {
    const tagline = pdfSafeText(branding.documentFooterTagline || "Grow and Invest with Us");
    const taglineSize = fitText(italic || regular, tagline, 6, 225, 5);
    page.drawText(tagline, { x: footerX, y: 14, size: taglineSize, font: italic || regular, color: MUTED });
  }

  const contact = showContact ? [branding.supportMobile, branding.supportEmail, branding.website].filter(Boolean).join(" - ") : "";
  const reportMeta = [
    showConfidential ? (branding.confidentialLabel || "Confidential") : "",
    showClientCode ? pdfSafeText(report.clientCode || "Client document") : "",
    showReportMonth ? `${monthLabel(report.reportMonth)} ${report.reportYear || ""}`.trim() : "",
    showPageNumbers ? `Page ${String(pageNo).padStart(2, "0")}${totalPages ? ` of ${String(totalPages).padStart(2, "0")}` : ""}` : ""
  ].filter(Boolean).join(" | ");

  const rightWidth = 270;
  if (contact) {
    const text = pdfSafeText(contact);
    const size = fitText(regular, text, 5.7, rightWidth, 4.8);
    const width = regular.widthOfTextAtSize(text, size);
    page.drawText(text, { x: 551 - width, y: 25, size, font: regular, color: MUTED });
  }
  if (reportMeta) {
    const text = pdfSafeText(reportMeta);
    const size = fitText(regular, text, 5.7, rightWidth, 4.7);
    const width = regular.widthOfTextAtSize(text, size);
    page.drawText(text, { x: 551 - width, y: 14, size, font: regular, color: MUTED });
  }
}
