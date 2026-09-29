import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchSafeRemoteImage } from "@/lib/server/safeRemoteAsset";
import {
  drawPdfDocumentChrome,
  drawPdfImageFit,
  pdfHexColor,
  pdfSafeText,
  pdfSafeMultiline,
  PDF_A4_HEIGHT,
  PDF_A4_WIDTH,
  PDF_MARGIN
} from "@/lib/server/pdfDocumentShell";
import { getLockedGrowVestSignatureTemplate, resolveReportTemplate, shouldUseGrowVestSignatureDesign } from "@/lib/constants/reportTemplates";
import { REPORT_TYPE, getReportTypeLabel } from "@/lib/constants/report";
import {
  allocationStatus,
  buildTrendData,
  deriveAdvisorInsights,
  derivePortfolioHealth,
  deriveReportHighlights,
  deriveReportTransactions,
  goalDisplayStatus,
  holdingColor,
  investorFacingAdvisorDesignation,
  previousReportFor
} from "@/lib/utils/reportPresentation";
import { resolveReportBranding, resolveReportTheme } from "@/lib/utils/reportBranding";

const A4 = [PDF_A4_WIDTH, PDF_A4_HEIGHT];
const CONTENT_WIDTH = PDF_A4_WIDTH - (PDF_MARGIN * 2);
const CONTENT_TOP = 752;
const CONTENT_BOTTOM = 58;
const WHITE = rgb(1, 1, 1);
const INK = rgb(0.04, 0.05, 0.09);
const MUTED = rgb(0.38, 0.42, 0.5);
const BORDER = rgb(0.86, 0.88, 0.92);
const LIGHT = rgb(0.965, 0.973, 0.985);
const GREEN = rgb(0.05, 0.57, 0.41);
const RED = rgb(0.88, 0.16, 0.2);
const AMBER = rgb(0.78, 0.44, 0.02);

async function embedRemoteImage(doc, url) {
  if (!url) return null;
  try {
    const { bytes, contentType } = await fetchSafeRemoteImage(url);
    if (contentType === "image/png") return await doc.embedPng(bytes);
    if (contentType === "image/jpeg") return await doc.embedJpg(bytes);
    return null;
  } catch (error) {
    console.warn("Remote branding image was blocked or could not be embedded", error?.message || error);
    return null;
  }
}

async function embedLocalPublicImage(doc, url) {
  const raw = String(url || "").trim();
  if (!raw.startsWith("/")) return null;
  try {
    const publicRoot = path.resolve(process.cwd(), "public");
    const filePath = path.resolve(publicRoot, raw.replace(/^\/+/, ""));
    if (!(filePath === publicRoot || filePath.startsWith(`${publicRoot}${path.sep}`))) return null;
    const bytes = await fs.readFile(filePath);
    if (/\.png$/i.test(filePath)) return await doc.embedPng(bytes);
    if (/\.jpe?g$/i.test(filePath)) return await doc.embedJpg(bytes);
    return null;
  } catch (error) {
    console.warn("Local branding image could not be embedded", error?.message || error);
    return null;
  }
}

async function embedBrandImage(doc, url, fallbackUrl = "") {
  const raw = String(url || "").trim();
  const direct = raw.startsWith("/")
    ? await embedLocalPublicImage(doc, raw)
    : await embedRemoteImage(doc, raw);
  if (direct || !fallbackUrl || fallbackUrl === raw) return direct;
  return fallbackUrl.startsWith("/")
    ? embedLocalPublicImage(doc, fallbackUrl)
    : embedRemoteImage(doc, fallbackUrl);
}

function monthLabel(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1] || "";
}

