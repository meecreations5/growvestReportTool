import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchSafeRemoteImage } from "@/lib/server/safeRemoteAsset";
import {
  drawPdfDocumentChrome,
  drawPdfImageFit,
  pdfHexColor,
  pdfSafeText,
  PDF_A4_HEIGHT,
  PDF_A4_WIDTH,
  PDF_MARGIN
} from "@/lib/server/pdfDocumentShell";
import { resolveReportTemplate } from "@/lib/constants/reportTemplates";
import {
  allocationStatus,
  buildTrendData,
  deriveAdvisorInsights,
  derivePortfolioHealth,
  deriveReportHighlights,
  deriveReportTransactions,
  goalDisplayStatus,
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
  const paragraphs = pdfSafeText(text).split(/\r?\n/);
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
  page.drawRectangle({ x: PDF_MARGIN, y: y + 3, width: 18, height: 3.5, color: theme.primary });
  page.drawText(pdfSafeText(title).toUpperCase(), { x: PDF_MARGIN + 26, y, size: 16, font: fonts.bold, color: INK });
}

function drawPanel(page, { x, y, width, height, fill = WHITE, border = BORDER, borderWidth = 0.8, radius = 0 }) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: border, borderWidth });
  return radius;
}

function drawMetricCard(page, fonts, theme, { x, y, width, label, value, note, accent }) {
  drawPanel(page, { x, y, width, height: 86, fill: LIGHT, border: BORDER });
  page.drawText(pdfSafeText(label).toUpperCase(), { x: x + 14, y: y + 63, size: 7.2, font: fonts.bold, color: MUTED });
  const valueSize = fitSize(fonts.bold, value, 18, width - 28, 11);
  page.drawText(pdfSafeText(value), { x: x + 14, y: y + 35, size: valueSize, font: fonts.bold, color: INK });
  if (note) page.drawText(pdfSafeText(note), { x: x + 14, y: y + 15, size: 7.3, font: fonts.regular, color: accent || theme.primary });
}

function createTheme(report, template) {
  const branding = resolveReportBranding(report, report.branding || {});
  const values = resolveReportTheme(report, branding, template);
  return {
    branding,
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
    documentTitle: "Monthly Wealth Progress Report",
    primaryColor: template.appearance?.primaryColor || theme.branding.primaryColor,
    secondaryColor: template.appearance?.secondaryColor || theme.branding.secondaryColor,
    showLogo: settings.showLogo !== false,
    showClientCode: settings.showClientCode !== false,
    showReportMonth: settings.showReportMonth !== false,
    showConfidentialLabel: settings.showConfidentialLabel !== false,
    showPageNumbers: settings.showPageNumbers !== false,
    showContactInformation: settings.showContactInformation !== false
  });
  if (title) drawSectionTitle(page, fonts, title, CONTENT_TOP, theme);
  return page;
}


function drawEmptyState(page, fonts, message, y = 620) {
  drawPanel(page, { x: PDF_MARGIN, y: y - 70, width: CONTENT_WIDTH, height: 88, fill: LIGHT, border: BORDER });
  drawTextBlock(page, message, { x: PDF_MARGIN + 24, y: y - 28, width: CONTENT_WIDTH - 48, font: fonts.regular, size: 10, color: MUTED, align: "center", maxLines: 3 });
}

