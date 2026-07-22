import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawPdfDocumentChrome } from "@/lib/server/pdfDocumentShell";

const A4 = [595.28, 841.89];
const MARGIN = 44;
const BLUE = rgb(0.12, 0.31, 0.82);
const CYAN = rgb(0.05, 0.65, 0.76);
const INK = rgb(0.04, 0.05, 0.09);
const MUTED = rgb(0.38, 0.42, 0.5);
const LIGHT = rgb(0.95, 0.96, 0.98);
const RED = rgb(0.88, 0.16, 0.2);
const GREEN = rgb(0.05, 0.57, 0.41);

async function embedRemoteImage(doc, url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("png") || String(url).toLowerCase().includes(".png")) return await doc.embedPng(bytes);
    if (contentType.includes("jpeg") || contentType.includes("jpg") || /\.jpe?g(?:\?|$)/i.test(String(url))) return await doc.embedJpg(bytes);
    return null;
  } catch (error) {
    console.warn("Unable to embed report branding image", error);
    return null;
  }
}

function money(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function monthLabel(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1] || "";
}

function safeText(value) {
  return String(value ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function wrapText(text, font, size, maxWidth) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawTextBlock(page, text, options) {
  const { x, y, width, font, size = 10, color = INK, lineHeight = size * 1.35, maxLines = 20 } = options;
  const lines = wrapText(text, font, size, width).slice(0, maxLines);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size, font, color }));
  return y - lines.length * lineHeight;
}

function addHeader(page, fonts, report, pageNo) {
  drawPdfDocumentChrome(page, fonts, report, pageNo, { documentTitle: "Monthly Wealth Progress Report" });
}

function sectionTitle(page, fonts, title, y) {
  page.drawRectangle({ x: MARGIN, y: y + 2, width: 17, height: 3, color: BLUE });
  page.drawText(safeText(title).toUpperCase(), { x: MARGIN + 25, y, size: 16, font: fonts.bold, color: INK });
}

function metricCard(page, fonts, { x, y, width, label, value, note, accent = BLUE }) {
  page.drawRectangle({ x, y, width, height: 86, color: LIGHT, borderColor: rgb(0.86, 0.88, 0.92), borderWidth: 0.8 });
  page.drawText(safeText(label).toUpperCase(), { x: x + 14, y: y + 62, size: 7.5, font: fonts.bold, color: MUTED });
  page.drawText(safeText(value), { x: x + 14, y: y + 34, size: 18, font: fonts.bold, color: INK });
  if (note) page.drawText(safeText(note), { x: x + 14, y: y + 15, size: 7.5, font: fonts.regular, color: accent });
}

function addCover(doc, fonts, report) {
  const page = doc.addPage(A4);
  addHeader(page, fonts, report, 1);
  page.drawText("MONTHLY WEALTH PROGRESS REPORT", { x: MARGIN, y: 620, size: 10, font: fonts.bold, color: BLUE });
  page.drawText(monthLabel(report.reportMonth), { x: MARGIN, y: 555, size: 48, font: fonts.bold, color: INK });
  page.drawText(String(report.reportYear || ""), { x: MARGIN, y: 505, size: 48, font: fonts.bold, color: INK });
  page.drawText(safeText(report.branding?.tagline || "Your Conscious Wealth Partner"), { x: MARGIN, y: 462, size: 15, font: fonts.italic, color: MUTED });
  page.drawText(`Statement date: ${safeText(report.statementDate || "-")}`, { x: MARGIN, y: 441, size: 9, font: fonts.regular, color: MUTED });

  page.drawRectangle({ x: MARGIN, y: 320, width: 235, height: 98, color: LIGHT, borderColor: rgb(0.85, 0.87, 0.91), borderWidth: 0.8 });
  page.drawText("PREPARED FOR", { x: MARGIN + 17, y: 393, size: 8, font: fonts.bold, color: MUTED });
  page.drawText(safeText(report.investorName || "Investor"), { x: MARGIN + 17, y: 359, size: 18, font: fonts.bold, color: INK });
  page.drawText(`Client ID: ${safeText(report.clientCode || "-")}`, { x: MARGIN + 17, y: 338, size: 9, font: fonts.regular, color: MUTED });

  page.drawRectangle({ x: 300, y: 320, width: 251, height: 98, color: LIGHT, borderColor: rgb(0.85, 0.87, 0.91), borderWidth: 0.8 });
  page.drawText("YOUR ADVISOR", { x: 317, y: 393, size: 8, font: fonts.bold, color: MUTED });
  page.drawText(safeText(report.advisorName || `${report.branding?.companyName || "GrowVest"} Advisor`), { x: 317, y: 359, size: 18, font: fonts.bold, color: INK });
  page.drawText(safeText(report.advisorDesignation || "Relationship Manager"), { x: 317, y: 338, size: 9, font: fonts.regular, color: MUTED });
  return page;
}