function dateText(value) {
  if (!value) return "-";
  const raw = typeof value?.toDate === "function" ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return pdfSafeText(value);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function isOpeningReview(report) {
  return report?.reportType === REPORT_TYPE.OPENING;
}

function reportDocumentTitle(report) {
  return getReportTypeLabel(report?.reportType || REPORT_TYPE.MONTHLY);
}

function compactMoney(value) {
  const amount = Number(value || 0);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (absolute >= 10000000) return `${sign}Rs. ${(absolute / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (absolute >= 100000) return `${sign}Rs. ${(absolute / 100000).toFixed(2).replace(/\.00$/, "")} L`;
  if (absolute >= 1000) return `${sign}Rs. ${(absolute / 1000).toFixed(0)}K`;
  return `${sign}Rs. ${absolute.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fitSize(font, text, preferredSize, maxWidth, minimumSize = 5.5) {
  const safe = pdfSafeText(text);
  let size = preferredSize;
  while (size > minimumSize && font.widthOfTextAtSize(safe, size) > maxWidth) size -= 0.25;
  return size;
}

function splitLongWord(word, font, size, maxWidth) {
  const chunks = [];
  let current = "";
  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(text, font, size, maxWidth) {
  const paragraphs = pdfSafeMultiline(text).split(/\n/);
  const lines = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    words.forEach((word) => {
      const parts = font.widthOfTextAtSize(word, size) > maxWidth ? splitLongWord(word, font, size, maxWidth) : [word];
      parts.forEach((part) => {
        const candidate = current ? `${current} ${part}` : part;
        if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          lines.push(current);
          current = part;
        } else {
          current = candidate;
        }
      });
    });
    if (current || !words.length) lines.push(current);
    if (paragraphIndex < paragraphs.length - 1) lines.push("");
  });
  return lines.length ? lines : [""];
}

function drawTextBlock(page, text, options) {
  const {
    x,
    y,
    width,
    font,
    size = 10,
    color = INK,
    lineHeight = size * 1.35,
    maxLines = 100,
    align = "left"
  } = options;
  const allLines = wrapText(text, font, size, width);
  const lines = allLines.slice(0, maxLines);
  if (allLines.length > maxLines && lines.length) {
    let last = lines[lines.length - 1];
    while (last && font.widthOfTextAtSize(`${last}...`, size) > width) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}...`;
  }
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    const drawX = align === "right" ? x + width - lineWidth : align === "center" ? x + (width - lineWidth) / 2 : x;
    page.drawText(line, { x: drawX, y: y - index * lineHeight, size, font, color });
  });
  return { y: y - lines.length * lineHeight, lines, height: lines.length * lineHeight };
}

function drawRightText(page, text, { right, y, font, size, color = INK, maxWidth = 200, minimumSize = 5.5 }) {
  const safe = pdfSafeText(text);
  const fitted = fitSize(font, safe, size, maxWidth, minimumSize);
  const width = font.widthOfTextAtSize(safe, fitted);
  page.drawText(safe, { x: right - width, y, size: fitted, font, color });
}

function drawSectionTitle(page, fonts, title, y, theme) {
  if (theme.designVariant === "growvest-signature") {
    const safeTitle = pdfSafeText(title);
    const size = fitSize(fonts.bold, safeTitle, 23.5, CONTENT_WIDTH, 15);
    page.drawText(safeTitle, { x: PDF_MARGIN, y: y - 7, size, font: fonts.bold, color: theme.dark });
    return;
  }
  page.drawText("MONTHLY REVIEW", { x: PDF_MARGIN, y: y + 11, size: 6.2, font: fonts.bold, color: theme.primary });
  page.drawText(pdfSafeText(title), { x: PDF_MARGIN, y: y - 12, size: 15.5, font: fonts.bold, color: INK });
  page.drawRectangle({ x: PDF_MARGIN, y: y - 25, width: 42, height: 2.2, color: theme.primary });
}

function drawPanel(page, { x, y, width, height, fill = WHITE, border = BORDER, borderWidth = 0.8, radius = 0, opacity = 1, borderOpacity = 1 }) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: border, borderWidth, opacity, borderOpacity });
  return radius;
}

function drawSignatureCoverPhoto(page, image) {
  if (!image) return;
  // Match the browser cover: the photograph owns the right 78% of the A4 page.
  // Scale by cover (not stretch) and let the page boundary crop the small vertical
  // excess. This preserves the person's proportions and avoids the blurry full-page
  // zoom that the earlier browser implementation introduced.
  const regionX = PDF_A4_WIDTH * 0.34;
  const regionWidth = PDF_A4_WIDTH - regionX;
  const regionHeight = PDF_A4_HEIGHT;
  const natural = image.scale(1);
  const ratio = Math.max(regionWidth / natural.width, regionHeight / natural.height);
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  const x = PDF_A4_WIDTH - width;
  const y = (PDF_A4_HEIGHT - height) / 2;
  page.drawImage(image, { x, y, width, height, opacity: 1 });
}

function drawAllocationDonut(page, fonts, items = [], total = 0, { x, y, size = 150, fallbackColor = rgb(0.12, 0.31, 0.85), signatureMoney = false } = {}) {
  const segments = items
    .map((item) => ({ ...item, chartPercentage: Math.max(0, Number(item.percentage ?? item.currentPercentage ?? 0)) }))
    .filter((item) => item.chartPercentage > 0);
  const percentageTotal = segments.reduce((sum, item) => sum + item.chartPercentage, 0);
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const outerRadius = size * 0.43;
  const ringWidth = Math.max(14, size * 0.14);
  const innerRadius = outerRadius - ringWidth;

  if (!percentageTotal) {
    page.drawCircle({ x: centerX, y: centerY, size: outerRadius, borderColor: BORDER, borderWidth: ringWidth });
  } else {
    const normalised = segments.map((item) => ({ ...item, chartPercentage: item.chartPercentage / percentageTotal * 100 }));
    let cumulative = 0;
    const ranges = normalised.map((item) => {
      const start = cumulative;
      cumulative += item.chartPercentage;
      return { ...item, start, end: cumulative };
    });
    // Dense, overlapping radial strokes render as a visually solid ring in PDF
    // viewers while preserving crisp segment boundaries. The earlier 180-step
    // version left visible white spokes between strokes.
    const steps = 420;
    const radialThickness = Math.max(2.35, (2 * Math.PI * outerRadius / steps) * 1.5);
    for (let index = 0; index < steps; index += 1) {
      const percent = (index + 0.5) / steps * 100;
      const segment = ranges.find((item) => percent >= item.start && percent < item.end) || ranges[ranges.length - 1];
      const angle = Math.PI / 2 - index / steps * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      page.drawLine({
        start: { x: centerX + innerRadius * cosine, y: centerY + innerRadius * sine },
        end: { x: centerX + outerRadius * cosine, y: centerY + outerRadius * sine },
        thickness: radialThickness,
        color: pdfHexColor(holdingColor(segment), fallbackColor)
      });
    }
  }

  page.drawCircle({ x: centerX, y: centerY, size: Math.max(1, innerRadius - 1.2), color: WHITE });
  if (signatureMoney) {
    drawSignatureMoney(page, fonts.bold, total, { x: centerX, y: centerY + 2, size: 14, color: INK, align: "center", maxWidth: size * 0.64, minimumSize: 8.5 });
  } else {
    const value = compactMoney(total);
    const valueSize = fitSize(fonts.bold, value, 13, size * 0.62, 8.5);
    const valueWidth = fonts.bold.widthOfTextAtSize(pdfSafeText(value), valueSize);
    page.drawText(pdfSafeText(value), { x: centerX - valueWidth / 2, y: centerY + 3, size: valueSize, font: fonts.bold, color: INK });
  }
  const label = "Total Portfolio";
  const labelSize = 6.2;
  const labelWidth = fonts.regular.widthOfTextAtSize(label, labelSize);
  page.drawText(label, { x: centerX - labelWidth / 2, y: centerY - 13, size: labelSize, font: fonts.regular, color: MUTED });
}

function drawMetricCard(page, fonts, theme, { x, y, width, label, value, note, accent }) {
  const cardAccent = accent || theme.primary;
  drawPanel(page, { x, y, width, height: 86, fill: WHITE, border: BORDER });
  page.drawRectangle({ x, y: y + 83.5, width, height: 2.5, color: cardAccent });
  page.drawText(pdfSafeText(label).toUpperCase(), { x: x + 14, y: y + 61, size: 6.8, font: fonts.bold, color: MUTED });
  const valueSize = fitSize(fonts.bold, value, 17, width - 28, 10.5);
  page.drawText(pdfSafeText(value), { x: x + 14, y: y + 34, size: valueSize, font: fonts.bold, color: INK });
  if (note) page.drawText(pdfSafeText(note), { x: x + 14, y: y + 14, size: 6.8, font: fonts.regular, color: MUTED });
}

function createTheme(report, template) {
  const branding = resolveReportBranding(report, report.branding || {});
  const values = resolveReportTheme(report, branding, template);
  return {
    branding,
    designVariant: template.appearance?.designVariant || "classic",
    primary: pdfHexColor(values.primaryColor),
    secondary: pdfHexColor(values.secondaryColor, rgb(0.09, 0.73, 0.83)),
    dark: pdfHexColor(values.darkColor, INK),
    danger: pdfHexColor(values.dangerColor, RED),
    warning: pdfHexColor(values.warningColor, rgb(0.96, 0.7, 0.04)),
    surface: pdfHexColor(values.surfaceColor, LIGHT),
    muted: pdfHexColor(values.mutedColor, MUTED),
    success: GREEN
  };
}

function addPage(doc, fonts, report, template, theme, title = "") {
  const page = doc.addPage(A4);
  const settings = template.appearance?.document || {};
  drawPdfDocumentChrome(page, fonts, report, doc.getPageCount(), {
    documentTitle: reportDocumentTitle(report),
    primaryColor: template.appearance?.primaryColor || theme.branding.primaryColor,
    secondaryColor: template.appearance?.secondaryColor || theme.branding.secondaryColor,
    showLogo: settings.showLogo !== false,
    showClientCode: settings.showClientCode !== false,
    showReportMonth: settings.showReportMonth !== false,
    showConfidentialLabel: settings.showConfidentialLabel !== false,
    showPageNumbers: settings.showPageNumbers !== false,
    showContactInformation: settings.showContactInformation !== false,
    headerStyle: template.appearance?.headerStyle || "compact",
    footerStyle: template.appearance?.footerStyle || "legal"
  });
  if (title) drawSectionTitle(page, fonts, title, CONTENT_TOP, theme);
  return page;
}


function drawEmptyState(page, fonts, message, y = 620) {
  drawPanel(page, { x: PDF_MARGIN, y: y - 70, width: CONTENT_WIDTH, height: 88, fill: LIGHT, border: BORDER });
  drawTextBlock(page, message, { x: PDF_MARGIN + 24, y: y - 28, width: CONTENT_WIDTH - 48, font: fonts.regular, size: 10, color: MUTED, align: "center", maxLines: 3 });
}

function isLightCoverStyle(style = "premium-dark") {
  return style === "minimal-light" || style === "brand-light";
}

function drawCoverPattern(page, fonts, report, template, theme, box, darkCover) {
  const pattern = template.appearance?.coverPattern || "orbital";
  const patternColor = darkCover ? WHITE : theme.primary;
  const secondary = theme.secondary;
  if (pattern === "none") return;
  if (pattern === "orbital") {
    page.drawCircle({ x: box.x + box.width - 12, y: box.y + box.height - 16, size: 118, borderColor: patternColor, borderWidth: 0.9, borderOpacity: darkCover ? 0.13 : 0.08 });
    page.drawCircle({ x: box.x + box.width - 6, y: box.y + box.height - 14, size: 68, borderColor: secondary, borderWidth: 0.9, borderOpacity: darkCover ? 0.24 : 0.16 });
    return;
  }
  if (pattern === "grid") {
    for (let x = box.x; x <= box.x + box.width; x += 30) page.drawLine({ start: { x, y: box.y }, end: { x, y: box.y + box.height }, thickness: 0.35, color: patternColor, opacity: darkCover ? 0.08 : 0.045 });
    for (let y = box.y; y <= box.y + box.height; y += 30) page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.35, color: patternColor, opacity: darkCover ? 0.08 : 0.045 });
    return;
  }
  if (pattern === "lines") {
    for (let offset = -140; offset < box.width + 240; offset += 68) {
      page.drawLine({ start: { x: box.x + offset, y: box.y }, end: { x: box.x + offset + 220, y: box.y + box.height }, thickness: 0.55, color: patternColor, opacity: darkCover ? 0.08 : 0.05 });
    }
    return;
  }
  if (pattern === "wave") {
    page.drawCircle({ x: box.x + box.width + 12, y: box.y - 18, size: 142, borderColor: patternColor, borderWidth: 24, borderOpacity: darkCover ? 0.07 : 0.04 });
    return;
  }
  if (pattern === "brand-mark") {
    const mark = pdfSafeText((theme.branding.companyName || "GrowVest").slice(0, 1).toUpperCase() || "G");
    page.drawText(mark, { x: box.x + box.width - 138, y: box.y + box.height - 170, size: 150, font: fonts.bold, color: theme.primary, opacity: darkCover ? 0.12 : 0.06 });
  }
}

function addCover(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme);
  const settings = template.appearance?.document || {};
  const style = template.appearance?.coverStyle || "premium-dark";
  const darkCover = !isLightCoverStyle(style);
  const box = { x: PDF_MARGIN, y: 150, width: CONTENT_WIDTH, height: 570 };
  let coverFill = darkCover ? theme.dark : WHITE;
  if (style === "performance-grid" || style === "compact-gradient") coverFill = theme.primary;
  if (style === "brand-light") coverFill = LIGHT;
  drawPanel(page, { ...box, fill: coverFill, border: darkCover ? coverFill : BORDER, borderWidth: darkCover ? 0 : 0.8 });
  if (style === "structured-dark") page.drawRectangle({ x: box.x + box.width - 132, y: box.y, width: 132, height: box.height, color: theme.primary, opacity: 0.16 });
  if (style === "compact-gradient") page.drawRectangle({ x: box.x + box.width * 0.58, y: box.y, width: box.width * 0.42, height: box.height, color: theme.dark, opacity: 0.56 });
  drawCoverPattern(page, fonts, report, template, theme, box, darkCover);

  const background = report.__brandingAssets?.coverBackground;
  if (background) drawPdfImageFit(page, background, { x: box.x, y: box.y, maxWidth: box.width, maxHeight: box.height, align: "center", valign: "center", opacity: darkCover ? 0.13 : 0.08 });

  const coverInk = darkCover ? WHITE : INK;
  const coverMuted = darkCover ? rgb(0.72, 0.75, 0.82) : MUTED;
  const coverFaint = darkCover ? rgb(0.56, 0.61, 0.7) : rgb(0.55, 0.58, 0.64);

  if (settings.showConfidentialLabel !== false && theme.branding.showConfidentialLabel !== false) {
    const label = pdfSafeText(theme.branding.confidentialLabel || "Confidential client report").toUpperCase();
    const width = Math.min(190, fonts.bold.widthOfTextAtSize(label, 6.2) + 24);
    drawPanel(page, { x: box.x + box.width - width - 16, y: 679, width, height: 22, fill: darkCover ? WHITE : LIGHT, border: darkCover ? WHITE : BORDER, borderWidth: 0.6, opacity: darkCover ? 0.08 : 1, borderOpacity: darkCover ? 0.16 : 1 });
    drawRightText(page, label, { right: box.x + box.width - 28, y: 687, font: fonts.bold, size: 6.2, color: coverMuted, maxWidth: width - 24 });
  }

  const opening = isOpeningReview(report);
  page.drawText(opening ? "OPENING WEALTH REVIEW" : "MONTHLY WEALTH REVIEW", { x: box.x + 28, y: 649, size: 8.2, font: fonts.bold, color: darkCover ? theme.secondary : theme.primary });
  if (opening) {
    const openingSize = fitSize(fonts.bold, "Opening", 45, box.width - 56, 30);
    page.drawText("Opening", { x: box.x + 28, y: 586, size: openingSize, font: fonts.bold, color: coverInk });
    const reviewSize = fitSize(fonts.bold, "Wealth Review", 36, box.width - 56, 25);
    page.drawText("Wealth Review", { x: box.x + 28, y: 540, size: reviewSize, font: fonts.bold, color: coverInk });
  } else {
    const month = monthLabel(report.reportMonth) || "Monthly";
    const monthSize = fitSize(fonts.bold, month, 48, box.width - 56, 32);
    page.drawText(month, { x: box.x + 28, y: 586, size: monthSize, font: fonts.bold, color: coverInk });
    page.drawText(String(report.reportYear || ""), { x: box.x + 28, y: 536, size: 43, font: fonts.bold, color: coverInk });
  }
  drawTextBlock(page, theme.branding.tagline || theme.branding.brandPositioning || "Your Conscious Wealth Partner", { x: box.x + 28, y: 497, width: box.width - 56, font: fonts.italic, size: 12, color: coverMuted, maxLines: 2, lineHeight: 15 });
  page.drawText(`${opening ? "Opening position as of" : "Statement date"} | ${dateText(report.statementDate)}`, { x: box.x + 28, y: 467, size: 7.4, font: fonts.regular, color: coverFaint });

  const showAdvisor = template.appearance?.advisorCardVisible !== false;
  const peopleGap = 12;
  const peopleWidth = showAdvisor ? (box.width - 56 - peopleGap) / 2 : box.width - 56;
  const peopleY = 305;
  const peopleHeight = 118;
  const cardData = [{ x: box.x + 28, label: "PREPARED FOR", name: report.investorName || "Investor", detail: settings.showClientCode === false ? "" : `Client ID | ${report.clientCode || "-"}`, accent: darkCover ? theme.secondary : theme.dark }];
  if (showAdvisor) cardData.push({ x: box.x + 28 + peopleWidth + peopleGap, label: "YOUR CONSCIOUS WEALTH PARTNER", name: report.advisorName || `${theme.branding.companyName || "GrowVest"} Partner`, detail: investorFacingAdvisorDesignation(report.advisorDesignation), accent: theme.primary });
  cardData.forEach((card) => {
    drawPanel(page, { x: card.x, y: peopleY, width: peopleWidth, height: peopleHeight, fill: darkCover ? WHITE : LIGHT, border: darkCover ? WHITE : BORDER, opacity: darkCover ? 0.055 : 1, borderOpacity: darkCover ? 0.13 : 1 });
    page.drawText(card.label, { x: card.x + 14, y: peopleY + 91, size: 6.3, font: fonts.bold, color: coverFaint });
    const nameSize = fitSize(fonts.bold, card.name, 15, peopleWidth - 28, 10);
    page.drawText(pdfSafeText(card.name), { x: card.x + 14, y: peopleY + 58, size: nameSize, font: fonts.bold, color: coverInk });
    if (card.detail) drawTextBlock(page, card.detail, { x: card.x + 14, y: peopleY + 34, width: peopleWidth - 28, font: fonts.regular, size: 7.3, color: coverMuted, maxLines: 2, lineHeight: 9 });
    page.drawRectangle({ x: card.x + 14, y: peopleY + 15, width: 42, height: 2.5, color: card.accent });
  });

  const summary = report.summary || {};
  const hasGoals = Array.isArray(report.goals) && report.goals.length > 0;
  const cardGap = 8;
  const cardWidth = (box.width - 56 - cardGap * 2) / 3;
  const summaryCards = [
    ["Total Portfolio", compactMoney(summary.totalCorpus)],
    [opening ? "Active Monthly SIP" : "Monthly SIP", compactMoney(summary.monthlySip)],
    [hasGoals ? "Overall Goal Progress" : "General Wealth Corpus", hasGoals ? `${Number(summary.overallProgress || 0).toFixed(1)}%` : compactMoney(summary.generalWealthCorpus || summary.totalCorpus)]
  ];
  summaryCards.forEach(([label, value], index) => {
    const x = box.x + 28 + index * (cardWidth + cardGap);
    const summaryDark = !darkCover;
    drawPanel(page, { x, y: 186, width: cardWidth, height: 86, fill: summaryDark ? theme.dark : WHITE, border: summaryDark ? theme.dark : WHITE, opacity: summaryDark ? 1 : 0.075, borderOpacity: summaryDark ? 1 : 0.12 });
    page.drawRectangle({ x, y: 269.5, width: cardWidth, height: 2.5, color: darkCover ? theme.secondary : theme.primary });
    page.drawText(label.toUpperCase(), { x: x + 12, y: 245, size: 6.2, font: fonts.bold, color: summaryDark ? rgb(0.68, 0.71, 0.77) : coverFaint });
    const size = fitSize(fonts.bold, value, 14.5, cardWidth - 24, 9.5);
    page.drawText(pdfSafeText(value), { x: x + 12, y: 214, size, font: fonts.bold, color: WHITE });
  });
}

function addExecutiveSummary(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Executive summary");
  const summary = report.summary || {};
  const hasGoals = Array.isArray(report.goals) && report.goals.length > 0;
  page.drawRectangle({ x: PDF_MARGIN, y: 600, width: CONTENT_WIDTH, height: 120, color: theme.dark });
  page.drawText("TOTAL PORTFOLIO VALUE", { x: PDF_MARGIN + 20, y: 690, size: 7.5, font: fonts.bold, color: rgb(0.66, 0.7, 0.77) });
  page.drawText(compactMoney(summary.totalCorpus), { x: PDF_MARGIN + 20, y: 651, size: 27, font: fonts.bold, color: WHITE });
  page.drawText(hasGoals ? `of ${compactMoney(summary.lifetimeTarget)} combined goal target` : "latest verified investment corpus", { x: PDF_MARGIN + 20, y: 629, size: 8, font: fonts.regular, color: rgb(0.75, 0.78, 0.84) });
  drawRightText(page, hasGoals ? "OVERALL GOAL PROGRESS" : "GENERAL WEALTH CORPUS", { right: 531, y: 690, font: fonts.bold, size: 7.5, color: rgb(0.66, 0.7, 0.77), maxWidth: 170 });
  drawRightText(page, hasGoals ? `${Number(summary.overallProgress || 0).toFixed(1)}%` : compactMoney(summary.generalWealthCorpus || summary.totalCorpus), { right: 531, y: 650, font: fonts.bold, size: hasGoals ? 26 : 17, color: theme.secondary, maxWidth: 170 });
  if (hasGoals) {
    page.drawRectangle({ x: PDF_MARGIN + 20, y: 614, width: CONTENT_WIDTH - 40, height: 6, color: rgb(0.17, 0.19, 0.24) });
    page.drawRectangle({ x: PDF_MARGIN + 20, y: 614, width: (CONTENT_WIDTH - 40) * Math.min(100, Math.max(0, Number(summary.overallProgress || 0))) / 100, height: 6, color: theme.primary });
  }

  const cardGap = 10;
  const cardWidth = (CONTENT_WIDTH - cardGap * 3) / 4;
  const opening = isOpeningReview(report);
  if (opening) {
    const portfolioGainLoss = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - Number(summary.totalInvested || 0)));
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN, y: 490, width: cardWidth, label: "Active Monthly SIP", value: compactMoney(summary.monthlySip), note: "Current running SIP" });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap), y: 490, width: cardWidth, label: "Total Invested", value: compactMoney(summary.totalInvested), note: "Current cost basis", accent: theme.secondary });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap) * 2, y: 490, width: cardWidth, label: "Gain / Loss", value: compactMoney(portfolioGainLoss), note: "Since investment cost basis", accent: portfolioGainLoss >= 0 ? theme.success : theme.danger });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap) * 3, y: 490, width: cardWidth, label: "Baseline Date", value: dateText(report.statementDate), note: "Opening GrowVest snapshot", accent: theme.primary });
  } else {
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN, y: 490, width: cardWidth, label: "Monthly SIP", value: compactMoney(summary.monthlySip), note: "Current running SIP" });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap), y: 490, width: cardWidth, label: "Money Added", value: compactMoney(summary.newMoneyAdded), note: "Confirmed inflow", accent: theme.secondary });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap) * 2, y: 490, width: cardWidth, label: "Money Withdrawn", value: compactMoney(summary.totalWithdrawals), note: "Confirmed outflow", accent: theme.warning });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap) * 3, y: 490, width: cardWidth, label: "Portfolio Gain / Loss", value: compactMoney(summary.investmentGain), note: "Performance only", accent: Number(summary.investmentGain || 0) >= 0 ? theme.success : theme.danger });
  }

  drawSectionTitle(page, fonts, "Portfolio composition", 447, theme);
  const holdings = (report.holdings || []).slice(0, 8);
  if (!holdings.length) {
    drawEmptyState(page, fonts, "No portfolio-composition data was included in this report.", 390);
    return;
  }
  let y = 408;
  holdings.forEach((item) => {
    const percentage = Math.min(100, Math.max(0, Number(item.percentage || 0)));
    page.drawText(pdfSafeText(item.assetClass || "Other"), { x: PDF_MARGIN, y, size: 8.7, font: fonts.bold, color: INK });
    drawRightText(page, compactMoney(item.currentValue), { right: 410, y, font: fonts.regular, size: 8, color: MUTED, maxWidth: 135 });
    drawRightText(page, `${percentage.toFixed(1)}%`, { right: 551, y, font: fonts.bold, size: 8, color: INK, maxWidth: 70 });
    page.drawRectangle({ x: PDF_MARGIN, y: y - 12, width: CONTENT_WIDTH, height: 5, color: rgb(0.9, 0.92, 0.95) });
    page.drawRectangle({ x: PDF_MARGIN, y: y - 12, width: Math.max(1, CONTENT_WIDTH * percentage / 100), height: 5, color: theme.primary });
    y -= 39;
  });
}

function drawTrendChart(page, fonts, theme, trend, { x, y, width, height, chartStyle = "modern" }) {
  drawPanel(page, { x, y, width, height, fill: WHITE, border: BORDER });
  page.drawRectangle({ x, y: y + height - 2.5, width, height: 2.5, color: theme.primary });
  page.drawText("PORTFOLIO VALUE TREND", { x: x + 16, y: y + height - 27, size: 7.2, font: fonts.bold, color: MUTED });
  const chartX = x + 44;
  const chartY = y + 40;
  const chartWidth = width - 70;
  const chartHeight = height - 84;
  const detailed = chartStyle === "analytical" || chartStyle === "detailed";
  const minimal = chartStyle === "minimal" || chartStyle === "compact";
  if (detailed) {
    [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
      const lineY = chartY + chartHeight * ratio;
      page.drawLine({ start: { x: chartX, y: lineY }, end: { x: chartX + chartWidth, y: lineY }, thickness: 0.35, color: BORDER, opacity: 0.75 });
    });
  } else {
    page.drawLine({ start: { x: chartX, y: chartY }, end: { x: chartX + chartWidth, y: chartY }, thickness: 0.5, color: BORDER });
  }
  if (!minimal) page.drawLine({ start: { x: chartX, y: chartY }, end: { x: chartX, y: chartY + chartHeight }, thickness: 0.45, color: BORDER });
  if (!trend.length) {
    drawTextBlock(page, "Historical trend will appear after multiple monthly reports are completed.", { x: chartX + 20, y: chartY + chartHeight / 2, width: chartWidth - 40, font: fonts.regular, size: 9, color: MUTED, align: "center", maxLines: 3 });
    return;
  }
  const values = trend.map((item) => Number(item.value || 0));
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (minimum === maximum) {
    minimum = Math.max(0, minimum * 0.9);
    maximum = maximum * 1.1 || 1;
  }
  const range = maximum - minimum || 1;
  const points = trend.map((item, index) => ({
    x: chartX + (trend.length === 1 ? chartWidth / 2 : index * chartWidth / (trend.length - 1)),
    y: chartY + ((Number(item.value || 0) - minimum) / range) * chartHeight,
    item
  }));
  for (let index = 1; index < points.length; index += 1) {
    page.drawLine({ start: { x: points[index - 1].x, y: points[index - 1].y }, end: { x: points[index].x, y: points[index].y }, thickness: chartStyle === "compact" ? 1.6 : 2.1, color: theme.primary });
  }
  points.forEach((point, index) => {
    page.drawCircle({ x: point.x, y: point.y, size: chartStyle === "compact" ? 2.5 : 3.2, color: theme.primary, borderColor: WHITE, borderWidth: 0.8 });
    const label = pdfSafeText(point.item.label || point.item.monthKey || "");
    const labelWidth = fonts.regular.widthOfTextAtSize(label, 6.2);
    page.drawText(label, { x: Math.max(chartX, Math.min(chartX + chartWidth - labelWidth, point.x - labelWidth / 2)), y: chartY - 18, size: 6.2, font: fonts.regular, color: MUTED });
    if ((detailed && (trend.length <= 6 || index === points.length - 1)) || (!minimal && (index === 0 || index === points.length - 1))) {
      const value = compactMoney(point.item.value);
      const valueSize = fitSize(fonts.bold, value, 6.8, 74, 5.3);
      const valueWidth = fonts.bold.widthOfTextAtSize(value, valueSize);
      page.drawText(value, { x: Math.max(chartX, Math.min(chartX + chartWidth - valueWidth, point.x - valueWidth / 2)), y: point.y + 10, size: valueSize, font: fonts.bold, color: INK });
    }
  });
}

function addPerformancePage(doc, fonts, report, template, theme, history) {
  if (isOpeningReview(report)) {
    const page = addPage(doc, fonts, report, template, theme, "Opening portfolio snapshot");
    drawPanel(page, { x: PDF_MARGIN, y: 575, width: CONTENT_WIDTH, height: 135, fill: LIGHT, border: theme.primary });
    page.drawText("YOUR STARTING POINT WITH GROWVEST", { x: PDF_MARGIN + 18, y: 680, size: 7.4, font: fonts.bold, color: theme.primary });
    drawTextBlock(page, `Baseline established as of ${dateText(report.statementDate)}`, { x: PDF_MARGIN + 18, y: 648, width: CONTENT_WIDTH - 36, font: fonts.bold, size: 15, color: INK, maxLines: 2, lineHeight: 18 });
    drawTextBlock(page, "This is the investor's first GrowVest wealth review. Previous-period return, money movement and month-on-month performance are intentionally not inferred. Future Monthly Wealth Reviews will compare against verified Portfolio Master history from this baseline onward.", { x: PDF_MARGIN + 18, y: 611, width: CONTENT_WIDTH - 36, font: fonts.regular, size: 8.2, color: MUTED, maxLines: 4, lineHeight: 11 });

    drawPanel(page, { x: PDF_MARGIN, y: 330, width: CONTENT_WIDTH, height: 220, fill: WHITE, border: BORDER });
    page.drawText("OPENING PORTFOLIO COMPOSITION", { x: PDF_MARGIN + 16, y: 522, size: 7.5, font: fonts.bold, color: MUTED });
    const composition = Array.isArray(report.holdings) && report.holdings.length
      ? report.holdings
      : (report.allocation || []).map((item) => ({ ...item, percentage: Number(item.currentPercentage || 0), currentValue: Number(item.currentValue || 0) }));
    drawAllocationDonut(page, fonts, composition, report.summary?.totalCorpus || 0, { x: PDF_MARGIN + 8, y: 354, size: 160, fallbackColor: theme.primary });
    let legendY = 487;
    composition.slice(0, 6).forEach((item) => {
      const percentage = Number(item.percentage ?? item.currentPercentage ?? 0);
      const color = pdfHexColor(holdingColor(item), theme.primary);
      page.drawRectangle({ x: PDF_MARGIN + 205, y: legendY + 1, width: 7, height: 7, color });
      drawTextBlock(page, item.assetClass || "Other", { x: PDF_MARGIN + 219, y: legendY + 7, width: 125, font: fonts.bold, size: 7.2, color: INK, maxLines: 1, lineHeight: 8 });
      drawRightText(page, compactMoney(item.currentValue || 0), { right: 490, y: legendY, font: fonts.regular, size: 7, color: MUTED, maxWidth: 90 });
      drawRightText(page, `${percentage.toFixed(1)}%`, { right: 535, y: legendY, font: fonts.bold, size: 7, color: INK, maxWidth: 40 });
      legendY -= 27;
    });

    const gap = 12;
    const metricWidth = (CONTENT_WIDTH - gap * 2) / 3;
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN, y: 205, width: metricWidth, label: "Current Portfolio", value: compactMoney(report.summary?.totalCorpus), note: "Verified opening value" });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + metricWidth + gap, y: 205, width: metricWidth, label: "Total Invested", value: compactMoney(report.summary?.totalInvested), note: "Available cost basis", accent: theme.secondary });
    drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (metricWidth + gap) * 2, y: 205, width: metricWidth, label: "Active Monthly SIP", value: compactMoney(report.summary?.monthlySip), note: "Current recurring investment", accent: theme.success });
    return;
  }

  const page = addPage(doc, fonts, report, template, theme, "Portfolio performance");
  const trend = buildTrendData(report, history);
  drawTrendChart(page, fonts, theme, trend, { x: PDF_MARGIN, y: 430, width: CONTENT_WIDTH, height: 280, chartStyle: template.appearance?.chartStyle || "modern" });

  const previous = previousReportFor(report, history);
  const portfolioGainLoss = Number(report.summary?.investmentGain || 0);
  const highlights = deriveReportHighlights(report).slice(0, 4);
  if (previous) {
    highlights.unshift({
      id: "portfolio-gain-loss",
      title: "Portfolio gain / loss",
      description: `${portfolioGainLoss >= 0 ? "Gain" : "Loss"} of ${compactMoney(Math.abs(portfolioGainLoss))} from investment performance, excluding confirmed money added or withdrawn.`
    });
  }
  const cards = highlights.slice(0, 4);
  if (!cards.length) {
    drawEmptyState(page, fonts, "Monthly performance highlights were not recorded for this report.", 350);
    addMonthlyChangesPage(doc, fonts, report, template, theme);
    return;
  }
  page.drawText("THIS MONTH AT A GLANCE", { x: PDF_MARGIN, y: 395, size: 8, font: fonts.bold, color: MUTED });
  const gap = 14;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const cardHeight = 118;
  cards.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const x = PDF_MARGIN + column * (cardWidth + gap);
    const y = 250 - row * (cardHeight + 14);
    drawPanel(page, { x, y, width: cardWidth, height: cardHeight, fill: LIGHT, border: BORDER });
    page.drawRectangle({ x: x + 14, y: y + cardHeight - 25, width: 35, height: 3, color: index === 0 ? theme.secondary : theme.primary });
    drawTextBlock(page, item.title || "Portfolio update", { x: x + 14, y: y + cardHeight - 45, width: cardWidth - 28, font: fonts.bold, size: 10, color: INK, maxLines: 2, lineHeight: 12 });
    drawTextBlock(page, item.description || "", { x: x + 14, y: y + cardHeight - 72, width: cardWidth - 28, font: fonts.regular, size: 8.2, color: MUTED, maxLines: 3, lineHeight: 11 });
  });
  addMonthlyChangesPage(doc, fonts, report, template, theme);
}

function addMonthlyChangesPage(doc, fonts, report, template, theme) {
  const changes = Array.isArray(report.monthlyChanges) ? report.monthlyChanges : [];
  if (!changes.length) return;
  const pages = [];
  for (let index = 0; index < changes.length; index += 8) pages.push(changes.slice(index, index + 8));
  pages.forEach((items, pageIndex) => {
    const page = addPage(doc, fonts, report, template, theme, pageIndex === 0 ? "What changed this month" : "What changed this month - continued");
    drawTextBlock(page, "Confirmed Portfolio Master activity only. Planned investor requests are shown separately and do not affect report cash-flow figures until provider activity or an explicitly confirmed external cash movement exists.", { x: PDF_MARGIN, y: 695, width: CONTENT_WIDTH, font: fonts.regular, size: 8.2, color: MUTED, lineHeight: 11, maxLines: 3 });
    let y = 635;
    items.forEach((item) => {
      drawPanel(page, { x: PDF_MARGIN, y: y - 62, width: CONTENT_WIDTH, height: 54, fill: LIGHT, border: BORDER });
      drawTextBlock(page, item.title || "Portfolio change", { x: PDF_MARGIN + 14, y: y - 28, width: 170, font: fonts.bold, size: 9, color: INK, maxLines: 1, lineHeight: 10 });
      drawTextBlock(page, item.description || "Confirmed portfolio activity", { x: PDF_MARGIN + 190, y: y - 26, width: 210, font: fonts.regular, size: 7.3, color: MUTED, maxLines: 2, lineHeight: 9 });
      const amount = Number(item.amount || 0);
      const previousAmount = Number(item.previousAmount || 0);
      const amountText = amount || previousAmount ? `${previousAmount && amount ? `${compactMoney(previousAmount)} -> ` : ""}${compactMoney(amount)}` : "-";
      drawRightText(page, amountText, { right: PDF_MARGIN + CONTENT_WIDTH - 14, y: y - 29, font: fonts.bold, size: 8, color: item.type === "money_withdrawn" ? theme.danger : theme.primary, maxWidth: 120 });
      y -= 69;
    });
  });
}

function drawGoalCard(page, fonts, theme, goal, { x, y, width, height }) {
  const attention = String(goal.status || "").toLowerCase().includes("review");
  drawPanel(page, { x, y, width, height, fill: WHITE, border: attention ? theme.danger : BORDER });
  drawTextBlock(page, goal.name || "Financial goal", { x: x + 14, y: y + height - 27, width: width - 96, font: fonts.bold, size: 10.5, color: INK, maxLines: 2, lineHeight: 12 });
  const status = pdfSafeText(goalDisplayStatus(goal));
  const statusSize = fitSize(fonts.bold, status, 6.5, 72, 5.3);
  drawRightText(page, status, { right: x + width - 14, y: y + height - 25, font: fonts.bold, size: statusSize, color: attention ? theme.danger : theme.primary, maxWidth: 72 });
  const progress = Math.min(100, Math.max(0, Number(goal.progress || 0)));
  page.drawText(`${progress.toFixed(1)}%`, { x: x + 14, y: y + height - 72, size: 18, font: fonts.bold, color: attention ? theme.danger : theme.primary });
  page.drawRectangle({ x: x + 82, y: y + height - 64, width: width - 96, height: 7, color: rgb(0.92, 0.93, 0.96) });
  page.drawRectangle({ x: x + 82, y: y + height - 64, width: Math.max(1, (width - 96) * progress / 100), height: 7, color: attention ? theme.danger : theme.primary });

  const columnWidth = (width - 28) / 3;
  const metrics = [
    ["TARGET", compactMoney(goal.targetAmount)],
    ["CURRENT", compactMoney(goal.currentAmount)],
    ["MONTHLY SIP", Number(goal.monthlySip || 0) ? compactMoney(goal.monthlySip) : "-"]
  ];
  metrics.forEach(([label, value], index) => {
    const metricX = x + 14 + index * columnWidth;
    page.drawText(label, { x: metricX, y: y + 45, size: 5.7, font: fonts.bold, color: MUTED });
    const size = fitSize(fonts.bold, value, 7.5, columnWidth - 5, 5.8);
    page.drawText(pdfSafeText(value), { x: metricX, y: y + 28, size, font: fonts.bold, color: INK });
  });
  page.drawText(`Target year | ${goal.targetYear || "-"}`, { x: x + 14, y: y + 10, size: 6.5, font: fonts.regular, color: MUTED });
}

function addGoalsPages(doc, fonts, report, template, theme) {
  const goals = report.goals || [];
  if (!goals.length) {
    const page = addPage(doc, fonts, report, template, theme, "General Wealth Corpus");
    drawPanel(page, { x: PDF_MARGIN, y: 470, width: CONTENT_WIDTH, height: 210, fill: LIGHT, border: theme.primary });
    page.drawText("GENERAL WEALTH CORPUS", { x: PDF_MARGIN + 18, y: 645, size: 8, font: fonts.bold, color: theme.primary });
    page.drawText(compactMoney(report.summary?.generalWealthCorpus || report.summary?.totalCorpus || 0), { x: PDF_MARGIN + 18, y: 603, size: 24, font: fonts.bold, color: INK });
    drawTextBlock(page, "Investments not linked to a specific Bucket List are mapped to General Wealth (Default). They can later be reassigned to a specific Bucket List without changing the underlying investment record.", { x: PDF_MARGIN + 18, y: 565, width: CONTENT_WIDTH - 36, font: fonts.regular, size: 9.5, color: MUTED, lineHeight: 14, maxLines: 5 });
    return;
  }
  const pageSize = 6;
  for (let start = 0; start < goals.length; start += pageSize) {
    const page = addPage(doc, fonts, report, template, theme, start === 0 ? "Goals & Bucket List progress" : "Goal progress - continued");
    page.drawText("Every financial goal in your plan, its target and how close you are today.", { x: PDF_MARGIN, y: 712, size: 8.5, font: fonts.regular, color: MUTED });
    const rows = goals.slice(start, start + pageSize);
    const gapX = 14;
    const gapY = 14;
    const cardWidth = (CONTENT_WIDTH - gapX) / 2;
    const cardHeight = 170;
    rows.forEach((goal, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = PDF_MARGIN + column * (cardWidth + gapX);
      const y = 520 - row * (cardHeight + gapY);
      drawGoalCard(page, fonts, theme, goal, { x, y, width: cardWidth, height: cardHeight });
    });
  }
}

function addAllocationSummary(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Portfolio allocation");
  const health = derivePortfolioHealth(report);
  const stats = [
    ["Diversification", health.needsRebalancing ? "Needs Review" : "On Track"],
    ["Growth Assets", `${health.growth.toFixed(1)}%`],
    ["Stable & Liquid", `${health.stable.toFixed(1)}%`],
    ["Allocation Gaps", `${health.gaps} classes`]
  ];
  const gap = 10;
  const statWidth = (CONTENT_WIDTH - gap * 3) / 4;
  stats.forEach(([label, value], index) => {
    const x = PDF_MARGIN + index * (statWidth + gap);
    drawPanel(page, { x, y: 642, width: statWidth, height: 68, fill: LIGHT, border: BORDER });
    drawTextBlock(page, label, { x: x + 9, y: 685, width: statWidth - 18, font: fonts.regular, size: 6.5, color: MUTED, align: "center", maxLines: 2, lineHeight: 8 });
    drawTextBlock(page, value, { x: x + 9, y: 661, width: statWidth - 18, font: fonts.bold, size: 8.8, color: INK, align: "center", maxLines: 2, lineHeight: 10 });
  });

  const allocation = report.allocation || [];
  if (!allocation.length) {
    drawEmptyState(page, fonts, "No asset-allocation data was included in this report.", 570);
  } else {
    const composition = Array.isArray(report.holdings) && report.holdings.length
      ? report.holdings
      : allocation.map((item) => ({
          ...item,
          percentage: Number(item.currentPercentage || 0),
          currentValue: Number(item.currentValue || 0)
        }));

    drawPanel(page, { x: PDF_MARGIN, y: 392, width: CONTENT_WIDTH, height: 224, fill: WHITE, border: BORDER });
    page.drawText("ASSET ALLOCATION", { x: PDF_MARGIN + 16, y: 588, size: 7.5, font: fonts.bold, color: MUTED });
    drawAllocationDonut(page, fonts, composition, report.summary?.totalCorpus || 0, {
      x: PDF_MARGIN + 8,
      y: 414,
      size: 158,
      fallbackColor: theme.primary
    });

    const legendX = PDF_MARGIN + 202;
    let legendY = 557;
    composition.slice(0, 6).forEach((item) => {
      const percentage = Number(item.percentage ?? item.currentPercentage ?? 0);
      const color = pdfHexColor(holdingColor(item), theme.primary);
      page.drawRectangle({ x: legendX, y: legendY + 1, width: 7, height: 7, color });
      drawTextBlock(page, item.assetClass || "Other", { x: legendX + 14, y: legendY + 7, width: 118, font: fonts.bold, size: 7.3, color: INK, maxLines: 1, lineHeight: 8 });
      drawRightText(page, compactMoney(item.currentValue || 0), { right: 490, y: legendY, font: fonts.regular, size: 7, color: MUTED, maxWidth: 88 });
      drawRightText(page, `${percentage.toFixed(1)}%`, { right: 535, y: legendY, font: fonts.bold, size: 7, color: INK, maxWidth: 40 });
      legendY -= 27;
    });
    if (composition.length > 6) {
      page.drawText(`+${composition.length - 6} more asset classes`, { x: legendX + 14, y: legendY + 4, size: 6.6, font: fonts.regular, color: MUTED });
    }

    page.drawText("CURRENT VS TARGET", { x: PDF_MARGIN, y: 362, size: 7.5, font: fonts.bold, color: MUTED });
    let y = 336;
    allocation.slice(0, 4).forEach((item) => {
      const current = Math.min(100, Math.max(0, Number(item.currentPercentage || 0)));
      const target = Math.min(100, Math.max(0, Number(item.targetPercentage || 0)));
      const barColor = pdfHexColor(holdingColor(item), theme.primary);
      page.drawText(pdfSafeText(item.assetClass || "Other"), { x: PDF_MARGIN, y, size: 7.5, font: fonts.bold, color: INK });
      page.drawRectangle({ x: 160, y: y - 2, width: 278, height: 10, color: rgb(0.93, 0.94, 0.96) });
      page.drawRectangle({ x: 160, y: y - 2, width: 278 * target / 100, height: 10, color: rgb(0.82, 0.86, 0.94), opacity: 0.75 });
      page.drawRectangle({ x: 160, y: y - 2, width: Math.max(1, 278 * current / 100), height: 10, color: barColor });
      drawRightText(page, `${current.toFixed(1)}%`, { right: 488, y, font: fonts.bold, size: 7, color: INK, maxWidth: 42 });
      drawRightText(page, `target ${target.toFixed(1)}%`, { right: 551, y, font: fonts.regular, size: 6.5, color: MUTED, maxWidth: 62 });
      y -= 31;
    });
  }

  drawPanel(page, { x: PDF_MARGIN, y: 95, width: CONTENT_WIDTH, height: 108, fill: rgb(1, 0.98, 0.9), border: theme.warning });
  page.drawText("OBSERVATION", { x: PDF_MARGIN + 16, y: 176, size: 7.5, font: fonts.bold, color: AMBER });
  drawTextBlock(page, health.observation, { x: PDF_MARGIN + 16, y: 152, width: CONTENT_WIDTH - 32, font: fonts.regular, size: 8.5, color: MUTED, lineHeight: 12.5, maxLines: 5 });
}

function drawTableHeader(page, fonts, theme, columns, y, height = 29) {
  page.drawRectangle({ x: PDF_MARGIN, y: y - height + 8, width: CONTENT_WIDTH, height, color: LIGHT });
  page.drawRectangle({ x: PDF_MARGIN, y: y + 5.5, width: CONTENT_WIDTH, height: 2.5, color: theme.primary });
  let x = PDF_MARGIN;
  columns.forEach((column) => {
    const label = pdfSafeText(column.label).toUpperCase();
    const size = fitSize(fonts.bold, label, column.size || 6.2, column.width - 10, 5.1);
    const textWidth = fonts.bold.widthOfTextAtSize(label, size);
    const drawX = column.align === "right" ? x + column.width - textWidth - 6 : column.align === "center" ? x + (column.width - textWidth) / 2 : x + 6;
    page.drawText(label, { x: drawX, y: y - 10, size, font: fonts.bold, color: MUTED });
    x += column.width;
  });
  return y - height;
}

function prepareTableRow(fonts, columns, values, baseSize = 7.2, maxLines = 2) {
  const cells = columns.map((column, index) => {
    const value = values[index] || {};
    const font = value?.bold ? fonts.bold : fonts.regular;
    const isMoney = Object.prototype.hasOwnProperty.call(value, "moneyValue");
    const rawText = isMoney ? compactMoneyNumber(value.moneyValue) : (value?.text ?? values[index] ?? "");
    const text = pdfSafeText(rawText);
    const preferredSize = value?.size || baseSize;
    const size = isMoney
      ? fitSignatureMoneySize(font, value.moneyValue, preferredSize, column.width - 12, 5.4, { showPlus: value.showPlus === true })
      : fitSize(font, text, preferredSize, column.width - 12, 5.4);
    const lines = isMoney ? [text] : wrapText(text, font, size, column.width - 12).slice(0, value?.maxLines || maxLines);
    const detail = pdfSafeText(value?.detail || "");
    const detailSize = Math.max(5.4, Math.min(size - 0.6, value?.detailSize || baseSize - 0.4));
    const detailLines = detail ? wrapText(detail, fonts.regular, detailSize, column.width - 12).slice(0, value?.detailMaxLines || 2) : [];
    return { text, font, size, lines, color: value?.color || INK, align: value?.align || column.align || "left", isMoney, moneyValue: value?.moneyValue, showPlus: value?.showPlus === true, detail, detailSize, detailLines, detailColor: value?.detailColor || MUTED };
  });
  const lineHeight = 9.5;
  const rowHeight = Math.max(31, Math.max(...cells.map((cell) => {
    const mainHeight = Math.max(1, cell.lines.length) * lineHeight;
    const detailHeight = cell.detailLines.length ? cell.detailLines.length * 8 + 3 : 0;
    return mainHeight + detailHeight;
  })) + 15);
  return { cells, rowHeight, lineHeight };
}

function drawTableRow(page, columns, prepared, y, index) {
  if (index % 2 === 1) page.drawRectangle({ x: PDF_MARGIN, y: y - prepared.rowHeight + 8, width: CONTENT_WIDTH, height: prepared.rowHeight, color: LIGHT });
  page.drawLine({ start: { x: PDF_MARGIN, y: y - prepared.rowHeight + 8 }, end: { x: 551, y: y - prepared.rowHeight + 8 }, thickness: 0.45, color: BORDER });
  let x = PDF_MARGIN;
  prepared.cells.forEach((cell, cellIndex) => {
    cell.lines.forEach((line, lineIndex) => {
      const lineWidth = cell.font.widthOfTextAtSize(line, cell.size);
      const drawX = cell.align === "right" ? x + columns[cellIndex].width - lineWidth - 6 : cell.align === "center" ? x + (columns[cellIndex].width - lineWidth) / 2 : x + 6;
      page.drawText(line, { x: drawX, y: y - 10 - lineIndex * prepared.lineHeight, size: cell.size, font: cell.font, color: cell.color });
    });
    x += columns[cellIndex].width;
  });
  return y - prepared.rowHeight;
}

function addAllocationTablePages(doc, fonts, report, template, theme) {
  const rows = report.allocation || [];
  if (!rows.length) return;
  const columns = [
    { label: "Asset Class", width: 110 },
    { label: "Current Value", width: 92, align: "right" },
    { label: "Monthly SIP", width: 76, align: "right" },
    { label: "Current", width: 55, align: "right" },
    { label: "Target", width: 55, align: "right" },
    { label: "Variance", width: 55, align: "right" },
    { label: "Status", width: 64 }
  ];
  let page;
  let y;
  let rowIndex = 0;
  rows.forEach((item, index) => {
    const status = allocationStatus(item);
    const variance = Number(item.variance || 0);
    const values = [
      { text: item.assetClass || "Other", bold: true },
      { text: compactMoney(item.currentValue), align: "right" },
      { text: Number(item.monthlySip || 0) ? compactMoney(item.monthlySip) : "-", align: "right" },
      { text: `${Number(item.currentPercentage || 0).toFixed(1)}%`, align: "right" },
      { text: `${Number(item.targetPercentage || 0).toFixed(1)}%`, align: "right" },
      { text: `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%`, align: "right", bold: true, color: Math.abs(variance) < 1 ? theme.success : theme.danger },
      { text: status.label, color: status.tone === "danger" ? theme.danger : status.tone === "success" ? theme.success : MUTED }
    ];
    const prepared = prepareTableRow(fonts, columns, values, 6.8, 2);
    if (!page || y - prepared.rowHeight < CONTENT_BOTTOM + 18) {
      page = addPage(doc, fonts, report, template, theme, index === 0 ? "Allocation details" : "Allocation details - continued");
      y = drawTableHeader(page, fonts, theme, columns, 704);
      rowIndex = 0;
    }
    y = drawTableRow(page, columns, prepared, y, rowIndex);
    rowIndex += 1;
  });
}

function addHoldingsPages(doc, fonts, report, template, theme) {
  const rows = report.funds || [];
  const columns = [
    { label: "Fund / Instrument", width: 142 },
    { label: "Class", width: 60 },
    { label: "Linked Goal", width: 88 },
    { label: "SIP", width: 58, align: "right" },
    { label: "Value", width: 70, align: "right" },
    { label: "Weight", width: 43, align: "right" },
    { label: "Type", width: 46 }
  ];
  if (!rows.length) {
    const page = addPage(doc, fonts, report, template, theme, "Detailed holdings");
    drawEmptyState(page, fonts, "No investment holdings were included in this report.");
    return;
  }
  const total = Number(report.summary?.totalCorpus || 0);
  let page;
  let y;
  let rowIndex = 0;
  rows.forEach((item, index) => {
    const weight = total ? Number(item.currentValue || 0) / total * 100 : 0;
    const values = [
      { text: item.instrumentName || "Investment", bold: true, maxLines: 2 },
      { text: item.assetClass || "Other" },
      { text: item.bucketLabel || item.goalName || "General Wealth (Default)", maxLines: 2 },
      { text: Number(item.monthlySip || 0) ? compactMoney(item.monthlySip) : "-", align: "right" },
      { text: compactMoney(item.currentValue), align: "right", bold: true },
      { text: `${weight.toFixed(1)}%`, align: "right" },
      { text: item.type || "-" }
    ];
    const prepared = prepareTableRow(fonts, columns, values, 6.5, 2);
    if (!page || y - prepared.rowHeight < CONTENT_BOTTOM + 18) {
      page = addPage(doc, fonts, report, template, theme, index === 0 ? "Detailed holdings" : "Detailed holdings - continued");
      page.drawText("Every investment in your portfolio, its Bucket List or General Wealth (Default) assignment, and its current value.", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.regular, color: MUTED });
      y = drawTableHeader(page, fonts, theme, columns, 684);
      rowIndex = 0;
    }
    y = drawTableRow(page, columns, prepared, y, rowIndex);
    rowIndex += 1;
  });
}

function addTradingSummaryPage(doc, fonts, report, template, theme) {
  const trading = report.tradingSummary || null;
  if (!trading || Number(trading.totalTrades || 0) <= 0) return;
  const page = addPage(doc, fonts, report, template, theme, "Trading Activity");
  page.drawText("Monthly trading performance is reported separately from the long-term investment portfolio and goal corpus.", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.regular, color: MUTED });
  const stats = [
    ["TOTAL TRADES", String(Number(trading.totalTrades || 0)), `${Number(trading.winningTrades || 0)} winning | ${Number(trading.losingTrades || 0)} losing`],
    ["GROSS P&L", compactMoney(trading.grossPnl || 0), "Before charges"],
    ["TOTAL CHARGES", compactMoney(trading.totalCharges || 0), "Brokerage and recorded charges"],
    ["NET REALISED P&L", compactMoney(trading.netPnl || 0), "Not automatically added to goal corpus"]
  ];
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * 3) / 4;
  stats.forEach(([label, value, helper], index) => {
    const x = PDF_MARGIN + index * (width + gap);
    drawPanel(page, { x, y: 520, width, height: 150, fill: LIGHT, border: BORDER });
    page.drawText(label, { x: x + 12, y: 640, size: 6.2, font: fonts.bold, color: MUTED });
    const valueSize = fitSize(fonts.bold, pdfSafeText(value), 13, width - 24, 7);
    page.drawText(pdfSafeText(value), { x: x + 12, y: 606, size: valueSize, font: fonts.bold, color: INK });
    drawTextBlock(page, helper, { x: x + 12, y: 574, width: width - 24, font: fonts.regular, size: 6.7, color: MUTED, lineHeight: 9, maxLines: 3 });
  });
  drawPanel(page, { x: PDF_MARGIN, y: 330, width: CONTENT_WIDTH, height: 150, fill: WHITE, border: theme.primary });
  page.drawText("TRADING TREATMENT", { x: PDF_MARGIN + 16, y: 448, size: 7.5, font: fonts.bold, color: theme.primary });
  drawTextBlock(page, "Realised trading profit or loss remains part of trading activity. It contributes to long-term wealth or a financial goal only when GrowVest records an actual transfer or investment allocation.", { x: PDF_MARGIN + 16, y: 416, width: CONTENT_WIDTH - 32, font: fonts.regular, size: 9, color: MUTED, lineHeight: 13, maxLines: 5 });
}

function addTransactionsPages(doc, fonts, report, template, theme) {
  const rows = deriveReportTransactions(report);
  const columns = [
    { label: "Date", width: 74 },
    { label: "Transaction Type", width: 92 },
    { label: "Instrument", width: 145 },
    { label: "Amount", width: 78, align: "right" },
    { label: "Notes", width: 118 }
  ];
  if (!rows.length) {
    const page = addPage(doc, fonts, report, template, theme, "Transactions");
    drawEmptyState(page, fonts, "No transaction-level data was recorded for this report.");
    return;
  }
  let page;
  let y;
  let rowIndex = 0;
  rows.forEach((item, index) => {
    const values = [
      { text: dateText(item.date) },
      { text: item.type },
      { text: item.instrumentName || "Investment", bold: true, maxLines: 2 },
      { text: compactMoney(item.amount), align: "right", bold: true },
      { text: item.notes || "-", maxLines: 3 }
    ];
    const prepared = prepareTableRow(fonts, columns, values, 6.8, 3);
    if (!page || y - prepared.rowHeight < CONTENT_BOTTOM + 18) {
      page = addPage(doc, fonts, report, template, theme, index === 0 ? "Transactions" : "Transactions - continued");
      page.drawText("Monthly investments and withdrawals included in this report.", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.regular, color: MUTED });
      y = drawTableHeader(page, fonts, theme, columns, 684);
      rowIndex = 0;
    }
    y = drawTableRow(page, columns, prepared, y, rowIndex);
    rowIndex += 1;
  });
}

function addCommentaryPage(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Partner commentary");
  const insights = deriveAdvisorInsights(report);
  const holdings = (report.holdings || []).slice(0, 7);
  drawPanel(page, { x: PDF_MARGIN, y: 518, width: CONTENT_WIDTH, height: 190, fill: WHITE, border: BORDER });
  page.drawText("PORTFOLIO COMPOSITION", { x: PDF_MARGIN + 16, y: 680, size: 8, font: fonts.bold, color: MUTED });
  if (holdings.length) {
    let y = 647;
    holdings.forEach((item) => {
      const percentage = Math.min(100, Math.max(0, Number(item.percentage || 0)));
      page.drawText(pdfSafeText(item.assetClass || "Other"), { x: PDF_MARGIN + 16, y, size: 7.5, font: fonts.bold, color: INK });
      page.drawRectangle({ x: 180, y: y - 1, width: 275, height: 8, color: rgb(0.92, 0.93, 0.96) });
      page.drawRectangle({ x: 180, y: y - 1, width: Math.max(1, 275 * percentage / 100), height: 8, color: theme.primary });
      drawRightText(page, `${percentage.toFixed(1)}%`, { right: 535, y, font: fonts.bold, size: 7, color: INK, maxWidth: 60 });
      y -= 21;
    });
  } else {
    page.drawText("No portfolio-composition data was included.", { x: PDF_MARGIN + 16, y: 630, size: 8.5, font: fonts.regular, color: MUTED });
  }

  page.drawRectangle({ x: PDF_MARGIN, y: 294, width: CONTENT_WIDTH, height: 198, color: theme.dark });
  page.drawText(`PARTNER INSIGHTS | ${monthLabel(report.reportMonth).toUpperCase()} ${report.reportYear || ""}`, { x: PDF_MARGIN + 20, y: 463, size: 7.5, font: fonts.bold, color: theme.secondary });
  drawTextBlock(page, `"${insights.narrative}"`, { x: PDF_MARGIN + 20, y: 428, width: CONTENT_WIDTH - 40, font: fonts.regular, size: 12.5, color: WHITE, lineHeight: 18, maxLines: 6 });
  page.drawText(pdfSafeText(report.advisorName || `${theme.branding.companyName || "GrowVest"} Partner`), { x: PDF_MARGIN + 20, y: 326, size: 10, font: fonts.bold, color: WHITE });
  page.drawText(`${pdfSafeText(investorFacingAdvisorDesignation(report.advisorDesignation))} | ${pdfSafeText(theme.branding.legalName || theme.branding.companyName || "GrowVest Advisors Private Limited")}`, { x: PDF_MARGIN + 20, y: 309, size: 7, font: fonts.regular, color: rgb(0.7, 0.73, 0.8) });

  const insightItems = [
    ["Progress Highlight", insights.progressHighlight, theme.secondary],
    ["Priority Attention", insights.priorityAttention, theme.danger],
    ["Portfolio Opportunity", insights.portfolioOpportunity, theme.warning]
  ];
  const gap = 12;
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
  insightItems.forEach(([label, item, accent], index) => {
    const x = PDF_MARGIN + index * (cardWidth + gap);
    drawPanel(page, { x, y: 104, width: cardWidth, height: 164, fill: LIGHT, border: accent });
    page.drawText(label.toUpperCase(), { x: x + 12, y: 240, size: 5.8, font: fonts.bold, color: accent });
    drawTextBlock(page, item?.title || "Portfolio update", { x: x + 12, y: 216, width: cardWidth - 24, font: fonts.bold, size: 9.2, color: INK, lineHeight: 11, maxLines: 3 });
    drawTextBlock(page, item?.description || "", { x: x + 12, y: 170, width: cardWidth - 24, font: fonts.regular, size: 7.4, color: MUTED, lineHeight: 10, maxLines: 5 });
  });
}

function addProtectionPage(doc, fonts, report, template, theme) {
  const protection = report.protectionSnapshot || null;
  const policies = protection?.policies || [];
  const summary = protection?.summary || {};
  if (!protection || (!policies.length && !Number(summary.activePolicyCount || 0))) return;
  const page = addPage(doc, fonts, report, template, theme, "Insurance & Protection");
  page.drawText("PROTECTION SNAPSHOT", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.bold, color: theme.primary });
  page.drawText("Protection cover is separate from investment portfolio corpus.", { x: PDF_MARGIN, y: 694, size: 7.2, font: fonts.regular, color: MUTED });
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * 3) / 4;
  [
    ["Active Policies", String(Number(summary.activePolicyCount || 0))],
    ["Life Cover", compactMoney(summary.lifeCover || 0)],
    ["Health Cover", compactMoney(summary.healthCover || 0)],
    ["Due <=30 Days", String(Number(summary.policiesExpiringWithin30Days || 0) + Number(summary.premiumsDueWithin30Days || 0))]
  ].forEach(([label, value], index) => drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + index * (width + gap), y: 585, width, label, value }));

  let y = 548;
  const rowHeight = 46;
  if (!policies.length) {
    drawEmptyState(page, fonts, "No active insurance policy details were included in this reporting snapshot.", 500);
    return;
  }
  page.drawRectangle({ x: PDF_MARGIN, y: y - 3, width: CONTENT_WIDTH, height: 22, color: LIGHT });
  const headers = [["TYPE", PDF_MARGIN + 8], ["POLICY", 135], ["COVER", 340], ["NEXT DUE", 420], ["STATUS", 510]];
  headers.forEach(([label, x]) => page.drawText(label, { x, y: y + 5, size: 6.3, font: fonts.bold, color: MUTED }));
  y -= 30;
  policies.slice(0, 9).forEach((item) => {
    page.drawLine({ start: { x: PDF_MARGIN, y: y - 8 }, end: { x: PDF_MARGIN + CONTENT_WIDTH, y: y - 8 }, thickness: 0.5, color: BORDER });
    drawTextBlock(page, item.insuranceType || "Other", { x: PDF_MARGIN + 8, y: y + 13, width: 70, font: fonts.bold, size: 7.2, color: INK, maxLines: 2, lineHeight: 9 });
    drawTextBlock(page, `${item.productName || "Insurance Policy"}\n${item.insurer || ""} | ${item.policyNumber || ""}`, { x: 135, y: y + 13, width: 190, font: fonts.regular, size: 7, color: INK, maxLines: 3, lineHeight: 9 });
    drawRightText(page, compactMoney(item.coverAmount || 0), { right: 405, y: y + 8, font: fonts.bold, size: 7.2, color: INK, maxWidth: 65 });
    drawTextBlock(page, item.nextDueDate ? `${item.nextDueType || "Due"}\n${dateText(item.nextDueDate)}` : "-", { x: 420, y: y + 13, width: 82, font: fonts.regular, size: 6.8, color: MUTED, maxLines: 2, lineHeight: 9 });
    drawTextBlock(page, item.policyStatus || "Active", { x: 510, y: y + 9, width: 52, font: fonts.bold, size: 6.7, color: INK, maxLines: 2, lineHeight: 9 });
    y -= rowHeight;
  });
  if (policies.length > 9) page.drawText(`+ ${policies.length - 9} additional active policy record(s) in the GrowVest portal.`, { x: PDF_MARGIN, y: 90, size: 7.2, font: fonts.regular, color: MUTED });
}

function addFinancialPlanPage(doc, fonts, report, template, theme) {
  const plan = report.financialPlan || {};
  const allocations = plan.surplusAllocations || [];
  const loans = plan.loans || [];
  if (!Number(plan.monthlySurplus || 0) && !allocations.length && !loans.length) return;
  const page = addPage(doc, fonts, report, template, theme, "Surplus Allocation & Loan Position");
  page.drawText("CASH FLOW & DEBT", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.bold, color: theme.primary });
  drawPanel(page, { x: PDF_MARGIN, y: 425, width: 244, height: 250, fill: LIGHT, border: BORDER });
  page.drawText("MONTHLY SURPLUS", { x: PDF_MARGIN + 14, y: 646, size: 6.8, font: fonts.bold, color: MUTED });
  page.drawText(compactMoney(plan.monthlySurplus || 0), { x: PDF_MARGIN + 14, y: 616, size: 17, font: fonts.bold, color: theme.primary });
  page.drawText(plan.surplusMode === "percentage" ? `${Number(plan.surplusPercentage || 0)}% of monthly income` : "Fixed monthly amount", { x: PDF_MARGIN + 14, y: 596, size: 6.8, font: fonts.regular, color: MUTED });
  let y = 568;
  allocations.slice(0, 8).forEach((item) => {
    page.drawText(pdfSafeText(item.category || "Allocation"), { x: PDF_MARGIN + 14, y, size: 6.7, font: fonts.regular, color: INK });
    drawRightText(page, compactMoney(item.calculatedAmount || 0), { right: PDF_MARGIN + 228, y, font: fonts.bold, size: 6.7, color: INK, maxWidth: 75 });
    y -= 20;
  });
  if (!allocations.length) page.drawText("No surplus allocation plan recorded.", { x: PDF_MARGIN + 14, y: 558, size: 7.2, font: fonts.regular, color: MUTED });

  drawPanel(page, { x: PDF_MARGIN + 260, y: 425, width: CONTENT_WIDTH - 260, height: 250, fill: WHITE, border: BORDER });
  const totalOutstanding = loans.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0);
  page.drawText("ACTIVE LOANS / LIABILITIES", { x: PDF_MARGIN + 274, y: 646, size: 6.8, font: fonts.bold, color: MUTED });
  page.drawText(compactMoney(totalOutstanding), { x: PDF_MARGIN + 274, y: 616, size: 17, font: fonts.bold, color: theme.danger });
  y = 580;
  loans.slice(0, 6).forEach((item) => {
    drawTextBlock(page, `${item.type || "Loan"}${item.lender ? ` | ${item.lender}` : ""}`, { x: PDF_MARGIN + 274, y, width: CONTENT_WIDTH - 292, font: fonts.bold, size: 7.1, color: INK, lineHeight: 9, maxLines: 1 });
    drawTextBlock(page, `${compactMoney(item.outstandingAmount || 0)} outstanding | EMI ${compactMoney(item.emiAmount || 0)}${Number(item.interestRate || 0) ? ` | ${Number(item.interestRate).toFixed(2)}%` : ""}${Number(item.extraRepayment || 0) ? ` | Extra ${compactMoney(item.extraRepayment)}` : ""}`, { x: PDF_MARGIN + 274, y: y - 14, width: CONTENT_WIDTH - 292, font: fonts.regular, size: 6.2, color: MUTED, lineHeight: 8, maxLines: 2 });
    y -= 43;
  });
  if (!loans.length) page.drawText("No active liabilities recorded.", { x: PDF_MARGIN + 274, y: 558, size: 7.2, font: fonts.regular, color: MUTED });
}

function addActionsPages(doc, fonts, report, template, theme) {
  const actions = [...(report.profileActions || []).map((item) => ({ ...item, reportActionSource: "Investor Profile" })), ...(report.nextSteps || []).map((item) => ({ ...item, reportActionSource: "GrowVest Recommendation" }))];
  const chunks = [];
  for (let index = 0; index < actions.length; index += 6) chunks.push(actions.slice(index, index + 6));
  if (!chunks.length) chunks.push([]);
  chunks.forEach((items, pageIndex) => {
    const page = addPage(doc, fonts, report, template, theme, pageIndex === 0 ? "Upcoming / planned actions and next review" : "Upcoming / planned actions - continued");
    let y = 693;
    if (!items.length) {
      drawEmptyState(page, fonts, "No planned or follow-up actions were recorded for this month.", 650);
      y = 270;
    } else {
      items.forEach((item, index) => {
        const itemY = y - 76;
        drawPanel(page, { x: PDF_MARGIN, y: itemY, width: CONTENT_WIDTH, height: 68, fill: WHITE, border: BORDER });
        page.drawCircle({ x: PDF_MARGIN + 20, y: itemY + 45, size: 10, color: theme.primary });
        const number = String(pageIndex * 6 + index + 1);
        const numberWidth = fonts.bold.widthOfTextAtSize(number, 7.5);
        page.drawText(number, { x: PDF_MARGIN + 20 - numberWidth / 2, y: itemY + 42, size: 7.5, font: fonts.bold, color: WHITE });
        drawTextBlock(page, item.title || item.description || "Action item", { x: PDF_MARGIN + 40, y: itemY + 50, width: 310, font: fonts.bold, size: 9.3, color: INK, lineHeight: 11, maxLines: 2 });
        drawTextBlock(page, item.description && item.description !== item.title ? item.description : "", { x: PDF_MARGIN + 40, y: itemY + 27, width: 310, font: fonts.regular, size: 7.2, color: MUTED, lineHeight: 9, maxLines: 2 });
        const impact = item.financialImpactStatus === "awaiting_portfolio_confirmation"
          ? "Awaiting portfolio confirmation"
          : item.financialImpactType && item.financialImpactType !== "none"
            ? "Planned only"
            : "Non-financial";
        const requestMeta = [Number(item.requestedAmount || 0) ? `Requested ${compactMoney(item.requestedAmount)}` : "", Number(item.requestedMonthlyAmount || 0) ? `Monthly ${compactMoney(item.requestedMonthlyAmount)}` : "", item.requestedEffectiveDate ? `Preferred ${dateText(item.requestedEffectiveDate)}` : "", item.requestedTargetGoalName ? `Target ${item.requestedTargetGoalName}` : "", item.requestedAccountReference ? `Account ${item.requestedAccountReference}` : ""].filter(Boolean).join(" | ");
        const publicOwner = item.owner === "Advisor" ? "GrowVest Partner" : (item.owner || "GrowVest Partner");
        const meta = [item.reportActionSource || "GrowVest Recommendation", item.recommendationType || item.requestType || "Portfolio Review", publicOwner, item.priority || "Planned", item.status || "Recommended", impact, requestMeta, `Decision ${item.investorDecision || "Pending Discussion"}`, item.sourceReportMonthKey ? `From ${item.sourceReportMonthKey}` : "", item.dueDate ? `Due ${dateText(item.dueDate)}` : ""].filter(Boolean).join(" | ");
        drawTextBlock(page, meta, { x: 400, y: itemY + 46, width: 135, font: fonts.regular, size: 6.3, color: MUTED, align: "right", lineHeight: 8, maxLines: 3 });
        y -= 82;
      });
    }
    if (pageIndex === chunks.length - 1) {
      drawPanel(page, { x: PDF_MARGIN, y: 94, width: CONTENT_WIDTH, height: 98, fill: rgb(0.93, 0.96, 1), border: theme.primary });
      page.drawText("NEXT PORTFOLIO REVIEW", { x: PDF_MARGIN + 16, y: 164, size: 7.5, font: fonts.bold, color: theme.primary });
      page.drawText(dateText(report.nextReview?.date), { x: PDF_MARGIN + 16, y: 135, size: 14, font: fonts.bold, color: INK });
      drawTextBlock(page, report.nextReview?.note || report.nextReview?.mode || "Your GrowVest Partner will be in touch.", { x: 245, y: 146, width: 290, font: fonts.regular, size: 8.3, color: MUTED, maxLines: 3, lineHeight: 11 });
    }
  });
}

function addDisclaimerPages(doc, fonts, report, template, theme) {
  const disclaimer = pdfSafeText(report.disclaimer || "No additional disclaimer text was supplied for this report.");
  const style = template.appearance?.document?.disclaimerStyle || "standard";
  const textSize = style === "compact" ? 8.2 : style === "detailed" ? 9.2 : 8.8;
  const lineHeight = style === "compact" ? 11.5 : style === "detailed" ? 14 : 13;
  const allLines = wrapText(disclaimer, fonts.regular, textSize, CONTENT_WIDTH - (style === "compact" ? 28 : 0));
  const firstPageCapacity = style === "compact" ? 37 : style === "detailed" ? 27 : 31;
  const continuationCapacity = style === "compact" ? 51 : style === "detailed" ? 42 : 45;
  let offset = 0;
  let pageIndex = 0;
  while (offset < allLines.length || pageIndex === 0) {
    const page = addPage(doc, fonts, report, template, theme, pageIndex === 0 ? "Report information and disclaimer" : "Disclaimer - continued");
    let startY;
    let capacity;
    let textX = PDF_MARGIN;
    if (pageIndex === 0) {
      const panelHeight = style === "compact" ? 112 : 145;
      const panelY = style === "compact" ? 595 : 562;
      drawPanel(page, { x: PDF_MARGIN, y: panelY, width: CONTENT_WIDTH, height: panelHeight, fill: LIGHT, border: BORDER });
      page.drawRectangle({ x: PDF_MARGIN, y: panelY + panelHeight - 2.5, width: CONTENT_WIDTH, height: 2.5, color: theme.primary });
      const templateName = template.name || report.templateSnapshot?.name || "Premium Blue";
      const metadata = [
        ["Report reference", report.reportCode || "-"],
        ["Published version", report.publishedVersion || report.version || 1],
        ["Template", `${templateName} v${report.templateVersion || template.version || 1}`],
        ["Statement date", dateText(report.statementDate)],
        ["Generated", dateText(report.pdfGeneratedAt || report.completedAt || report.updatedAt)]
      ];
      const metaStart = style === "compact" ? 681 : 675;
      const metaGap = style === "compact" ? 18 : 24;
      metadata.forEach(([label, value], index) => {
        const metaY = metaStart - index * metaGap;
        page.drawText(`${label.toUpperCase()}:`, { x: PDF_MARGIN + 18, y: metaY, size: 6.2, font: fonts.bold, color: MUTED });
        page.drawText(pdfSafeText(value), { x: 190, y: metaY, size: 7.8, font: fonts.regular, color: INK });
      });
      startY = style === "compact" ? 553 : 525;
      capacity = firstPageCapacity;
      if (style === "compact") textX = PDF_MARGIN + 14;
    } else {
      startY = 704;
      capacity = continuationCapacity;
      if (style === "compact") textX = PDF_MARGIN + 14;
    }
    const lines = allLines.slice(offset, offset + capacity);
    lines.forEach((line, index) => page.drawText(line, { x: textX, y: startY - index * lineHeight, size: textSize, font: fonts.regular, color: MUTED }));
    offset += lines.length;
    pageIndex += 1;
    if (!allLines.length) break;
  }
}

const SIGNATURE_ASSET_HEX = {
  "Mutual Funds": "#1F4ED8",
  "Mutual Fund": "#1F4ED8",
  Equity: "#0CC0DF",
  Debt: "#6B7280",
  "Fixed Income": "#6B7280",
  Liquid: "#F5B301",
  Cash: "#F5B301",
  Gold: "#F5B301",
  Insurance: "#86DCEB",
  ULIP: "#86DCEB",
  Trading: "#E53935",
  "Real Estate": "#0B0B0F",
  Other: "#6B7280"
};

const RUPEE_GLYPH_PATH = "M106 123 161 0H1199L1144 123H790Q869 201 890 330H1199L1144 453H898Q893 579 832 664Q767 757 642 793Q707 815 768 887Q827 955 892 1085L1097 1493H880L689 1110Q614 959 546 911Q476 862 356 862H136V696H390Q536 696 610 629Q678 567 684 453H106L161 330H673Q655 263 610 211Q536 123 390 123Z";

function compactMoneyNumber(value) {
  const amount = Math.abs(Number(value || 0));
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2).replace(/\.00$/, "")} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function signatureMoneyWidth(font, value, size, { showPlus = false } = {}) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : showPlus && amount > 0 ? "+" : "";
  const signWidth = sign ? font.widthOfTextAtSize(sign, size) + size * 0.08 : 0;
  const rupeeWidth = size * 0.76;
  const numberWidth = font.widthOfTextAtSize(compactMoneyNumber(amount), size);
  return signWidth + rupeeWidth + size * 0.08 + numberWidth;
}

function fitSignatureMoneySize(font, value, preferredSize, maxWidth, minimumSize = 5.5, options = {}) {
  let size = preferredSize;
  while (size > minimumSize && signatureMoneyWidth(font, value, size, options) > maxWidth) size -= 0.25;
  return size;
}

function drawSignatureMoney(page, font, value, { x = 0, right, y, size = 10, color = INK, align = "left", maxWidth = 200, minimumSize = 5.5, showPlus = false } = {}) {
  const amount = Number(value || 0);
  const fitted = fitSignatureMoneySize(font, amount, size, maxWidth, minimumSize, { showPlus });
  const sign = amount < 0 ? "-" : showPlus && amount > 0 ? "+" : "";
  const number = compactMoneyNumber(amount);
  const totalWidth = signatureMoneyWidth(font, amount, fitted, { showPlus });
  let cursor = right != null ? right - totalWidth : align === "center" ? x - totalWidth / 2 : x;
  if (sign) {
    page.drawText(sign, { x: cursor, y, size: fitted, font, color });
    cursor += font.widthOfTextAtSize(sign, fitted) + fitted * 0.08;
  }
  const scale = fitted / 1493;
  page.drawSvgPath(RUPEE_GLYPH_PATH, { x: cursor - 106 * scale, y: y + fitted * 0.8, scale, color });
  cursor += fitted * 0.76 + fitted * 0.08;
  page.drawText(number, { x: cursor, y, size: fitted, font, color });
  return { size: fitted, width: totalWidth };
}

function signatureCopy(value = "") {
  return pdfSafeMultiline(value)
    .replace(/\bdisciplined contributions\b/gi, "consistent contributions")
    .replace(/\bdisciplined investing\b/gi, "consistent investing")
    .replace(/\bdiscipline\b/gi, "consistency");
}

function hasConfiguredAllocationTargets(allocation = []) {
  return (Array.isArray(allocation) ? allocation : []).some((item) => Number(item?.targetPercentage || 0) > 0);
}

function signatureAssetHex(item = {}, index = 0) {
  const key = String(item.assetClass || item.investmentType || "Other").trim();
  const fallback = ["#1F4ED8", "#0CC0DF", "#6B7280", "#F5B301", "#E53935", "#0B0B0F"];
  return SIGNATURE_ASSET_HEX[key] || fallback[index % fallback.length];
}

function signaturePositiveColor(theme, value) {
  return Number(value || 0) >= 0 ? theme.secondary : theme.danger;
}

function signatureOverallReturn(summary = {}) {
  const invested = Number(summary.totalInvested || 0);
  const gain = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - invested));
  return invested ? (gain / invested) * 100 : 0;
}

function drawSignatureIntro(page, fonts, text, y = 708) {
  return drawTextBlock(page, text, {
    x: PDF_MARGIN,
    y,
    width: CONTENT_WIDTH,
    font: fonts.regular,
    size: 9.1,
    color: MUTED,
    lineHeight: 12.5,
    maxLines: 3
  });
}

function drawSignatureVectorIcon(page, kind, { cx, cy, color, size = 14, lineWidth = 1.45 } = {}) {
  const s = size / 14;
  const line = (x1, y1, x2, y2, thickness = lineWidth) => page.drawLine({
    start: { x: cx + x1 * s, y: cy + y1 * s },
    end: { x: cx + x2 * s, y: cy + y2 * s },
    thickness: thickness * s,
    color
  });
  const circle = (x, y, radius, borderWidth = lineWidth) => page.drawCircle({
    x: cx + x * s,
    y: cy + y * s,
    size: radius * s,
    borderColor: color,
    borderWidth: borderWidth * s
  });
  const rect = (x, y, width, height, borderWidth = lineWidth) => page.drawRectangle({
    x: cx + x * s,
    y: cy + y * s,
    width: width * s,
    height: height * s,
    borderColor: color,
    borderWidth: borderWidth * s
  });

  switch (kind) {
    case "portfolio":
    case "performance": {
      page.drawRectangle({ x: cx - 6 * s, y: cy - 6 * s, width: 2.6 * s, height: 6 * s, color });
      page.drawRectangle({ x: cx - 1.3 * s, y: cy - 6 * s, width: 2.6 * s, height: 9.5 * s, color });
      page.drawRectangle({ x: cx + 3.4 * s, y: cy - 6 * s, width: 2.6 * s, height: 13 * s, color });
      line(-6, 4, -1.6, 7.2);
      line(-1.6, 7.2, 2.2, 5.3);
      line(2.2, 5.3, 6.5, 9.4);
      line(6.5, 9.4, 5.6, 6.8);
      line(6.5, 9.4, 3.8, 9.1);
      break;
    }
    case "invested": {
      circle(-3.1, 4.1, 4.1);
      circle(3.4, 0.2, 4.1);
      circle(-2.4, -4.4, 4.1);
      line(-5.2, 4.1, -1.1, 4.1, 1.0);
      line(1.4, 0.2, 5.4, 0.2, 1.0);
      line(-4.5, -4.4, -0.4, -4.4, 1.0);
      break;
    }
    case "gain": {
      line(-6, -5, -2.4, -1.5);
      line(-2.4, -1.5, 1.1, -3.2);
      line(1.1, -3.2, 6, 3.6, 1.8);
      line(6, 3.6, 5.2, 0.7, 1.8);
      line(6, 3.6, 3.0, 3.2, 1.8);
      line(-6, 6, -6, -7, 1.0);
      line(-6, -7, 7, -7, 1.0);
      break;
    }
    case "sip":
    case "calendar": {
      rect(-6, -5.7, 12, 10.8, 1.25);
      line(-6, 2.2, 6, 2.2, 1.25);
      line(-3.2, 7, -3.2, 3.8, 1.6);
      line(3.2, 7, 3.2, 3.8, 1.6);
      [-3, 0.2, 3.3].forEach((x) => {
        page.drawCircle({ x: cx + x * s, y: cy - 0.7 * s, size: 0.9 * s, color });
        page.drawCircle({ x: cx + x * s, y: cy - 3.5 * s, size: 0.9 * s, color });
      });
      break;
    }
    case "target": {
      circle(0, 0, 6.1, 1.1);
      circle(0, 0, 3.5, 1.1);
      page.drawCircle({ x: cx, y: cy, size: 1.2 * s, color });
      line(1.2, 1.2, 7.2, 7.2, 1.5);
      line(7.2, 7.2, 4.5, 6.8, 1.5);
      line(7.2, 7.2, 6.8, 4.5, 1.5);
      break;
    }
    case "leaf": {
      // Keep the GrowVest leaf visually centred inside circular badges. The previous
      // filled path sat low/right and made otherwise centred callouts look misaligned.
      page.drawSvgPath("M 1 7 C 1 3.2 4.2 1 8.1 1 C 11.7 1 13 3.7 13 7.4 C 10.2 11.2 6.0 12.6 2.0 10.7 C 4.4 9.7 7.0 7.3 9.6 4.4", {
        x: cx - 7.0 * s,
        y: cy - 6.8 * s,
        scale: 1.0 * s,
        color,
        opacity: 0,
        borderColor: color,
        borderWidth: 1.15 * s,
        borderOpacity: 1
      });
      line(-4.2, -3.5, 4.3, 4.0, 1.05);
      break;
    }
    case "binoculars": {
      circle(-3.7, -1.8, 3.1, 1.2);
      circle(3.7, -1.8, 3.1, 1.2);
      line(-5.2, 1.0, -3.7, 5.3, 1.6);
      line(5.2, 1.0, 3.7, 5.3, 1.6);
      line(-3.6, 4.8, 3.6, 4.8, 1.4);
      line(-1.4, 1.7, 1.4, 1.7, 1.2);
      break;
    }
    case "compass": {
      circle(0, 0, 6.2, 1.1);
      line(-2.1, -3.1, 2.5, 3.8, 1.3);
      line(2.5, 3.8, 1.1, -1.2, 1.3);
      line(1.1, -1.2, -2.1, -3.1, 1.3);
      page.drawCircle({ x: cx, y: cy, size: 0.9 * s, color });
      break;
    }
    case "gear": {
      circle(0, 0, 4.5, 1.2);
      circle(0, 0, 1.4, 1.2);
      for (let i = 0; i < 8; i += 1) {
        const a = Math.PI * i / 4;
        const x1 = Math.cos(a) * 5.0;
        const y1 = Math.sin(a) * 5.0;
        const x2 = Math.cos(a) * 7.0;
        const y2 = Math.sin(a) * 7.0;
        line(x1, y1, x2, y2, 1.8);
      }
      break;
    }
    case "check": {
      circle(0, 0, 6.2, 1.1);
      line(-3.2, 0, -0.8, -2.4, 1.6);
      line(-0.8, -2.4, 3.7, 3.0, 1.6);
      break;
    }
    case "shield": {
      page.drawSvgPath("M 7 0 L 13 3 L 12 9 C 11 13 8 15 7 16 C 6 15 3 13 2 9 L 1 3 Z", { x: cx - 7 * s, y: cy - 8 * s, scale: 1.0 * s, borderColor: color, borderWidth: 1.1 * s });
      line(-2.2, 0, -0.3, -2.0, 1.3);
      line(-0.3, -2.0, 3.2, 2.2, 1.3);
      break;
    }
    default:
      circle(0, 0, 5.2, 1.2);
  }
}

function drawSignatureIconBadge(page, kind, { cx, cy, color, fill = WHITE, radius = 16, iconSize = 13 } = {}) {
  page.drawCircle({ x: cx, y: cy, size: radius, color: fill, borderColor: color, borderWidth: 1 });
  drawSignatureVectorIcon(page, kind, { cx, cy, color, size: iconSize });
}

function drawSignatureImageBadge(page, image, { cx, cy, fill = WHITE, borderColor = null, radius = 15, imageWidth = 25, imageHeight = 15 } = {}) {
  const circleOptions = { x: cx, y: cy, size: radius, color: fill };
  if (borderColor) {
    circleOptions.borderColor = borderColor;
    circleOptions.borderWidth = 1;
  }
  page.drawCircle(circleOptions);
  if (image) {
    drawPdfImageFit(page, image, {
      x: cx - imageWidth / 2,
      y: cy - imageHeight / 2,
      maxWidth: imageWidth,
      maxHeight: imageHeight,
      align: "center",
      valign: "center"
    });
  }
}

function drawSignatureCallout(page, fonts, theme, {
  x = PDF_MARGIN,
  y,
  width = CONTENT_WIDTH,
  height = 68,
  icon = "performance",
  iconImage = null,
  tone = "primary",
  title = "",
  body = "",
  fill = rgb(0.97, 0.985, 1),
  border = rgb(0.84, 0.91, 0.96),
  titleSize = 8.3,
  bodySize = 7.1,
  bodyColor = MUTED,
  textInset = 62,
  iconRadius = 11,
  iconSize = 8.4,
  iconImageWidth = 24,
  iconImageHeight = 14
} = {}) {
  const accent = tone === "cyan" ? theme.secondary : tone === "danger" ? theme.danger : theme.primary;
  drawPanel(page, { x, y, width, height, fill, border });
  const centerY = y + height / 2;
  const badgeX = x + 30;
  if (iconImage) {
    drawSignatureImageBadge(page, iconImage, {
      cx: badgeX, cy: centerY, fill: WHITE, borderColor: accent, radius: iconRadius + 1,
      imageWidth: iconImageWidth, imageHeight: iconImageHeight
    });
  } else {
    drawSignatureIconBadge(page, icon, { cx: badgeX, cy: centerY, color: accent, fill: WHITE, radius: iconRadius, iconSize });
  }

  const textX = x + textInset;
  const textWidth = width - textInset - 18;
  const safeTitle = pdfSafeText(title).trim();
  const safeBody = pdfSafeText(body).trim();
  if (safeTitle && safeBody) {
    page.drawText(safeTitle, { x: textX, y: centerY + 8.5, size: titleSize, font: fonts.bold, color: accent });
    drawTextBlock(page, safeBody, { x: textX, y: centerY - 8.5, width: textWidth, font: fonts.regular, size: bodySize, color: bodyColor, lineHeight: bodySize + 3.0, maxLines: 2 });
  } else if (safeTitle) {
    page.drawText(safeTitle, { x: textX, y: centerY - titleSize * 0.34, size: titleSize, font: fonts.bold, color: accent });
  } else if (safeBody) {
    drawTextBlock(page, safeBody, { x: textX, y: centerY - bodySize * 0.34, width: textWidth, font: fonts.regular, size: bodySize, color: bodyColor, lineHeight: bodySize + 3.0, maxLines: 2 });
  }
}

function drawSignatureClosingBanner(page, fonts, report, theme, { y = 96, height = 64 } = {}) {
  drawPanel(page, { x: PDF_MARGIN, y, width: CONTENT_WIDTH, height, fill: theme.primary, border: theme.primary });
  page.drawRectangle({ x: PDF_MARGIN + CONTENT_WIDTH - 6, y, width: 6, height, color: theme.secondary });
  const centerY = y + height / 2;
  page.drawCircle({ x: PDF_MARGIN + 31, y: centerY, size: 15, color: WHITE, opacity: 0.14 });
  const whiteIcon = report.__brandingAssets?.iconWhite;
  if (whiteIcon) {
    drawPdfImageFit(page, whiteIcon, { x: PDF_MARGIN + 18, y: centerY - 7, maxWidth: 26, maxHeight: 14, align: "center", valign: "center" });
  }
  page.drawText("Grow and Invest With Us", { x: PDF_MARGIN + 66, y: centerY + 5.5, size: 10.6, font: fonts.bold, color: WHITE });
  page.drawText("Building a more secure, fulfilling tomorrow, together.", { x: PDF_MARGIN + 66, y: centerY - 11.5, size: 7.0, font: fonts.regular, color: WHITE });
}

function drawSignatureMetricCard(page, fonts, theme, { x, y, width, label, value, moneyValue, showPlus = false, helper = "", tone = "primary", icon = "portfolio" }) {
  const accent = tone === "cyan" ? theme.secondary : tone === "danger" ? theme.danger : theme.primary;
  const fill = tone === "danger" ? rgb(1, 0.965, 0.96) : tone === "cyan" ? rgb(0.96, 0.995, 1) : rgb(0.965, 0.98, 1);
  drawPanel(page, { x, y, width, height: 96, fill, border: rgb(0.86, 0.9, 0.95) });
  page.drawRectangle({ x, y, width: 3, height: 96, color: accent });
  drawSignatureIconBadge(page, icon, { cx: x + 29, cy: y + 50, color: accent, fill: WHITE, radius: 16, iconSize: 12.8 });
  page.drawText(pdfSafeText(label), { x: x + 50, y: y + 66, size: 7.2, font: fonts.regular, color: MUTED });
  if (moneyValue !== undefined) {
    drawSignatureMoney(page, fonts.bold, moneyValue, { x: x + 50, y: y + 39, size: 18.5, color: theme.dark, maxWidth: width - 64, minimumSize: 10.5, showPlus });
  } else {
    const valueText = pdfSafeText(value);
    const valueSize = fitSize(fonts.bold, valueText, 17.5, width - 64, 10.5);
    page.drawText(valueText, { x: x + 50, y: y + 39, size: valueSize, font: fonts.bold, color: theme.dark });
  }
  if (helper) {
    const helperColor = tone === "danger" ? theme.danger : theme.secondary;
    page.drawText(pdfSafeText(helper), { x: x + 50, y: y + 20, size: 7, font: fonts.bold, color: helperColor });
  }
}

function drawSignatureTableHeader(page, fonts, theme, columns, y) {
  const height = 29;
  page.drawRectangle({ x: PDF_MARGIN, y: y - height + 8, width: CONTENT_WIDTH, height, color: rgb(0.94, 0.97, 0.99) });
  let x = PDF_MARGIN;
  columns.forEach((column) => {
    const text = pdfSafeText(column.label || "");
    const size = fitSize(fonts.bold, text, 6.6, column.width - 12, 5.2);
    const textWidth = fonts.bold.widthOfTextAtSize(text, size);
    const drawX = column.align === "right"
      ? x + column.width - textWidth - 6
      : column.align === "center"
        ? x + (column.width - textWidth) / 2
        : x + 6;
    page.drawText(text, { x: drawX, y: y - 10, size, font: fonts.bold, color: rgb(0.24, 0.34, 0.47) });
    x += column.width;
  });
  page.drawLine({ start: { x: PDF_MARGIN, y: y - height + 8 }, end: { x: 551, y: y - height + 8 }, thickness: 0.55, color: rgb(0.83, 0.88, 0.93) });
  return y - height;
}

function drawSignatureTableRow(page, fonts, columns, values, y, index, { baseSize = 7.1, maxLines = 2, total = false } = {}) {
  const prepared = prepareTableRow(fonts, columns, values, baseSize, maxLines);
  if (total) {
    page.drawRectangle({ x: PDF_MARGIN, y: y - prepared.rowHeight + 8, width: CONTENT_WIDTH, height: prepared.rowHeight, color: rgb(0.94, 0.97, 0.99) });
  } else if (index % 2 === 1) {
    page.drawRectangle({ x: PDF_MARGIN, y: y - prepared.rowHeight + 8, width: CONTENT_WIDTH, height: prepared.rowHeight, color: rgb(0.986, 0.991, 0.997) });
  }
  page.drawLine({ start: { x: PDF_MARGIN, y: y - prepared.rowHeight + 8 }, end: { x: 551, y: y - prepared.rowHeight + 8 }, thickness: 0.45, color: rgb(0.89, 0.92, 0.95) });
  let x = PDF_MARGIN;
  prepared.cells.forEach((cell, cellIndex) => {
    const column = columns[cellIndex];
    const drawFont = total ? fonts.bold : cell.font;
    if (cell.isMoney) {
      if (cell.align === "right") drawSignatureMoney(page, drawFont, cell.moneyValue, { right: x + column.width - 6, y: y - 10, size: cell.size, color: cell.color, maxWidth: column.width - 12, minimumSize: 5.4, showPlus: cell.showPlus });
      else drawSignatureMoney(page, drawFont, cell.moneyValue, { x: x + 6, y: y - 10, size: cell.size, color: cell.color, maxWidth: column.width - 12, minimumSize: 5.4, showPlus: cell.showPlus });
    } else {
      cell.lines.forEach((line, lineIndex) => {
        const lineWidth = drawFont.widthOfTextAtSize(line, cell.size);
        const drawX = cell.align === "right"
          ? x + column.width - lineWidth - 6
          : cell.align === "center"
            ? x + (column.width - lineWidth) / 2
            : x + 6;
        page.drawText(line, { x: drawX, y: y - 10 - lineIndex * prepared.lineHeight, size: cell.size, font: drawFont, color: cell.color });
      });
    }
    if (cell.detailLines.length) {
      const detailStart = y - 10 - Math.max(1, cell.lines.length) * prepared.lineHeight - 1;
      cell.detailLines.forEach((line, lineIndex) => {
        const detailWidth = fonts.regular.widthOfTextAtSize(line, cell.detailSize);
        const detailX = cell.align === "right"
          ? x + column.width - detailWidth - 6
          : cell.align === "center"
            ? x + (column.width - detailWidth) / 2
            : x + 6;
        page.drawText(line, { x: detailX, y: detailStart - lineIndex * 8, size: cell.detailSize, font: fonts.regular, color: cell.detailColor });
      });
    }
    x += column.width;
  });
  return y - prepared.rowHeight;
}

function signatureGoalFundMatch(goal, fund) {
  const goalId = String(goal?.goalId || goal?.id || "");
  const goalName = String(goal?.name || "").trim().toLowerCase();
  if (goalId && String(fund?.goalId || "") === goalId) return true;
  if (goalName && [fund?.goalName, fund?.bucketLabel].some((value) => String(value || "").trim().toLowerCase() === goalName)) return true;
  return Array.isArray(fund?.goalAllocations) && fund.goalAllocations.some((allocation) => {
    if (goalId && String(allocation?.goalId || "") === goalId) return true;
    return goalName && String(allocation?.goalName || allocation?.name || "").trim().toLowerCase() === goalName;
  });
}

function addSignatureCover(doc, fonts, report, template, theme) {
  const page = doc.addPage(A4);
  const summary = report.summary || {};
  const invested = Number(summary.totalInvested || 0);
  const gain = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - invested));
  const overallReturn = signatureOverallReturn(summary);
  const isOpening = isOpeningReview(report);
  const period = `${monthLabel(report.reportMonth)} ${report.reportYear || ""}`.trim();

  page.drawRectangle({ x: 0, y: 0, width: PDF_A4_WIDTH, height: PDF_A4_HEIGHT, color: rgb(0.985, 0.995, 1) });

  const background = report.__brandingAssets?.coverBackground;
  if (background) {
    // Locked visual reference: keep the image sharp and proportional on the right
    // while a layered white wash protects readability on the investor-information side.
    drawSignatureCoverPhoto(page, background);
    const coverWash = report.__brandingAssets?.coverWash;
    if (coverWash) page.drawImage(coverWash, { x: 0, y: 0, width: PDF_A4_WIDTH, height: PDF_A4_HEIGHT, opacity: 1 });
    else page.drawRectangle({ x: 0, y: 0, width: PDF_A4_WIDTH * 0.56, height: PDF_A4_HEIGHT, color: WHITE, opacity: 0.94 });
    page.drawRectangle({ x: 0, y: 0, width: PDF_A4_WIDTH, height: 150, color: rgb(0.02, 0.08, 0.16), opacity: 0.10 });
  } else {
    page.drawRectangle({ x: 315, y: 0, width: PDF_A4_WIDTH - 315, height: PDF_A4_HEIGHT, color: rgb(0.94, 0.985, 1) });
  }

  const logo = report.__brandingAssets?.logo;
  if (logo) {
    drawPdfImageFit(page, logo, { x: PDF_MARGIN, y: 760, maxWidth: 174, maxHeight: 46, align: "left", valign: "top" });
  } else {
    page.drawText(pdfSafeText(theme.branding.companyName || "GrowVest"), { x: PDF_MARGIN, y: 790, size: 18, font: fonts.bold, color: theme.primary });
  }
  page.drawText(pdfSafeText(theme.branding.brandPositioning || "Your Conscious Wealth Partner"), { x: PDF_MARGIN + 30, y: 758, size: 6.4, font: fonts.regular, color: rgb(0.18, 0.29, 0.42) });
  drawTextBlock(page, "WEALTH\nFOR A BRIGHTER\nTOMORROW", { x: 447, y: 790, width: 104, font: fonts.bold, size: 8.6, color: WHITE, align: "right", lineHeight: 11.5, maxLines: 3 });

  page.drawText("INVEST  |  PLAN  |  GROW  |  LIVE BETTER", { x: PDF_MARGIN, y: 708, size: 6.2, font: fonts.bold, color: theme.primary });
  const titleLine1 = isOpening ? "OPENING" : "MONTHLY";
  page.drawText(titleLine1, { x: PDF_MARGIN, y: 652, size: 37, font: fonts.bold, color: rgb(0.04, 0.13, 0.30) });
  page.drawText("WEALTH REVIEW", { x: PDF_MARGIN, y: 610, size: 37, font: fonts.bold, color: rgb(0.04, 0.13, 0.30) });
  page.drawText(pdfSafeText(period), { x: PDF_MARGIN, y: 577, size: 14.8, font: fonts.bold, color: rgb(0.04, 0.13, 0.30) });
  page.drawRectangle({ x: PDF_MARGIN, y: 555, width: 37, height: 3.2, color: theme.primary });
  page.drawRectangle({ x: PDF_MARGIN + 37, y: 555, width: 15, height: 3.2, color: theme.secondary });

  page.drawText("Prepared for", { x: PDF_MARGIN, y: 524, size: 7.2, font: fonts.regular, color: rgb(0.28, 0.38, 0.50) });
  const investor = pdfSafeText(report.investorName || "Investor");
  page.drawText(investor, { x: PDF_MARGIN, y: 502, size: fitSize(fonts.bold, investor, 16.5, 250, 10), font: fonts.bold, color: theme.dark });

  drawPanel(page, { x: PDF_MARGIN, y: 318, width: 286, height: 151, fill: WHITE, border: rgb(0.82, 0.88, 0.94) });
  page.drawText("Your Wealth Today", { x: PDF_MARGIN + 16, y: 441, size: 8.6, font: fonts.bold, color: rgb(0.04, 0.13, 0.30) });
  drawSignatureMoney(page, fonts.bold, summary.totalCorpus || 0, { x: PDF_MARGIN + 16, y: 400, size: 30.5, color: theme.primary, maxWidth: 252, minimumSize: 18 });
  const metrics = [
    ["Invested", invested, theme.dark, true, false],
    ["Gain", gain, signaturePositiveColor(theme, gain), true, true],
    ["Overall Return", overallReturn, signaturePositiveColor(theme, overallReturn), false, false]
  ];
  metrics.forEach(([label, value, color, money, showPlus], index) => {
    const x = PDF_MARGIN + 16 + index * 88;
    if (index) page.drawLine({ start: { x: x - 8, y: 338 }, end: { x: x - 8, y: 376 }, thickness: 0.55, color: rgb(0.80, 0.85, 0.91) });
    if (money) drawSignatureMoney(page, fonts.bold, value, { x, y: 360, size: 8.8, color, maxWidth: 75, minimumSize: 6, showPlus });
    else {
      const valueText = `${overallReturn >= 0 ? "+" : ""}${overallReturn.toFixed(2)}%`;
      page.drawText(valueText, { x, y: 360, size: fitSize(fonts.bold, valueText, 8.8, 75, 6), font: fonts.bold, color });
    }
    page.drawText(label, { x, y: 342, size: 5.9, font: fonts.regular, color: rgb(0.31, 0.40, 0.51) });
  });
  page.drawText(`Portfolio position as of ${dateText(report.statementDate)}`, { x: PDF_MARGIN, y: 295, size: 6.4, font: fonts.regular, color: rgb(0.30, 0.39, 0.49) });

  drawRightText(page, theme.branding.companyName || "GrowVest", { right: 551, y: 61, font: fonts.bold, size: 13, color: WHITE, maxWidth: 155 });
  drawRightText(page, theme.branding.brandPositioning || "Your Conscious Wealth Partner", { right: 551, y: 47, font: fonts.regular, size: 5.9, color: WHITE, maxWidth: 155 });
}

function addSignatureSummary(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Wealth at a Glance");
  drawSignatureIntro(page, fonts, "A snapshot of your current financial position with GrowVest.");
  const summary = report.summary || {};
  const invested = Number(summary.totalInvested || 0);
  const gain = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - invested));
  const overallReturn = signatureOverallReturn(summary);
  const gap = 14;
  const width = (CONTENT_WIDTH - gap) / 2;
  drawSignatureMetricCard(page, fonts, theme, { x: PDF_MARGIN, y: 550, width, label: "Portfolio Value", moneyValue: summary.totalCorpus || 0, icon: "portfolio" });
  drawSignatureMetricCard(page, fonts, theme, { x: PDF_MARGIN + width + gap, y: 550, width, label: "Total Invested", moneyValue: invested, tone: "cyan", icon: "invested" });
  drawSignatureMetricCard(page, fonts, theme, { x: PDF_MARGIN, y: 424, width, label: "Gain / Loss", moneyValue: gain, showPlus: true, helper: `${overallReturn >= 0 ? "+" : ""}${overallReturn.toFixed(2)}%`, tone: gain >= 0 ? "cyan" : "danger", icon: "gain" });
  drawSignatureMetricCard(page, fonts, theme, { x: PDF_MARGIN + width + gap, y: 424, width, label: "Active Monthly SIP", moneyValue: summary.monthlySip || 0, icon: "sip" });

  const message = isOpeningReview(report)
    ? "This is your opening portfolio position with GrowVest. Future monthly reviews will track how your wealth, investments and Bucket List progress evolve from this starting point."
    : `This review captures your portfolio position for ${monthLabel(report.reportMonth)} ${report.reportYear}. Use it together with the performance and goal pages to understand what changed and what matters next.`;
  drawSignatureCallout(page, fonts, theme, {
    y: 294,
    height: 84,
    iconImage: report.__brandingAssets?.icon,
    title: isOpeningReview(report) ? "Your Starting Point" : "This Month in Context",
    body: message,
    fill: rgb(0.965, 0.985, 1),
    border: rgb(0.83, 0.91, 0.96),
    titleSize: 12.2,
    bodySize: 8.4,
    textInset: 70,
    iconRadius: 17,
    iconImageWidth: 28,
    iconImageHeight: 17
  });

}

function addSignatureAllocation(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Asset Allocation");
  drawSignatureIntro(page, fonts, "Your current portfolio mix across the reported asset classes.");
  const allocation = Array.isArray(report.allocation) ? report.allocation : [];
  const targetAllocationConfigured = hasConfiguredAllocationTargets(allocation);
  const rawComposition = Array.isArray(report.holdings) && report.holdings.length
    ? report.holdings
    : allocation.map((item) => ({ ...item, percentage: Number(item.currentPercentage || 0), currentValue: Number(item.currentValue || 0) }));
  const composition = rawComposition.map((item, index) => ({ ...item, color: signatureAssetHex(item, index) }));

  drawAllocationDonut(page, fonts, composition, report.summary?.totalCorpus || 0, {
    x: PDF_MARGIN + 18,
    y: 438,
    size: 214,
    fallbackColor: theme.primary,
    signatureMoney: true
  });
  let legendY = 640;
  composition.slice(0, 7).forEach((item, index) => {
    const color = pdfHexColor(signatureAssetHex(item, index), theme.primary);
    page.drawCircle({ x: 326, y: legendY + 3, size: 5, color });
    drawTextBlock(page, item.assetClass || "Other", { x: 341, y: legendY + 8, width: 126, font: fonts.regular, size: 8.2, color: theme.dark, lineHeight: 10, maxLines: 1 });
    drawRightText(page, `${Number(item.percentage ?? item.currentPercentage ?? 0).toFixed(1)}%`, { right: 551, y: legendY, font: fonts.bold, size: 8.2, color: theme.dark, maxWidth: 62 });
    legendY -= 30;
  });

  page.drawText("Current Allocation vs Target Allocation", { x: PDF_MARGIN, y: 408, size: 11.5, font: fonts.bold, color: theme.dark });
  if (!allocation.length) {
    drawPanel(page, { x: PDF_MARGIN, y: 225, width: CONTENT_WIDTH, height: 120, fill: rgb(0.975, 0.985, 0.995), border: BORDER });
    drawTextBlock(page, "No asset-allocation rows were included in this report snapshot.", { x: PDF_MARGIN + 20, y: 295, width: CONTENT_WIDTH - 40, font: fonts.regular, size: 9.4, color: MUTED, align: "center", maxLines: 3 });
    return;
  }
  const columns = [
    { label: "Asset Class", width: 165 },
    { label: "Current Allocation", width: 116, align: "right" },
    { label: "Target Allocation", width: 116, align: "right" },
    { label: "Variance", width: 110, align: "right" }
  ];
  let y = drawSignatureTableHeader(page, fonts, theme, columns, 383);
  allocation.slice(0, 8).forEach((item, index) => {
    const current = Number(item.currentPercentage || 0);
    const target = Number(item.targetPercentage || 0);
    const variance = Number(item.variance ?? (current - target));
    y = drawSignatureTableRow(page, fonts, columns, [
      { text: item.assetClass || "Other", bold: true },
      { text: `${current.toFixed(1)}%`, align: "right" },
      { text: targetAllocationConfigured ? `${target.toFixed(1)}%` : "Not set", align: "right", color: targetAllocationConfigured ? theme.dark : MUTED },
      { text: targetAllocationConfigured ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%` : "-", align: "right", bold: targetAllocationConfigured, color: !targetAllocationConfigured ? MUTED : Math.abs(variance) < 1 ? theme.muted : variance > 0 ? theme.danger : theme.secondary }
    ], y, index, { baseSize: 7.4 });
  });
}