function addCover(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme);
  const settings = template.appearance?.document || {};
  const background = report.__brandingAssets?.coverBackground;
  if (background) {
    drawPdfImageFit(page, background, { x: PDF_MARGIN, y: 92, maxWidth: CONTENT_WIDTH, maxHeight: 655, align: "center", valign: "center", opacity: 0.11 });
  }

  if (settings.showConfidentialLabel !== false && theme.branding.showConfidentialLabel !== false) {
    const label = pdfSafeText(theme.branding.confidentialLabel || "Confidential client report").toUpperCase();
    const width = Math.min(190, fonts.bold.widthOfTextAtSize(label, 6.5) + 24);
    page.drawRectangle({ x: 551 - width, y: 712, width, height: 24, color: LIGHT, borderColor: BORDER, borderWidth: 0.7 });
    drawRightText(page, label, { right: 539, y: 721, font: fonts.bold, size: 6.5, color: MUTED, maxWidth: width - 24 });
  }

  page.drawText("MONTHLY WEALTH PROGRESS REPORT", { x: PDF_MARGIN, y: 680, size: 9.5, font: fonts.bold, color: theme.primary });
  const month = monthLabel(report.reportMonth) || "Monthly";
  const monthSize = fitSize(fonts.bold, month, 50, CONTENT_WIDTH, 34);
  page.drawText(month, { x: PDF_MARGIN, y: 612, size: monthSize, font: fonts.bold, color: INK });
  page.drawText(String(report.reportYear || ""), { x: PDF_MARGIN, y: 558, size: 48, font: fonts.bold, color: INK });
  page.drawText(pdfSafeText(theme.branding.tagline || theme.branding.brandPositioning || "Your Conscious Wealth Partner"), { x: PDF_MARGIN, y: 520, size: 14, font: fonts.italic, color: MUTED });
  page.drawText(`Statement date | ${dateText(report.statementDate)}`, { x: PDF_MARGIN, y: 497, size: 8.5, font: fonts.regular, color: MUTED });

  const showAdvisor = template.appearance?.advisorCardVisible !== false;
  const peopleGap = 16;
  const peopleWidth = showAdvisor ? (CONTENT_WIDTH - peopleGap) / 2 : CONTENT_WIDTH;
  const peopleY = 325;
  const peopleHeight = 130;
  const cardData = [
    {
      x: PDF_MARGIN,
      label: "PREPARED FOR",
      name: report.investorName || "Investor",
      detail: settings.showClientCode === false ? "" : `Client ID | ${report.clientCode || "-"}`,
      accent: theme.dark
    }
  ];
  if (showAdvisor) {
    cardData.push({
      x: PDF_MARGIN + peopleWidth + peopleGap,
      label: "YOUR ADVISOR",
      name: report.advisorName || `${theme.branding.companyName || "GrowVest"} Advisor`,
      detail: investorFacingAdvisorDesignation(report.advisorDesignation),
      accent: theme.primary
    });
  }
  cardData.forEach((card) => {
    drawPanel(page, { x: card.x, y: peopleY, width: peopleWidth, height: peopleHeight, fill: LIGHT, border: BORDER });
    page.drawText(card.label, { x: card.x + 18, y: peopleY + 100, size: 7.5, font: fonts.bold, color: MUTED });
    const nameSize = fitSize(fonts.bold, card.name, 17, peopleWidth - 36, 11);
    page.drawText(pdfSafeText(card.name), { x: card.x + 18, y: peopleY + 63, size: nameSize, font: fonts.bold, color: INK });
    if (card.detail) drawTextBlock(page, card.detail, { x: card.x + 18, y: peopleY + 38, width: peopleWidth - 36, font: fonts.regular, size: 8.2, color: MUTED, maxLines: 2 });
    page.drawRectangle({ x: card.x + 18, y: peopleY + 18, width: 54, height: 3, color: card.accent });
  });

  const summary = report.summary || {};
  const cardGap = 12;
  const cardWidth = (CONTENT_WIDTH - (cardGap * 2)) / 3;
  const summaryCards = [
    ["Total Portfolio", compactMoney(summary.totalCorpus)],
    ["Monthly SIP", compactMoney(summary.monthlySip)],
    ["Overall Progress", `${Number(summary.overallProgress || 0).toFixed(1)}%`]
  ];
  summaryCards.forEach(([label, value], index) => {
    const x = PDF_MARGIN + index * (cardWidth + cardGap);
    page.drawRectangle({ x, y: 205, width: cardWidth, height: 88, color: theme.dark });
    page.drawText(label.toUpperCase(), { x: x + 14, y: 265, size: 7, font: fonts.bold, color: rgb(0.68, 0.71, 0.77) });
    const size = fitSize(fonts.bold, value, 16, cardWidth - 28, 10);
    page.drawText(pdfSafeText(value), { x: x + 14, y: 231, size, font: fonts.bold, color: WHITE });
  });
}