function addOverview(doc, fonts, report) {
  const page = doc.addPage(A4);
  addHeader(page, fonts, report, doc.getPageCount());
  sectionTitle(page, fonts, "Portfolio at a glance", 750);
  page.drawRectangle({ x: MARGIN, y: 615, width: 507, height: 105, color: INK });
  page.drawText("TOTAL PORTFOLIO VALUE", { x: MARGIN + 20, y: 690, size: 8, font: fonts.bold, color: rgb(0.65, 0.69, 0.76) });
  page.drawText(money(report.summary?.totalCorpus), { x: MARGIN + 20, y: 650, size: 28, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(`Overall progress: ${Number(report.summary?.overallProgress || 0).toFixed(1)}%`, { x: 390, y: 655, size: 11, font: fonts.bold, color: CYAN });

  metricCard(page, fonts, { x: MARGIN, y: 500, width: 158, label: "Monthly SIP", value: money(report.summary?.monthlySip), note: "Active this month" });
  metricCard(page, fonts, { x: MARGIN + 174, y: 500, width: 158, label: "New Money Added", value: money(report.summary?.newMoneyAdded), note: "Contributions received", accent: CYAN });
  metricCard(page, fonts, { x: MARGIN + 348, y: 500, width: 159, label: "Investment Gain", value: money(report.summary?.investmentGain), note: "Monthly movement", accent: Number(report.summary?.investmentGain || 0) >= 0 ? GREEN : RED });

  sectionTitle(page, fonts, "Portfolio composition", 452);
  let y = 420;
  const holdings = (report.holdings || []).slice(0, 10);
  holdings.forEach((item) => {
    page.drawText(safeText(item.assetClass || "Other"), { x: MARGIN, y, size: 10, font: fonts.bold, color: INK });
    page.drawText(money(item.currentValue), { x: 260, y, size: 9, font: fonts.regular, color: MUTED });
    page.drawText(`${Number(item.percentage || 0).toFixed(1)}%`, { x: 495, y, size: 9, font: fonts.bold, color: INK });
    page.drawRectangle({ x: MARGIN, y: y - 10, width: 450, height: 5, color: rgb(0.9, 0.92, 0.95) });
    page.drawRectangle({ x: MARGIN, y: y - 10, width: Math.max(1, Math.min(450, 450 * Number(item.percentage || 0) / 100)), height: 5, color: BLUE });
    y -= 35;
  });
  return page;
}

function addAdvisorPage(doc, fonts, report) {
  const page = doc.addPage(A4);
  addHeader(page, fonts, report, doc.getPageCount());
  sectionTitle(page, fonts, "Advisor insights", 730);
  page.drawRectangle({ x: MARGIN, y: 400, width: 507, height: 285, color: LIGHT, borderColor: rgb(0.84, 0.87, 0.92), borderWidth: 0.8 });
  const narrative = report.advisorInsights?.narrative || report.advisorNote?.content || "Your portfolio continues to progress in line with your financial plan.";
  drawTextBlock(page, narrative, { x: MARGIN + 25, y: 640, width: 455, font: fonts.regular, size: 14, lineHeight: 22, maxLines: 9 });
  page.drawText(safeText(report.advisorName || `${report.branding?.companyName || "GrowVest"} Advisor`), { x: MARGIN + 25, y: 445, size: 14, font: fonts.bold, color: INK });
  page.drawText(safeText(report.advisorDesignation || "Relationship Manager"), { x: MARGIN + 25, y: 428, size: 9, font: fonts.regular, color: MUTED });

  let y = 345;
  const insightItems = [
    ["Progress Highlight", report.advisorInsights?.progressHighlight, CYAN],
    ["Priority Attention", report.advisorInsights?.priorityAttention, RED],
    ["Portfolio Opportunity", report.advisorInsights?.portfolioOpportunity, BLUE]
  ];
  insightItems.forEach(([label, item, accent]) => {
    if (!item?.title && !item?.description) return;
    page.drawRectangle({ x: MARGIN, y: y - 70, width: 507, height: 66, color: LIGHT, borderColor: accent, borderWidth: 0.7 });
    page.drawText(label.toUpperCase(), { x: MARGIN + 15, y: y - 20, size: 7.5, font: fonts.bold, color: accent });
    page.drawText(safeText(item.title || ""), { x: MARGIN + 15, y: y - 40, size: 12, font: fonts.bold, color: INK });
    page.drawText(safeText(item.description || ""), { x: MARGIN + 210, y: y - 40, size: 9, font: fonts.regular, color: MUTED });
    y -= 78;
  });
  return page;
}

function addGoalsPages(doc, fonts, report) {
  const goals = report.goals || [];
  const chunks = [];
  for (let i = 0; i < goals.length; i += 6) chunks.push(goals.slice(i, i + 6));
  if (!chunks.length) chunks.push([]);
  chunks.forEach((chunk) => {
    const page = doc.addPage(A4);
    addHeader(page, fonts, report, doc.getPageCount());
    sectionTitle(page, fonts, "Bucket list progress", 750);
    let y = 690;
    chunk.forEach((goal) => {
      page.drawRectangle({ x: MARGIN, y: y - 88, width: 507, height: 80, color: rgb(1, 1, 1), borderColor: rgb(0.84, 0.87, 0.92), borderWidth: 0.8 });
      page.drawText(safeText(goal.name || "Financial goal"), { x: MARGIN + 15, y: y - 28, size: 12, font: fonts.bold, color: INK });
      page.drawText(`${Number(goal.progress || 0).toFixed(1)}%`, { x: 485, y: y - 28, size: 11, font: fonts.bold, color: goal.status === "Review Needed" ? RED : BLUE });
      page.drawText(`Current: ${money(goal.currentAmount)}   Target: ${money(goal.targetAmount)}`, { x: MARGIN + 15, y: y - 51, size: 8.5, font: fonts.regular, color: MUTED });
      page.drawText(`Monthly SIP: ${money(goal.monthlySip)}   Target year: ${goal.targetYear || "-"}   Status: ${safeText(goal.status || "Planning")}`, { x: MARGIN + 15, y: y - 69, size: 8, font: fonts.regular, color: MUTED });
      y -= 96;
    });
    if (!chunk.length) page.drawText("No Bucket List goals were included in this report.", { x: MARGIN, y: 680, size: 11, font: fonts.regular, color: MUTED });
  });
}

function addAllocationPage(doc, fonts, report) {
  const page = doc.addPage(A4);
  addHeader(page, fonts, report, doc.getPageCount());
  sectionTitle(page, fonts, "Portfolio health and allocation", 750);
  let y = 700;
  page.drawText("ASSET CLASS", { x: MARGIN, y, size: 8, font: fonts.bold, color: MUTED });
  page.drawText("CURRENT VALUE", { x: 180, y, size: 8, font: fonts.bold, color: MUTED });
  page.drawText("CURRENT", { x: 350, y, size: 8, font: fonts.bold, color: MUTED });
  page.drawText("TARGET", { x: 420, y, size: 8, font: fonts.bold, color: MUTED });
  page.drawText("VARIANCE", { x: 490, y, size: 8, font: fonts.bold, color: MUTED });
  y -= 24;
  (report.allocation || []).slice(0, 15).forEach((item) => {
    page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: 551, y: y - 8 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.94) });
    page.drawText(safeText(item.assetClass || "Other"), { x: MARGIN, y, size: 9.5, font: fonts.bold, color: INK });
    page.drawText(money(item.currentValue), { x: 180, y, size: 9, font: fonts.regular, color: INK });
    page.drawText(`${Number(item.currentPercentage || 0).toFixed(1)}%`, { x: 350, y, size: 9, font: fonts.regular, color: INK });
    page.drawText(`${Number(item.targetPercentage || 0).toFixed(1)}%`, { x: 420, y, size: 9, font: fonts.regular, color: INK });
    const variance = Number(item.variance || 0);
    page.drawText(`${variance > 0 ? "+" : ""}${variance.toFixed(1)}%`, { x: 490, y, size: 9, font: fonts.bold, color: Math.abs(variance) <= 2 ? GREEN : RED });
    y -= 32;
  });
  if (report.portfolioHealth?.observation) {
    page.drawRectangle({ x: MARGIN, y: 110, width: 507, height: 95, color: rgb(1, 0.98, 0.9), borderColor: rgb(0.95, 0.72, 0.15), borderWidth: 0.7 });
    page.drawText("OBSERVATION", { x: MARGIN + 15, y: 180, size: 8, font: fonts.bold, color: rgb(0.8, 0.45, 0) });
    drawTextBlock(page, report.portfolioHealth.observation, { x: MARGIN + 15, y: 158, width: 470, font: fonts.regular, size: 9.5, lineHeight: 14, maxLines: 5 });
  }
}