function addSignatureGoals(doc, fonts, report, template, theme) {
  const goals = Array.isArray(report.goals) ? report.goals : [];
  const funds = Array.isArray(report.funds) ? report.funds : [];
  if (!goals.length) {
    const page = addPage(doc, fonts, report, template, theme, "Bucket List & Wealth Goals");
    drawSignatureIntro(page, fonts, "A Bucket List is optional. Investments without a specific goal remain part of General Wealth / Corpus Creation.");
    drawPanel(page, { x: PDF_MARGIN, y: 404, width: CONTENT_WIDTH, height: 255, fill: rgb(0.955, 0.98, 1), border: rgb(0.8, 0.89, 0.96) });
    drawSignatureIconBadge(page, "target", { cx: PDF_MARGIN + 32, cy: 620, color: theme.primary, fill: rgb(0.91, 0.98, 1), radius: 16, iconSize: 12 });
    page.drawText("General Wealth / Corpus Creation", { x: PDF_MARGIN + 58, y: 624, size: 13.5, font: fonts.bold, color: theme.dark });
    drawTextBlock(page, "Your current unallocated long-term wealth corpus.", { x: PDF_MARGIN + 58, y: 602, width: CONTENT_WIDTH - 82, font: fonts.regular, size: 8.2, color: MUTED, maxLines: 2, lineHeight: 10 });
    drawSignatureMoney(page, fonts.bold, report.summary?.generalWealthCorpus || report.summary?.totalCorpus || 0, { x: PDF_MARGIN + 18, y: 548, size: 25, color: theme.primary, maxWidth: 300, minimumSize: 14 });
    const col = (CONTENT_WIDTH - 36) / 4;
    const metricDefs = [
      { label: "Active SIP", money: Number(report.summary?.monthlySip || 0) },
      { label: "Portfolio", money: Number(report.summary?.totalCorpus || 0) },
      { label: "Goal Status", text: "General Wealth" },
      { label: "Specific Bucket List", text: "Optional" }
    ];
    metricDefs.forEach((metric, index) => {
      const x = PDF_MARGIN + 18 + index * col;
      if (index) page.drawLine({ start: { x: x - 8, y: 438 }, end: { x: x - 8, y: 500 }, thickness: 0.45, color: rgb(0.82, 0.88, 0.94) });
      page.drawText(metric.label.toUpperCase(), { x, y: 485, size: 5.6, font: fonts.bold, color: MUTED });
      if (metric.money !== undefined) drawSignatureMoney(page, fonts.bold, metric.money, { x, y: 462, size: 8.1, color: theme.dark, maxWidth: col - 14, minimumSize: 6.2 });
      else drawTextBlock(page, metric.text, { x, y: 467, width: col - 13, font: fonts.bold, size: 7.7, color: theme.dark, maxLines: 2, lineHeight: 9 });
    });
    return;
  }

  goals.forEach((goal) => {
    const page = addPage(doc, fonts, report, template, theme, "Bucket List & Wealth Goals");
    drawSignatureIntro(page, fonts, "Tracking your progress towards what matters most.");
    const current = Number(goal.currentAmount || 0);
    const target = Number(goal.targetAmount || 0);
    const progress = Math.min(100, Math.max(0, Number(goal.progress || (target ? current / target * 100 : 0))));
    const linkedFunds = funds.filter((fund) => signatureGoalFundMatch(goal, fund));

    drawPanel(page, { x: PDF_MARGIN, y: 448, width: CONTENT_WIDTH, height: 218, fill: rgb(0.955, 0.98, 1), border: rgb(0.8, 0.89, 0.96) });
    drawSignatureIconBadge(page, "target", { cx: PDF_MARGIN + 31, cy: 626, color: theme.primary, fill: rgb(0.91, 0.98, 1), radius: 16, iconSize: 12 });
    drawTextBlock(page, goal.name || "Financial Goal", { x: PDF_MARGIN + 58, y: 634, width: 360, font: fonts.bold, size: 13, color: theme.dark, maxLines: 2, lineHeight: 14 });
    drawTextBlock(page, goal.description || goal.category || "Build long-term wealth around a meaningful financial milestone.", { x: PDF_MARGIN + 58, y: 606, width: 420, font: fonts.regular, size: 7.8, color: MUTED, maxLines: 2, lineHeight: 10 });

    const amountY = 558;
    const currentMeasure = drawSignatureMoney(page, fonts.bold, current, { x: PDF_MARGIN + 18, y: amountY, size: 16, color: theme.dark, maxWidth: 170, minimumSize: 9.5 });
    const ofX = PDF_MARGIN + 18 + currentMeasure.width + 5;
    page.drawText("of", { x: ofX, y: amountY + 1, size: 10, font: fonts.regular, color: MUTED });
    drawSignatureMoney(page, fonts.bold, target, { x: ofX + 18, y: amountY, size: 16, color: theme.dark, maxWidth: 170, minimumSize: 9.5 });
    drawRightText(page, `${progress.toFixed(2)}%`, { right: 533, y: amountY, font: fonts.bold, size: 10.8, color: theme.primary, maxWidth: 80 });
    page.drawRectangle({ x: PDF_MARGIN + 18, y: 535, width: CONTENT_WIDTH - 36, height: 8, color: rgb(0.86, 0.9, 0.94) });
    if (progress > 0) page.drawRectangle({ x: PDF_MARGIN + 18, y: 535, width: Math.max(2, (CONTENT_WIDTH - 36) * progress / 100), height: 8, color: theme.primary });
    if (progress > 18) page.drawRectangle({ x: PDF_MARGIN + 18, y: 535, width: Math.max(2, (CONTENT_WIDTH - 36) * progress / 100), height: 8, color: theme.secondary, opacity: 0.26 });

    const col = (CONTENT_WIDTH - 36) / 4;
    const metrics = [
      { label: "Active SIP", money: Number(goal.monthlySip || 0), suffix: Number(goal.monthlySip || 0) ? "/month" : "Not active" },
      { label: "Target", money: target },
      { label: "Status", text: goal.status || (current > 0 ? "Invested" : "Not Started") },
      { label: "Target Horizon", text: goal.targetYear || goal.timeline || "Not set" }
    ];
    metrics.forEach((metric, index) => {
      const x = PDF_MARGIN + 18 + index * col;
      if (index) page.drawLine({ start: { x: x - 8, y: 468 }, end: { x: x - 8, y: 515 }, thickness: 0.45, color: rgb(0.82, 0.88, 0.94) });
      page.drawText(metric.label.toUpperCase(), { x, y: 503, size: 5.4, font: fonts.bold, color: MUTED });
      if (metric.money !== undefined && (metric.money > 0 || metric.label === "Target")) {
        const money = drawSignatureMoney(page, fonts.bold, metric.money, { x, y: 482, size: 7.7, color: theme.dark, maxWidth: col - 26, minimumSize: 5.8 });
        if (metric.suffix === "/month") page.drawText("/month", { x: x + money.width + 2, y: 483, size: 5.6, font: fonts.regular, color: theme.dark });
      } else {
        drawTextBlock(page, metric.suffix || metric.text || "-", { x, y: 487, width: col - 14, font: fonts.bold, size: 7.2, color: theme.dark, maxLines: 2, lineHeight: 8.5 });
      }
    });

    page.drawText("Investments contributing to this goal", { x: PDF_MARGIN, y: 414, size: 10.7, font: fonts.bold, color: theme.dark });
    if (linkedFunds.length) {
      const columns = [
        { label: "Investment", width: 277 },
        { label: "Current Value", width: 115, align: "right" },
        { label: "Active SIP", width: 115, align: "right" }
      ];
      let y = drawSignatureTableHeader(page, fonts, theme, columns, 390);
      linkedFunds.slice(0, 7).forEach((fund, index) => {
        y = drawSignatureTableRow(page, fonts, columns, [
          { text: fund.instrumentName || "Investment", bold: true, maxLines: 2 },
          { moneyValue: Number(fund.currentValue || 0), align: "right", bold: true },
          Number(fund.monthlySip || 0) ? { moneyValue: Number(fund.monthlySip || 0), align: "right" } : { text: "-", align: "right" }
        ], y, index, { baseSize: 7.1, maxLines: 2 });
      });
      if (y > 118) {
        const totalValue = linkedFunds.reduce((sum, fund) => sum + Number(fund.currentValue || 0), 0);
        const totalSip = linkedFunds.reduce((sum, fund) => sum + Number(fund.monthlySip || 0), 0);
        drawSignatureTableRow(page, fonts, columns, [
          { text: "Total", bold: true },
          { moneyValue: totalValue, align: "right", bold: true },
          { moneyValue: totalSip, align: "right", bold: true }
        ], y, linkedFunds.length, { baseSize: 7.2, total: true });
      }
    } else {
      drawPanel(page, { x: PDF_MARGIN, y: 220, width: CONTENT_WIDTH, height: 145, fill: rgb(0.975, 0.985, 0.995), border: BORDER });
      page.drawText("No investment linked yet", { x: PDF_MARGIN + 18, y: 320, size: 10, font: fonts.bold, color: theme.dark });
      drawTextBlock(page, "The goal exists, but no current Portfolio Master holding is linked to it in this report snapshot.", { x: PDF_MARGIN + 18, y: 297, width: CONTENT_WIDTH - 36, font: fonts.regular, size: 8, color: MUTED, lineHeight: 12, maxLines: 4 });
    }

    drawPanel(page, { x: PDF_MARGIN, y: 76, width: CONTENT_WIDTH, height: 58, fill: rgb(0.94, 0.98, 1), border: rgb(0.82, 0.92, 0.96) });
    drawSignatureIconBadge(page, "check", { cx: PDF_MARGIN + 20, cy: 105, color: theme.secondary, fill: WHITE, radius: 8.5, iconSize: 7 });
    page.drawText(progress >= 100 ? "Goal completed" : progress > 0 ? "Progress underway" : "Ready to begin", { x: PDF_MARGIN + 38, y: 111, size: 7.8, font: fonts.bold, color: theme.primary });
    page.drawText(progress > 0 ? "Your investments are contributing to this financial goal." : "Your Conscious Wealth Partner can help map investments when you are ready.", { x: PDF_MARGIN + 38, y: 94, size: 6.8, font: fonts.regular, color: MUTED });
  });
}