function addExecutiveSummary(doc, fonts, report, template, theme) {
  const page = addPage(doc, fonts, report, template, theme, "Executive summary");
  const summary = report.summary || {};
  page.drawRectangle({ x: PDF_MARGIN, y: 600, width: CONTENT_WIDTH, height: 120, color: theme.dark });
  page.drawText("TOTAL PORTFOLIO VALUE", { x: PDF_MARGIN + 20, y: 690, size: 7.5, font: fonts.bold, color: rgb(0.66, 0.7, 0.77) });
  page.drawText(compactMoney(summary.totalCorpus), { x: PDF_MARGIN + 20, y: 651, size: 27, font: fonts.bold, color: WHITE });
  page.drawText(`of ${compactMoney(summary.lifetimeTarget)} lifetime target`, { x: PDF_MARGIN + 20, y: 629, size: 8, font: fonts.regular, color: rgb(0.75, 0.78, 0.84) });
  drawRightText(page, "OVERALL PROGRESS", { right: 531, y: 690, font: fonts.bold, size: 7.5, color: rgb(0.66, 0.7, 0.77), maxWidth: 170 });
  drawRightText(page, `${Number(summary.overallProgress || 0).toFixed(1)}%`, { right: 531, y: 650, font: fonts.bold, size: 26, color: theme.secondary, maxWidth: 170 });
  page.drawRectangle({ x: PDF_MARGIN + 20, y: 614, width: CONTENT_WIDTH - 40, height: 6, color: rgb(0.17, 0.19, 0.24) });
  page.drawRectangle({ x: PDF_MARGIN + 20, y: 614, width: (CONTENT_WIDTH - 40) * Math.min(100, Math.max(0, Number(summary.overallProgress || 0))) / 100, height: 6, color: theme.primary });

  const cardGap = 16;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  drawMetricCard(page, fonts, theme, { x: PDF_MARGIN, y: 490, width: cardWidth, label: "Total Monthly SIP", value: compactMoney(summary.monthlySip), note: "Running this month" });
  drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + cardWidth + cardGap, y: 490, width: cardWidth, label: "New Money Added", value: compactMoney(summary.newMoneyAdded), note: "Contributions received", accent: theme.secondary });
  drawMetricCard(page, fonts, theme, { x: PDF_MARGIN + (cardWidth + cardGap) * 2, y: 490, width: cardWidth, label: "Investment Gain", value: compactMoney(summary.investmentGain), note: "Portfolio movement", accent: Number(summary.investmentGain || 0) >= 0 ? theme.success : theme.danger });

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

function drawTrendChart(page, fonts, theme, trend, { x, y, width, height }) {
  drawPanel(page, { x, y, width, height, fill: WHITE, border: BORDER });
  page.drawText("PORTFOLIO VALUE TREND", { x: x + 16, y: y + height - 26, size: 8, font: fonts.bold, color: MUTED });
  const chartX = x + 42;
  const chartY = y + 40;
  const chartWidth = width - 68;
  const chartHeight = height - 82;
  page.drawLine({ start: { x: chartX, y: chartY }, end: { x: chartX, y: chartY + chartHeight }, thickness: 0.5, color: BORDER });
  page.drawLine({ start: { x: chartX, y: chartY }, end: { x: chartX + chartWidth, y: chartY }, thickness: 0.5, color: BORDER });
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
    page.drawLine({
      start: { x: points[index - 1].x, y: points[index - 1].y },
      end: { x: points[index].x, y: points[index].y },
      thickness: 2,
      color: theme.primary
    });
  }
  points.forEach((point, index) => {
    page.drawCircle({ x: point.x, y: point.y, size: 3.3, color: theme.secondary, borderColor: WHITE, borderWidth: 0.8 });
    const label = pdfSafeText(point.item.label || point.item.monthKey || "");
    const labelWidth = fonts.regular.widthOfTextAtSize(label, 6.5);
    page.drawText(label, { x: Math.max(chartX, Math.min(chartX + chartWidth - labelWidth, point.x - labelWidth / 2)), y: chartY - 18, size: 6.5, font: fonts.regular, color: MUTED });
    if (index === 0 || index === points.length - 1 || points.length <= 5) {
      const value = compactMoney(point.item.value);
      const valueSize = fitSize(fonts.bold, value, 7, 70, 5.5);
      const valueWidth = fonts.bold.widthOfTextAtSize(value, valueSize);
      page.drawText(value, { x: Math.max(chartX, Math.min(chartX + chartWidth - valueWidth, point.x - valueWidth / 2)), y: point.y + 10, size: valueSize, font: fonts.bold, color: INK });
    }
  });
}