function addFundsPages(doc, fonts, report) {
  const funds = report.funds || [];
  const chunks = [];
  for (let i = 0; i < funds.length; i += 14) chunks.push(funds.slice(i, i + 14));
  if (!chunks.length) chunks.push([]);
  chunks.forEach((chunk) => {
    const page = doc.addPage(A4);
    addHeader(page, fonts, report, doc.getPageCount());
    sectionTitle(page, fonts, "Fund-wise holdings", 750);
    let y = 700;
    page.drawText("INSTRUMENT", { x: MARGIN, y, size: 8, font: fonts.bold, color: MUTED });
    page.drawText("CLASS", { x: 285, y, size: 8, font: fonts.bold, color: MUTED });
    page.drawText("LINKED GOAL", { x: 355, y, size: 8, font: fonts.bold, color: MUTED });
    page.drawText("SIP", { x: 450, y, size: 8, font: fonts.bold, color: MUTED });
    page.drawText("VALUE", { x: 505, y, size: 8, font: fonts.bold, color: MUTED });
    y -= 23;
    chunk.forEach((item) => {
      page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: 551, y: y - 8 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.94) });
      const name = safeText(item.instrumentName || "Investment");
      page.drawText(name.length > 38 ? `${name.slice(0, 36)}...` : name, { x: MARGIN, y, size: 8.5, font: fonts.bold, color: INK });
      page.drawText(safeText(item.assetClass || "Other"), { x: 285, y, size: 8, font: fonts.regular, color: MUTED });
      page.drawText(safeText(item.goalName || "-"), { x: 355, y, size: 8, font: fonts.regular, color: MUTED });
      page.drawText(money(item.monthlySip), { x: 450, y, size: 8, font: fonts.regular, color: INK });
      page.drawText(money(item.currentValue), { x: 505, y, size: 8, font: fonts.bold, color: INK });
      y -= 34;
    });
    if (!chunk.length) page.drawText("No fund-wise holdings were included in this report.", { x: MARGIN, y: 670, size: 11, font: fonts.regular, color: MUTED });
  });
}