function addSignatureHoldings(doc, fonts, report, template, theme) {
  const funds = Array.isArray(report.funds) ? report.funds : [];
  const chunkSize = 6;
  const pageCount = Math.max(1, Math.ceil(funds.length / chunkSize));
  const chunks = [];
  if (funds.length) {
    const balancedSize = Math.ceil(funds.length / pageCount);
    for (let index = 0; index < funds.length; index += balancedSize) chunks.push(funds.slice(index, index + balancedSize));
  } else chunks.push([]);
  const summary = report.summary || {};
  const invested = Number(summary.totalInvested || 0);
  const gain = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - invested));
  const columns = [
    { label: "Investment", width: 194 },
    { label: "Invested", width: 76, align: "right" },
    { label: "Current Value", width: 82, align: "right" },
    { label: "Gain / Loss", width: 88, align: "right" },
    { label: "Active SIP", width: 67, align: "right" }
  ];

  chunks.forEach((pageFunds, pageIndex) => {
    const page = addPage(doc, fonts, report, template, theme, pageIndex ? "Investment Portfolio - Continued" : "Investment Portfolio");
    drawSignatureIntro(page, fonts, "A detailed view of your current investments and their Goal / Corpus allocation.");
    if (!pageFunds.length) {
      drawPanel(page, { x: PDF_MARGIN, y: 410, width: CONTENT_WIDTH, height: 180, fill: rgb(0.975, 0.985, 0.995), border: BORDER });
      drawTextBlock(page, "No investment holdings were included in this report snapshot.", { x: PDF_MARGIN + 24, y: 510, width: CONTENT_WIDTH - 48, font: fonts.regular, size: 9.4, color: MUTED, align: "center", maxLines: 3 });
      return;
    }
    let y = drawSignatureTableHeader(page, fonts, theme, columns, 680);
    pageFunds.forEach((fund, index) => {
      const cost = Number(fund.totalInvested || 0);
      const value = Number(fund.currentValue || 0);
      const fundGain = Number(fund.profitLoss ?? (value - cost));
      const fundReturn = cost ? fundGain / cost * 100 : Number(fund.returnPercentage || 0);
      const allocated = fund.bucketLabel || fund.goalName || "General Wealth / Corpus Creation";
      y = drawSignatureTableRow(page, fonts, columns, [
        { text: fund.instrumentName || "Investment", bold: true, maxLines: 2, detail: `Allocated to: ${allocated}`, detailMaxLines: 2, detailSize: 6.2 },
        { moneyValue: cost, align: "right" },
        { moneyValue: value, align: "right", bold: true },
        { text: `${fundReturn >= 0 ? "+" : ""}${fundReturn.toFixed(2)}%`, align: "right", bold: true, color: signaturePositiveColor(theme, fundGain), detail: `${fundGain >= 0 ? "+" : "-"}${compactMoneyNumber(Math.abs(fundGain))}`, detailColor: signaturePositiveColor(theme, fundGain), detailSize: 6.0 },
        Number(fund.monthlySip || 0) ? { moneyValue: Number(fund.monthlySip || 0), align: "right" } : { text: "-", align: "right" }
      ], y, index, { baseSize: 7.0, maxLines: 2 });
    });
    if (pageIndex === chunks.length - 1 && y > 145) {
      drawSignatureTableRow(page, fonts, columns, [
        { text: "Total", bold: true },
        { moneyValue: invested, align: "right", bold: true },
        { moneyValue: Number(summary.totalCorpus || 0), align: "right", bold: true },
        { moneyValue: gain, align: "right", bold: true, color: signaturePositiveColor(theme, gain), showPlus: true },
        { moneyValue: Number(summary.monthlySip || 0), align: "right", bold: true }
      ], y, pageFunds.length, { baseSize: 7.1, total: true });
    }
    drawPanel(page, { x: PDF_MARGIN, y: 80, width: CONTENT_WIDTH, height: 58, fill: rgb(0.955, 0.98, 1), border: rgb(0.84, 0.92, 0.97) });
    drawTextBlock(page, "Consistency today creates more choice tomorrow. - GrowVest", { x: PDF_MARGIN + 18, y: 115, width: CONTENT_WIDTH - 36, font: fonts.bold, size: 8.6, color: theme.primary, align: "center", lineHeight: 10, maxLines: 2 });
  });
}