function addPerformancePage(doc, fonts, report, template, theme, history) {
  const page = addPage(doc, fonts, report, template, theme, "Portfolio performance");
  const trend = buildTrendData(report, history);
  drawTrendChart(page, fonts, theme, trend, { x: PDF_MARGIN, y: 430, width: CONTENT_WIDTH, height: 280 });

  const previous = previousReportFor(report, history);
  const currentValue = Number(report.summary?.totalCorpus || 0);
  const previousValue = Number(previous?.summary?.totalCorpus || 0);
  const change = currentValue - previousValue;
  const changePercentage = previousValue > 0 ? change / previousValue * 100 : 0;
  const highlights = deriveReportHighlights(report).slice(0, 4);
  if (previous) {
    highlights.unshift({
      id: "month-change",
      title: "Month-on-month movement",
      description: `${change >= 0 ? "Increased" : "Decreased"} by ${compactMoney(Math.abs(change))} (${changePercentage >= 0 ? "+" : ""}${changePercentage.toFixed(1)}%).`
    });
  }
  const cards = highlights.slice(0, 4);
  if (!cards.length) {
    drawEmptyState(page, fonts, "Monthly performance highlights were not recorded for this report.", 350);
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
    drawTextBlock(page, "No specific financial goal is currently assigned. The portfolio remains tracked as General Wealth and can be allocated to financial goals or Bucket List items later.", { x: PDF_MARGIN + 18, y: 565, width: CONTENT_WIDTH - 36, font: fonts.regular, size: 9.5, color: MUTED, lineHeight: 14, maxLines: 5 });
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
    let y = 590;
    allocation.slice(0, 8).forEach((item) => {
      const current = Math.min(100, Math.max(0, Number(item.currentPercentage || 0)));
      const target = Math.min(100, Math.max(0, Number(item.targetPercentage || 0)));
      page.drawText(pdfSafeText(item.assetClass || "Other"), { x: PDF_MARGIN, y, size: 8.2, font: fonts.bold, color: INK });
      page.drawRectangle({ x: 155, y: y - 3, width: 275, height: 12, color: rgb(0.93, 0.94, 0.96) });
      page.drawRectangle({ x: 155, y: y - 3, width: 275 * target / 100, height: 12, color: rgb(0.82, 0.86, 0.94), opacity: 0.7 });
      page.drawRectangle({ x: 155, y: y - 3, width: Math.max(1, 275 * current / 100), height: 12, color: theme.primary });
      drawRightText(page, `${current.toFixed(1)}%`, { right: 477, y, font: fonts.regular, size: 7.5, color: INK, maxWidth: 45 });
      drawRightText(page, `${target.toFixed(1)}%`, { right: 523, y, font: fonts.regular, size: 7.5, color: MUTED, maxWidth: 45 });
      const variance = Number(item.variance || 0);
      drawRightText(page, `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%`, { right: 551, y, font: fonts.bold, size: 7.2, color: Math.abs(variance) < 1 ? theme.success : theme.danger, maxWidth: 45 });
      y -= 42;
    });
  }
  drawPanel(page, { x: PDF_MARGIN, y: 95, width: CONTENT_WIDTH, height: 112, fill: rgb(1, 0.98, 0.9), border: theme.warning });
  page.drawText("OBSERVATION", { x: PDF_MARGIN + 16, y: 178, size: 7.5, font: fonts.bold, color: AMBER });
  drawTextBlock(page, health.observation, { x: PDF_MARGIN + 16, y: 154, width: CONTENT_WIDTH - 32, font: fonts.regular, size: 8.7, color: MUTED, lineHeight: 13, maxLines: 5 });
}

function drawTableHeader(page, fonts, theme, columns, y, height = 29) {
  page.drawRectangle({ x: PDF_MARGIN, y: y - height + 8, width: CONTENT_WIDTH, height, color: theme.dark });
  let x = PDF_MARGIN;
  columns.forEach((column) => {
    const label = pdfSafeText(column.label).toUpperCase();
    const size = fitSize(fonts.bold, label, column.size || 6.4, column.width - 10, 5.1);
    const textWidth = fonts.bold.widthOfTextAtSize(label, size);
    const drawX = column.align === "right" ? x + column.width - textWidth - 6 : column.align === "center" ? x + (column.width - textWidth) / 2 : x + 6;
    page.drawText(label, { x: drawX, y: y - 10, size, font: fonts.bold, color: WHITE });
    x += column.width;
  });
  return y - height;
}