function addActionsPage(doc, fonts, report) {
  const page = doc.addPage(A4);
  addHeader(page, fonts, report, doc.getPageCount());
  sectionTitle(page, fonts, "Advisor-recommended actions", 750);
  let y = 690;
  (report.nextSteps || []).slice(0, 8).forEach((item, index) => {
    page.drawCircle({ x: MARGIN + 12, y: y - 5, size: 11, color: BLUE });
    page.drawText(String(index + 1), { x: MARGIN + 9, y: y - 9, size: 8, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText(safeText(item.title || item.description || "Action item"), { x: MARGIN + 35, y, size: 11, font: fonts.bold, color: INK });
    drawTextBlock(page, item.description || "", { x: MARGIN + 35, y: y - 18, width: 410, font: fonts.regular, size: 8.5, color: MUTED, lineHeight: 12, maxLines: 2 });
    page.drawText(`${safeText(item.owner || "Advisor")} | ${safeText(item.priority || "Planned")} | ${safeText(item.dueDate || "Next review")}`, { x: 405, y, size: 7.5, font: fonts.regular, color: MUTED });
    y -= 66;
  });
  if (!(report.nextSteps || []).length) page.drawText("No recommended actions were recorded.", { x: MARGIN, y: 680, size: 11, font: fonts.regular, color: MUTED });

  page.drawRectangle({ x: MARGIN, y: 155, width: 507, height: 75, color: rgb(0.92, 0.95, 1), borderColor: BLUE, borderWidth: 0.7 });
  page.drawText("NEXT PORTFOLIO REVIEW", { x: MARGIN + 16, y: 205, size: 8, font: fonts.bold, color: BLUE });
  page.drawText(safeText(report.nextReview?.date || "To be scheduled"), { x: MARGIN + 16, y: 180, size: 15, font: fonts.bold, color: INK });
  page.drawText(safeText(report.nextReview?.note || report.nextReview?.mode || "Your Advisor will be in touch."), { x: 250, y: 183, size: 9, font: fonts.regular, color: MUTED });
  drawTextBlock(page, report.disclaimer || "", { x: MARGIN, y: 105, width: 507, font: fonts.regular, size: 7.5, lineHeight: 11, color: MUTED, maxLines: 5 });
}

export async function generateMonthlyReportPdf(report) {
  const doc = await PDFDocument.create();
  const branding = report.branding || {};
  const logoUrl = branding.primaryLogoUrl || branding.emailLogoUrl || branding.iconLogoUrl || "";
  const [logo, icon, watermark] = await Promise.all([
    embedRemoteImage(doc, logoUrl),
    embedRemoteImage(doc, branding.iconLogoUrl || ""),
    embedRemoteImage(doc, branding.watermarkUrl || "")
  ]);
  report.__brandingAssets = { logo, icon, watermark };
  doc.setTitle(report.title || `${branding.companyName || "GrowVest"} Monthly Wealth Report`);
  doc.setAuthor(branding.legalName || "GrowVest Advisors Private Limited");
  doc.setSubject(`Monthly Wealth Report for ${report.investorName || "Investor"}`);
  doc.setCreator(`${branding.companyName || "GrowVest"} Report Tool`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { regular, bold, italic };

  addCover(doc, fonts, report);
  addOverview(doc, fonts, report);
  addAdvisorPage(doc, fonts, report);
  addGoalsPages(doc, fonts, report);
  addAllocationPage(doc, fonts, report);
  addFundsPages(doc, fonts, report);
  addActionsPage(doc, fonts, report);

  return doc.save();
}