function drawSignatureTrend(page, fonts, theme, data = [], { x = PDF_MARGIN, y = 150, width = CONTENT_WIDTH, height = 165 } = {}) {
  drawPanel(page, { x, y, width, height, fill: WHITE, border: rgb(0.86, 0.9, 0.94) });
  page.drawText("Portfolio Value Trend", { x: x + 16, y: y + height - 25, size: 9, font: fonts.bold, color: theme.dark });
  if (data.length < 2) {
    drawTextBlock(page, "Portfolio trend will appear after two comparable Monthly Wealth Reviews.", { x: x + 20, y: y + 88, width: width - 40, font: fonts.regular, size: 8, color: MUTED, align: "center", lineHeight: 11, maxLines: 3 });
    return;
  }
  const plot = { x: x + 36, y: y + 35, width: width - 62, height: height - 78 };
  const values = data.map((item) => Number(item.value || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = data.map((item, index) => ({
    x: plot.x + (data.length === 1 ? 0 : index / (data.length - 1)) * plot.width,
    y: plot.y + ((Number(item.value || 0) - min) / range) * plot.height,
    label: item.label
  }));
  page.drawLine({ start: { x: plot.x, y: plot.y }, end: { x: plot.x + plot.width, y: plot.y }, thickness: 0.45, color: rgb(0.87, 0.9, 0.94) });
  points.forEach((point, index) => {
    if (index) page.drawLine({ start: points[index - 1], end: point, thickness: 2.2, color: theme.primary });
    page.drawCircle({ x: point.x, y: point.y, size: 3.2, color: theme.secondary, borderColor: WHITE, borderWidth: 0.8 });
    const labelWidth = fonts.regular.widthOfTextAtSize(pdfSafeText(point.label || ""), 5.5);
    page.drawText(pdfSafeText(point.label || ""), { x: point.x - labelWidth / 2, y: y + 17, size: 5.5, font: fonts.regular, color: MUTED });
  });
}

function addSignaturePerformance(doc, fonts, report, template, theme, history) {
  const page = addPage(doc, fonts, report, template, theme, "Performance");
  const isOpening = isOpeningReview(report);
  drawSignatureIntro(page, fonts, isOpening ? "Your overall portfolio position at the start of GrowVest reporting." : "Your portfolio movement and performance for the reporting period.");
  const summary = report.summary || {};
  const invested = Number(summary.totalInvested || 0);
  const gain = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - invested));
  const overallReturn = signatureOverallReturn(summary);
  const previous = isOpening ? null : previousReportFor(report, history);

  drawPanel(page, { x: PDF_MARGIN, y: 374, width: CONTENT_WIDTH, height: 286, fill: rgb(0.96, 0.985, 1), border: rgb(0.84, 0.9, 0.95) });
  drawSignatureIconBadge(page, isOpening ? "performance" : "gain", { cx: PDF_MARGIN + 34, cy: 621, color: theme.primary, fill: WHITE, radius: 15, iconSize: 11 });
  page.drawText(isOpening ? "Your Starting Position" : "Monthly Movement", { x: PDF_MARGIN + 58, y: 624, size: 13.5, font: fonts.bold, color: theme.primary });
  if (isOpening) page.drawText(`Baseline as of ${dateText(report.statementDate)}`, { x: PDF_MARGIN + 58, y: 607, size: 6.8, font: fonts.regular, color: MUTED });

  const rows = isOpening ? [
    { label: "Portfolio Value", money: Number(summary.totalCorpus || 0), color: theme.dark },
    { label: "Total Invested", money: invested, color: theme.dark },
    { label: "Overall Gain", money: gain, color: signaturePositiveColor(theme, gain), showPlus: true },
    { label: "Overall Return", text: `${overallReturn >= 0 ? "+" : ""}${overallReturn.toFixed(2)}%`, color: signaturePositiveColor(theme, overallReturn) }
  ] : [
    { label: "Opening Portfolio", money: Number(summary.openingValue || previous?.summary?.totalCorpus || 0), color: theme.dark },
    { label: "Money Added", money: Number(summary.newMoneyAdded || 0), color: theme.dark },
    { label: "Money Withdrawn", money: Number(summary.totalWithdrawals || 0), color: theme.dark },
    { label: "Investment Gain / Loss", money: Number(summary.investmentGain || 0), color: signaturePositiveColor(theme, summary.investmentGain), showPlus: true }
  ];
  rows.forEach((row, index) => {
    const rowY = 566 - index * 48;
    if (index) page.drawLine({ start: { x: PDF_MARGIN + 22, y: rowY + 23 }, end: { x: 529, y: rowY + 23 }, thickness: 0.5, color: rgb(0.86, 0.9, 0.94) });
    page.drawText(row.label, { x: PDF_MARGIN + 22, y: rowY, size: 9.1, font: fonts.bold, color: rgb(0.15, 0.22, 0.31) });
    if (row.money !== undefined) drawSignatureMoney(page, fonts.bold, row.money, { right: 529, y: rowY, size: 11.2, color: row.color, maxWidth: 165, minimumSize: 7.5, showPlus: row.showPlus });
    else drawRightText(page, row.text, { right: 529, y: rowY, font: fonts.bold, size: 11.2, color: row.color, maxWidth: 165 });
  });

  if (!isOpening) drawSignatureTrend(page, fonts, theme, buildTrendData(report, history), { y: 160, height: 195 });
  const note = isOpening
    ? "Monthly performance comparison will begin from your next Wealth Review."
    : "Monthly performance excludes confirmed external money added and withdrawn so portfolio movement is not overstated.";
  drawSignatureCallout(page, fonts, theme, {
    y: isOpening ? 216 : 94,
    height: 64,
    icon: "performance",
    tone: "cyan",
    body: note,
    fill: rgb(0.94, 0.98, 1),
    border: rgb(0.83, 0.92, 0.97),
    bodySize: 8.6,
    textInset: 58,
    iconRadius: 10.5,
    iconSize: 8
  });
}