function prepareTableRow(fonts, columns, values, baseSize = 7.2, maxLines = 2) {
  const cells = columns.map((column, index) => {
    const font = values[index]?.bold ? fonts.bold : fonts.regular;
    const text = pdfSafeText(values[index]?.text ?? values[index] ?? "");
    const size = fitSize(font, text, values[index]?.size || baseSize, column.width - 12, 5.4);
    const lines = wrapText(text, font, size, column.width - 12).slice(0, values[index]?.maxLines || maxLines);
    return { text, font, size, lines, color: values[index]?.color || INK, align: values[index]?.align || column.align || "left" };
  });
  const lineHeight = 9;
  const rowHeight = Math.max(29, Math.max(...cells.map((cell) => cell.lines.length || 1)) * lineHeight + 14);
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
      { text: item.goalName || "General Wealth", maxLines: 2 },
      { text: Number(item.monthlySip || 0) ? compactMoney(item.monthlySip) : "-", align: "right" },
      { text: compactMoney(item.currentValue), align: "right", bold: true },
      { text: `${weight.toFixed(1)}%`, align: "right" },
      { text: item.type || "-" }
    ];
    const prepared = prepareTableRow(fonts, columns, values, 6.5, 2);
    if (!page || y - prepared.rowHeight < CONTENT_BOTTOM + 18) {
      page = addPage(doc, fonts, report, template, theme, index === 0 ? "Detailed holdings" : "Detailed holdings - continued");
      page.drawText("Every investment in your portfolio, its goal or General Wealth assignment, and its current value.", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.regular, color: MUTED });
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
  const page = addPage(doc, fonts, report, template, theme, "Stock Intraday Trading");
  page.drawText("Monthly intraday performance is reported separately from the long-term investment portfolio and goal corpus.", { x: PDF_MARGIN, y: 713, size: 8, font: fonts.regular, color: MUTED });
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
  drawTextBlock(page, "Intraday realised profit or loss remains part of trading activity. It contributes to long-term wealth or a financial goal only when GrowVest records an actual transfer or investment allocation.", { x: PDF_MARGIN + 16, y: 416, width: CONTENT_WIDTH - 32, font: fonts.regular, size: 9, color: MUTED, lineHeight: 13, maxLines: 5 });
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
  const page = addPage(doc, fonts, report, template, theme, "Advisor commentary");
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
  page.drawText(`ADVISOR INSIGHTS | ${monthLabel(report.reportMonth).toUpperCase()} ${report.reportYear || ""}`, { x: PDF_MARGIN + 20, y: 463, size: 7.5, font: fonts.bold, color: theme.secondary });
  drawTextBlock(page, `"${insights.narrative}"`, { x: PDF_MARGIN + 20, y: 428, width: CONTENT_WIDTH - 40, font: fonts.regular, size: 12.5, color: WHITE, lineHeight: 18, maxLines: 6 });
  page.drawText(pdfSafeText(report.advisorName || `${theme.branding.companyName || "GrowVest"} Advisor`), { x: PDF_MARGIN + 20, y: 326, size: 10, font: fonts.bold, color: WHITE });
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
  const actions = report.nextSteps || [];
  const chunks = [];
  for (let index = 0; index < actions.length; index += 6) chunks.push(actions.slice(index, index + 6));
  if (!chunks.length) chunks.push([]);
  chunks.forEach((items, pageIndex) => {
    const page = addPage(doc, fonts, report, template, theme, pageIndex === 0 ? "Recommended actions and next review" : "Recommended actions - continued");
    let y = 693;
    if (!items.length) {
      drawEmptyState(page, fonts, "No Advisor-recommended actions were recorded for this month.", 650);
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
        const meta = [item.recommendationType || "Portfolio Review", item.owner || "Advisor", item.priority || "Planned", item.status || "Recommended", `Decision ${item.investorDecision || "Pending Discussion"}`, item.sourceReportMonthKey ? `From ${item.sourceReportMonthKey}` : "", item.dueDate ? `Due ${dateText(item.dueDate)}` : ""].filter(Boolean).join(" | ");
        drawTextBlock(page, meta, { x: 400, y: itemY + 46, width: 135, font: fonts.regular, size: 6.3, color: MUTED, align: "right", lineHeight: 8, maxLines: 3 });
        y -= 82;
      });
    }
    if (pageIndex === chunks.length - 1) {
      drawPanel(page, { x: PDF_MARGIN, y: 94, width: CONTENT_WIDTH, height: 98, fill: rgb(0.93, 0.96, 1), border: theme.primary });
      page.drawText("NEXT PORTFOLIO REVIEW", { x: PDF_MARGIN + 16, y: 164, size: 7.5, font: fonts.bold, color: theme.primary });
      page.drawText(dateText(report.nextReview?.date), { x: PDF_MARGIN + 16, y: 135, size: 14, font: fonts.bold, color: INK });
      drawTextBlock(page, report.nextReview?.note || report.nextReview?.mode || "Your Advisor will be in touch.", { x: 245, y: 146, width: 290, font: fonts.regular, size: 8.3, color: MUTED, maxLines: 3, lineHeight: 11 });
    }
  });
}

