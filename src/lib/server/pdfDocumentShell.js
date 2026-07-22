import { rgb } from "pdf-lib";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 44;
const DEFAULT_BLUE = rgb(0.12, 0.31, 0.82);
const DEFAULT_CYAN = rgb(0.09, 0.73, 0.83);
const INK = rgb(0.04, 0.04, 0.06);
const MUTED = rgb(0.42, 0.45, 0.5);

function safeText(value) {
  return String(value ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function hexColor(value, fallback) {
  const text = String(value || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(text)) return fallback;
  return rgb(parseInt(text.slice(0, 2), 16) / 255, parseInt(text.slice(2, 4), 16) / 255, parseInt(text.slice(4, 6), 16) / 255);
}

function monthLabel(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1] || "";
}

function drawImageFit(page, image, { x, y, maxWidth, maxHeight, align = "left", opacity = 1 }) {
  if (!image) return;
  const natural = image.scale(1);
  const ratio = Math.min(maxWidth / natural.width, maxHeight / natural.height, 1);
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  const drawX = align === "right" ? x + maxWidth - width : x;
  page.drawImage(image, { x: drawX, y, width, height, opacity });
}

function drawWatermark(page, report) {
  const image = report.__brandingAssets?.watermark;
  if (!image) return;
  const natural = image.scale(1);
  const ratio = Math.min(330 / natural.width, 280 / natural.height, 1);
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  page.drawImage(image, { x: (A4_WIDTH - width) / 2, y: (A4_HEIGHT - height) / 2 - 20, width, height, opacity: 0.045 });
}

export function drawPdfDocumentChrome(page, fonts, report, pageNo, options = {}) {
  const { bold, regular, italic } = fonts;
  const branding = report.branding || {};
  const primary = hexColor(branding.primaryColor, DEFAULT_BLUE);
  const secondary = hexColor(branding.secondaryColor, DEFAULT_CYAN);
  const documentTitle = options.documentTitle || "Monthly Wealth Progress Report";
  drawWatermark(page, report);

  page.drawText(safeText(documentTitle).toUpperCase(), { x: MARGIN, y: 817, size: 7.5, font: bold, color: primary });
  page.drawText(safeText(branding.legalName || "GrowVest Advisors Private Limited").toUpperCase(), { x: MARGIN, y: 805, size: 6.5, font: regular, color: MUTED });
  const logo = report.__brandingAssets?.logo;
  if (logo) drawImageFit(page, logo, { x: 360, y: 800, maxWidth: 191, maxHeight: 34, align: "right" });
  else page.drawText(safeText(branding.companyName || "GrowVest"), { x: 455, y: 807, size: 14, font: bold, color: INK });

  page.drawRectangle({ x: MARGIN, y: 792, width: 370, height: 2.5, color: primary });
  page.drawRectangle({ x: MARGIN + 370, y: 792, width: 137, height: 2.5, color: secondary });

  page.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: 551, y: 34 }, thickness: 0.55, color: rgb(0.84, 0.86, 0.89) });
  const icon = report.__brandingAssets?.icon;
  if (icon) drawImageFit(page, icon, { x: MARGIN, y: 8, maxWidth: 22, maxHeight: 20 });
  const footerX = icon ? MARGIN + 29 : MARGIN;
  page.drawText(safeText(branding.legalName || "GrowVest Advisors Private Limited").toUpperCase(), { x: footerX, y: 22, size: 6.4, font: bold, color: INK });
  page.drawText(safeText(branding.documentFooterTagline || "Grow and Invest with Us"), { x: footerX, y: 12, size: 6, font: italic || regular, color: MUTED });

  const contact = [branding.supportMobile, branding.supportEmail, branding.website].filter(Boolean).join(" - ");
  const pageText = `${safeText(contact)} | Confidential | ${safeText(report.clientCode || "Client document")} | ${monthLabel(report.reportMonth)} ${report.reportYear || ""} | Page ${String(pageNo).padStart(2, "0")}`;
  const width = regular.widthOfTextAtSize(pageText, 5.8);
  page.drawText(pageText, { x: Math.max(footerX + 170, 551 - width), y: 16, size: 5.8, font: regular, color: MUTED });
}