function addSignatureProtection(doc, fonts, report, template, theme) {
  const policies = Array.isArray(report.protectionSnapshot?.policies) ? report.protectionSnapshot.policies : [];
  if (!policies.length) return false;
  const page = addPage(doc, fonts, report, template, theme, "Protection Overview");
  drawSignatureIntro(page, fonts, "Helping you stay financially secure for life's uncertainties.");
  const columns = [
    { label: "Type", width: 142 },
    { label: "Status", width: 100 },
    { label: "Renewal / Next Due", width: 126 },
    { label: "Notes", width: 139 }
  ];
  let y = drawSignatureTableHeader(page, fonts, theme, columns, 680);
  policies.slice(0, 9).forEach((policy, index) => {
    const status = policy.policyStatus || "Active";
    const active = String(status).toLowerCase().includes("active");
    y = drawSignatureTableRow(page, fonts, columns, [
      { text: policy.insuranceType || "Insurance", bold: true, maxLines: 2, detail: Number(policy.coverAmount || 0) ? `Cover ${compactMoneyNumber(policy.coverAmount)}` : "", detailSize: 6.1 },
      { text: status, color: active ? theme.secondary : theme.warning },
      { text: policy.nextDueDate ? dateText(policy.nextDueDate) : "-" },
      { text: policy.nextDueType || policy.notes || "-", maxLines: 3 }
    ], y, index, { baseSize: 7.0, maxLines: 3 });
  });
  drawSignatureCallout(page, fonts, theme, {
    y: 85,
    height: 72,
    icon: "shield",
    title: "Protection and wealth are reviewed separately.",
    body: "Insurance cover is not included in your investment portfolio value.",
    fill: rgb(0.955, 0.98, 1),
    border: rgb(0.83, 0.91, 0.97),
    titleSize: 7.8,
    bodySize: 6.8,
    textInset: 58,
    iconRadius: 10,
    iconSize: 8
  });
  return true;
}