function addDisclaimerPages(doc, fonts, report, template, theme) {
  const disclaimer = pdfSafeText(report.disclaimer || "No additional disclaimer text was supplied for this report.");
  const allLines = wrapText(disclaimer, fonts.regular, 9, CONTENT_WIDTH);
  const firstPageCapacity = 31;
  const continuationCapacity = 45;
  let offset = 0;
  let pageIndex = 0;
  while (offset < allLines.length || pageIndex === 0) {
    const page = addPage(doc, fonts, report, template, theme, pageIndex === 0 ? "Report information and disclaimer" : "Disclaimer - continued");
    let startY;
    let capacity;
    if (pageIndex === 0) {
      drawPanel(page, { x: PDF_MARGIN, y: 562, width: CONTENT_WIDTH, height: 145, fill: LIGHT, border: BORDER });
      const templateName = template.name || report.templateSnapshot?.name || "Premium Blue";
      const metadata = [
        ["Report reference", report.reportCode || "-"],
        ["Published version", report.publishedVersion || report.version || 1],
        ["Template", `${templateName} v${report.templateVersion || template.version || 1}`],
        ["Statement date", dateText(report.statementDate)],
        ["Generated", dateText(report.pdfGeneratedAt || report.completedAt || report.updatedAt)]
      ];
      metadata.forEach(([label, value], index) => {
        const y = 675 - index * 24;
        page.drawText(`${label.toUpperCase()}:`, { x: PDF_MARGIN + 18, y, size: 6.6, font: fonts.bold, color: MUTED });
        page.drawText(pdfSafeText(value), { x: 190, y, size: 8.2, font: fonts.regular, color: INK });
      });
      startY = 525;
      capacity = firstPageCapacity;
    } else {
      startY = 704;
      capacity = continuationCapacity;
    }
    const lines = allLines.slice(offset, offset + capacity);
    lines.forEach((line, index) => page.drawText(line, { x: PDF_MARGIN, y: startY - index * 13.5, size: 9, font: fonts.regular, color: MUTED }));
    offset += lines.length;
    pageIndex += 1;
    if (!allLines.length) break;
  }
}

export async function generateMonthlyReportPdf(report, { history = [] } = {}) {
  const doc = await PDFDocument.create();
  const branding = resolveReportBranding(report, report.branding || {});
  const normalizedReport = { ...report, branding };
  const template = resolveReportTemplate(normalizedReport);
  const theme = createTheme(normalizedReport, template);
  const logoUrl = branding.pdfLogoUrl || branding.primaryLogoUrl || branding.emailLogoUrl || branding.iconLogoUrl || "";
  const [logo, icon, watermark, coverBackground] = await Promise.all([
    embedRemoteImage(doc, logoUrl),
    embedRemoteImage(doc, branding.footerLogoUrl || branding.iconLogoUrl || ""),
    embedRemoteImage(doc, branding.watermarkUrl || ""),
    embedRemoteImage(doc, branding.coverBackgroundUrl || "")
  ]);
  normalizedReport.__brandingAssets = { logo, icon, watermark, coverBackground };

  doc.setTitle(normalizedReport.title || `${branding.companyName || "GrowVest"} Monthly Wealth Report`);
  doc.setAuthor(branding.legalName || "GrowVest Advisors Private Limited");
  doc.setSubject(`Monthly Wealth Report for ${normalizedReport.investorName || "Investor"}`);
  doc.setCreator(`${branding.companyName || "GrowVest"} Report Tool`);
  doc.setProducer("GrowVest Investor & Monthly Report Generator");
  doc.setKeywords(["GrowVest", "monthly wealth report", normalizedReport.reportCode || "report"]);
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { regular, bold, italic };

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
    commentary: () => addCommentaryPage(doc, fonts, normalizedReport, template, theme),
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