function addSignatureView(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "GrowVest View");
  drawSignatureIntro(page, fonts, "Our perspective on your financial journey.");
  const insights = deriveAdvisorInsights(report);
  const sections = [
    ["What We Observe", signatureCopy(insights.narrative || "Your portfolio position and goal progress have been reviewed using the current report snapshot.")],
    ["What Matters Now", signatureCopy(insights.priorityAttention?.description || "Continue reviewing your portfolio, goal allocation and protection needs as your life evolves.")],
    ["What We Recommend Next", signatureCopy(insights.portfolioOpportunity?.description || "Review the next agreed portfolio action with your Conscious Wealth Partner.")]
  ];
  sections.forEach(([title, body], index) => {
    const y = 620 - index * 145;
    const iconKind = index === 0 ? "binoculars" : index === 1 ? "compass" : "gear";
    const iconColor = index === 1 ? theme.secondary : theme.primary;
    drawSignatureIconBadge(page, iconKind, { cx: PDF_MARGIN + 28, cy: y + 24, color: iconColor, fill: rgb(0.92, 0.98, 1), radius: 22, iconSize: 15 });
    page.drawText(title, { x: PDF_MARGIN + 67, y: y + 38, size: 10.2, font: fonts.bold, color: theme.primary });
    drawTextBlock(page, body, { x: PDF_MARGIN + 67, y: y + 17, width: CONTENT_WIDTH - 74, font: fonts.regular, size: 8.3, color: MUTED, lineHeight: 12.5, maxLines: 6 });
    page.drawLine({ start: { x: PDF_MARGIN + 67, y: y - 62 }, end: { x: 551, y: y - 62 }, thickness: 0.45, color: rgb(0.88, 0.91, 0.94) });
  });

  const advisorNote = signatureCopy(report.advisorNote?.content || "").trim();
  const narrative = signatureCopy(insights.narrative || "").trim();
  const hasUniqueNote = advisorNote && advisorNote !== narrative;
  if (hasUniqueNote) {
    drawPanel(page, { x: PDF_MARGIN, y: 84, width: CONTENT_WIDTH, height: 112, fill: rgb(0.97, 0.985, 1), border: rgb(0.84, 0.91, 0.96) });
    page.drawRectangle({ x: PDF_MARGIN, y: 84, width: 3, height: 112, color: theme.secondary });
    drawTextBlock(page, advisorNote, { x: PDF_MARGIN + 18, y: 169, width: CONTENT_WIDTH - 36, font: fonts.regular, size: 7.8, color: rgb(0.25, 0.34, 0.44), lineHeight: 11, maxLines: 5 });
    page.drawText(pdfSafeText(report.advisorName || `${theme.branding.companyName || "GrowVest"} Team`), { x: PDF_MARGIN + 18, y: 111, size: 7.9, font: fonts.bold, color: theme.primary });
    page.drawText("Conscious Wealth Partner", { x: PDF_MARGIN + 18, y: 96, size: 6.2, font: fonts.regular, color: MUTED });
  } else {
    drawPanel(page, { x: PDF_MARGIN, y: 98, width: CONTENT_WIDTH, height: 76, fill: rgb(0.97, 0.985, 1), border: rgb(0.84, 0.91, 0.96) });
    page.drawRectangle({ x: PDF_MARGIN, y: 98, width: 3, height: 76, color: theme.secondary });
    page.drawText("CONNECT GROWVEST", { x: PDF_MARGIN + 18, y: 151, size: 5.8, font: fonts.bold, color: MUTED });
    page.drawText(pdfSafeText(report.advisorName || `${theme.branding.companyName || "GrowVest"} Team`), { x: PDF_MARGIN + 18, y: 130, size: 9.2, font: fonts.bold, color: theme.primary });
    page.drawText("Conscious Wealth Partner", { x: PDF_MARGIN + 18, y: 113, size: 6.5, font: fonts.regular, color: MUTED });
  }
}

function addSignatureActions(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Your Next Steps");
  drawSignatureIntro(page, fonts, "Simple actions for continued progress.");
  const actions = [...(report.profileActions || []), ...(report.nextSteps || [])]
    .filter((item) => item?.title || item?.description)
    .slice(0, 3);
  const rows = actions.length ? actions : [{ title: "Continue your current plan", description: "No new action has been recorded for this review." }];
  const single = rows.length <= 1;
  rows.forEach((item, index) => {
    const y = single ? 620 : 650 - index * 86;
    const radius = single ? 18 : 14;
    page.drawCircle({ x: PDF_MARGIN + 22, y, size: radius, color: index % 2 ? theme.secondary : theme.primary });
    const number = String(index + 1);
    const numSize = single ? 9.5 : 8;
    const numberWidth = fonts.bold.widthOfTextAtSize(number, numSize);
    page.drawText(number, { x: PDF_MARGIN + 22 - numberWidth / 2, y: y - numSize * 0.37, size: numSize, font: fonts.bold, color: WHITE });
    drawTextBlock(page, item.title || item.description || "Next step", { x: PDF_MARGIN + 58, y: y + 11, width: 410, font: fonts.bold, size: single ? 10.4 : 9.0, color: theme.dark, lineHeight: 12, maxLines: 2 });
    if (item.title && item.description && item.description !== item.title) drawTextBlock(page, item.description, { x: PDF_MARGIN + 58, y: y - 13, width: 410, font: fonts.regular, size: single ? 8.1 : 7.4, color: MUTED, lineHeight: 10, maxLines: 3 });
    if (item.dueDate) drawRightText(page, `Due ${dateText(item.dueDate)}`, { right: 551, y: y - 35, font: fonts.regular, size: 6.1, color: MUTED, maxWidth: 100 });
  });

  let secondaryY = 300;
  if (report.nextReview?.date) {
    drawPanel(page, { x: PDF_MARGIN, y: secondaryY, width: CONTENT_WIDTH, height: 66, fill: rgb(0.965, 0.98, 0.995), border: BORDER });
    drawSignatureIconBadge(page, "calendar", { cx: PDF_MARGIN + 22, cy: secondaryY + 33, color: theme.secondary, fill: WHITE, radius: 10, iconSize: 8 });
    page.drawText("UPCOMING", { x: PDF_MARGIN + 42, y: secondaryY + 39, size: 5.8, font: fonts.bold, color: MUTED });
    page.drawText(`Your next Wealth Review: ${dateText(report.nextReview.date)}`, { x: PDF_MARGIN + 42, y: secondaryY + 21, size: 7.8, font: fonts.bold, color: theme.dark });
    secondaryY -= 82;
  }

  const policies = Array.isArray(report.protectionSnapshot?.policies) ? report.protectionSnapshot.policies : [];
  if (!policies.length) {
    drawSignatureCallout(page, fonts, theme, {
      y: secondaryY,
      height: 68,
      icon: "shield",
      title: "Protection details not yet added",
      body: "Protection is reviewed separately and is not included in your investment portfolio value.",
      fill: rgb(0.97, 0.985, 1),
      border: rgb(0.84, 0.91, 0.96),
      titleSize: 7.8,
      bodySize: 6.5,
      textInset: 58,
      iconRadius: 10,
      iconSize: 8
    });
  }

  drawSignatureClosingBanner(page, fonts, report, theme, { y: 96, height: 64 });

  const inlineDisclaimer = pdfSafeText(report.disclaimer || "This report is for your personal use only. Past performance is not a guarantee of future results.");
  drawTextBlock(page, inlineDisclaimer, { x: PDF_MARGIN, y: 77, width: CONTENT_WIDTH, font: fonts.regular, size: 6.2, color: MUTED, lineHeight: 7.8, maxLines: 4 });
}

function addSignatureDisclaimer(doc, fonts, report, template, theme) {
  const disclaimer = pdfSafeText(report.disclaimer || "");
  if (disclaimer.length <= 520) return;
  const page = addPage(doc, fonts, report, template, theme, "Report Information & Disclaimer");
  drawSignatureIntro(page, fonts, "Important information about this GrowVest Wealth Review.");
  drawPanel(page, { x: PDF_MARGIN, y: 555, width: CONTENT_WIDTH, height: 120, fill: rgb(0.975, 0.985, 0.995), border: BORDER });
  const metadata = [
    ["Report reference", report.reportCode || "-"],
    ["Statement date", dateText(report.statementDate)],
    ["Version", String(report.publishedVersion || report.version || 1)],
    ["Template", template.name || "GrowVest Signature"]
  ];
  metadata.forEach(([label, value], index) => {
    const x = PDF_MARGIN + 18 + (index % 2) * 245;
    const y = 642 - Math.floor(index / 2) * 48;
    page.drawText(label.toUpperCase(), { x, y, size: 5.7, font: fonts.bold, color: MUTED });
    drawTextBlock(page, value, { x, y: y - 17, width: 210, font: fonts.bold, size: 7.2, color: theme.dark, maxLines: 2, lineHeight: 9 });
  });
  drawTextBlock(page, disclaimer, { x: PDF_MARGIN, y: 520, width: CONTENT_WIDTH, font: fonts.regular, size: 7.8, color: MUTED, lineHeight: 12, maxLines: 34 });
}

function addGrowVestSignaturePages(doc, fonts, report, template, theme, history = []) {
  const visible = (key) => template.sectionVisibility?.[key] !== false;
  if (visible("cover")) addSignatureCover(doc, fonts, report, template, theme);
  if (visible("executiveSummary")) addSignatureSummary(doc, fonts, report, template, theme);
  if (visible("allocation")) addSignatureAllocation(doc, fonts, report, template, theme);
  if (visible("goals")) addSignatureGoals(doc, fonts, report, template, theme);
  if (visible("holdings")) addSignatureHoldings(doc, fonts, report, template, theme);
  if (visible("performance")) addSignaturePerformance(doc, fonts, report, template, theme, history);
  if (visible("commentary")) {
    if (Array.isArray(report.protectionSnapshot?.policies) && report.protectionSnapshot.policies.length) addSignatureProtection(doc, fonts, report, template, theme);
    addSignatureView(doc, fonts, report, template, theme);
  }
  if (visible("actions")) addSignatureActions(doc, fonts, report, template, theme);
  if (visible("disclaimer")) addSignatureDisclaimer(doc, fonts, report, template, theme);
}

export async function generateMonthlyReportPdf(report, { history = [] } = {}) {
  const doc = await PDFDocument.create();
  const branding = resolveReportBranding(report, report.branding || {});
  const normalizedReport = { ...report, branding };
  const requestedTemplate = resolveReportTemplate(normalizedReport);
  const signatureTemplate = shouldUseGrowVestSignatureDesign(normalizedReport, requestedTemplate);
  const template = signatureTemplate ? getLockedGrowVestSignatureTemplate() : requestedTemplate;
  const theme = createTheme(normalizedReport, template);
  const logoUrl = branding.pdfLogoUrl || branding.primaryLogoUrl || branding.emailLogoUrl || branding.iconLogoUrl || "";
  const [logo, icon, iconWhite, watermark, coverBackground, coverWash] = await Promise.all([
    // The locked launch design deliberately uses packaged artwork. Remote branding
    // remains supported only for historical/classic report snapshots.
    embedBrandImage(doc, signatureTemplate ? "" : logoUrl, signatureTemplate ? "/brand/growvest-logo-dark.png" : ""),
    embedBrandImage(doc, signatureTemplate ? "" : (branding.footerLogoUrl || branding.iconLogoUrl || ""), signatureTemplate ? "/brand/growvest-icon-blue-v03424.png" : ""),
    embedBrandImage(doc, "", signatureTemplate ? "/brand/growvest-icon-white-v03424.png" : ""),
    embedBrandImage(doc, branding.watermarkUrl || ""),
    embedBrandImage(doc, signatureTemplate ? "" : (branding.coverBackgroundUrl || ""), signatureTemplate ? "/brand/growvest-wealth-review-cover-v03424.jpg" : ""),
    embedBrandImage(doc, "", signatureTemplate ? "/brand/growvest-cover-wash.png" : "")
  ]);
  normalizedReport.__brandingAssets = { logo, icon, iconWhite, watermark, coverBackground, coverWash };

  const reportTypeLabel = reportDocumentTitle(normalizedReport);
  doc.setTitle(normalizedReport.title || `${branding.companyName || "GrowVest"} ${reportTypeLabel}`);
  doc.setAuthor(branding.legalName || "GrowVest Advisors Private Limited");
  doc.setSubject(`${reportTypeLabel} for ${normalizedReport.investorName || "Investor"}`);
  doc.setCreator(`${branding.companyName || "GrowVest"} Report Tool`);
  doc.setProducer("GrowVest Investor Wealth Report Generator 2.4.10");
  doc.setKeywords(["GrowVest", isOpeningReview(normalizedReport) ? "opening wealth review" : "monthly wealth review", normalizedReport.reportCode || "report", "pdf-renderer-2.4.10"]);
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { regular, bold, italic };

  if (signatureTemplate) {
    addGrowVestSignaturePages(doc, fonts, normalizedReport, template, theme, history);
    return doc.save();
  }

  const visible = (key) => template.sectionVisibility?.[key] !== false;
  const rendered = new Set();
  const renderers = {
    cover: () => addCover(doc, fonts, normalizedReport, template, theme),
    executiveSummary: () => addExecutiveSummary(doc, fonts, normalizedReport, template, theme),
    performance: () => addPerformancePage(doc, fonts, normalizedReport, template, theme, history),
    performanceTrend: () => {
      if (!visible("performance")) addPerformancePage(doc, fonts, normalizedReport, template, theme, history);
    },
    goals: () => addGoalsPages(doc, fonts, normalizedReport, template, theme),
    allocation: () => {
      addAllocationSummary(doc, fonts, normalizedReport, template, theme);
      addAllocationTablePages(doc, fonts, normalizedReport, template, theme);
    },
    holdings: () => {
      addHoldingsPages(doc, fonts, normalizedReport, template, theme);
      addTradingSummaryPage(doc, fonts, normalizedReport, template, theme);
    },
    transactions: () => addTransactionsPages(doc, fonts, normalizedReport, template, theme),
    commentary: () => {
      addProtectionPage(doc, fonts, normalizedReport, template, theme);
      addCommentaryPage(doc, fonts, normalizedReport, template, theme);
    },
    actions: () => {
      addFinancialPlanPage(doc, fonts, normalizedReport, template, theme);
      addActionsPages(doc, fonts, normalizedReport, template, theme);
    },
    disclaimer: () => addDisclaimerPages(doc, fonts, normalizedReport, template, theme)
  };

  template.sectionOrder.forEach((key) => {
    if (!visible(key) || rendered.has(key) || !renderers[key]) return;
    if (key === "performanceTrend" && visible("performance")) return;
    renderers[key]();
    rendered.add(key);
  });

  return doc.save();
}
