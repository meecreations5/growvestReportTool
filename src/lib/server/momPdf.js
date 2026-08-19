import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchSafeRemoteImage } from "@/lib/server/safeRemoteAsset";
import {
  drawPdfDocumentChrome,
  pdfHexColor,
  pdfSafeText,
  PDF_A4_HEIGHT,
  PDF_A4_WIDTH,
  PDF_MARGIN
} from "@/lib/server/pdfDocumentShell";

const CONTENT_WIDTH = PDF_A4_WIDTH - (PDF_MARGIN * 2);
const CONTENT_TOP = 770;
const CONTENT_BOTTOM = 58;
const INK = rgb(0.05, 0.07, 0.12);
const MUTED = rgb(0.38, 0.43, 0.52);
const BORDER = rgb(0.86, 0.89, 0.93);
const LIGHT = rgb(0.965, 0.975, 0.99);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.05, 0.55, 0.38);
const AMBER = rgb(0.76, 0.43, 0.04);

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

function formatDate(value) {
  if (!value) return "-";
  const raw = typeof value?.toDate === "function" ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value;
  const date = raw instanceof Date ? raw : new Date(String(raw).includes("T") ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return pdfSafeText(value);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
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

function wrapText(value, font, size, maxWidth) {
  const text = pdfSafeText(value || "");
  const lines = [];
  text.split(/\r?\n/).forEach((paragraph, paragraphIndex, paragraphs) => {
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

function fitText(font, value, preferred, maxWidth, minimum = 8) {
  const text = pdfSafeText(value || "");
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

function createPage(doc, pages) {
  const page = doc.addPage([PDF_A4_WIDTH, PDF_A4_HEIGHT]);
  pages.push(page);
  return page;
}

function drawLabel(page, fonts, label, x, y, color = MUTED) {
  page.drawText(pdfSafeText(label).toUpperCase(), { x, y, size: 7.2, font: fonts.bold, color });
}

function drawSectionHeading(page, fonts, title, y, primary) {
  page.drawRectangle({ x: PDF_MARGIN, y: y + 2, width: 18, height: 3.5, color: primary });
  page.drawText(pdfSafeText(title).toUpperCase(), { x: PDF_MARGIN + 26, y, size: 14, font: fonts.bold, color: INK });
  return y - 24;
}

function drawTextLines(page, lines, { x, y, font, size, lineHeight, color = INK }) {
  lines.forEach((line, index) => page.drawText(line, { x, y: y - (index * lineHeight), size, font, color }));
  return y - (lines.length * lineHeight);
}

function sectionHeight(text, fonts, width, size = 9.2, lineHeight = 13) {
  const lines = wrapText(text || "-", fonts.regular, size, width - 28);
  return { lines, height: Math.max(56, 34 + (lines.length * lineHeight)) };
}

function drawNarrativeCard(page, fonts, { title, text, x, y, width, primary, tone = "default" }) {
  const { lines, height } = sectionHeight(text, fonts, width);
  const fill = tone === "client" ? rgb(0.94, 0.97, 1) : tone === "internal" ? rgb(0.975, 0.975, 0.98) : WHITE;
  const border = tone === "client" ? primary : BORDER;
  page.drawRectangle({ x, y: y - height, width, height, color: fill, borderColor: border, borderWidth: 0.8 });
  drawLabel(page, fonts, title, x + 14, y - 19, tone === "client" ? primary : MUTED);
  drawTextLines(page, lines, { x: x + 14, y: y - 40, font: fonts.regular, size: 9.2, lineHeight: 13, color: INK });
  return y - height - 14;
}

function itemHeight(item, fonts, width) {
  const titleLines = wrapText(item.description || item.title || "-", fonts.bold, 9.2, width - 28);
  const meta = [item.owner || item.assignedToName, item.dueDate ? `Due ${formatDate(item.dueDate)}` : "", item.priority ? `${item.priority} priority` : "", item.status || ""].filter(Boolean).join(" | ");
  const metaLines = wrapText(meta, fonts.regular, 7.5, width - 28);
  return { titleLines, metaLines, height: Math.max(58, 28 + titleLines.length * 12 + metaLines.length * 10) };
}

function drawListItem(page, fonts, item, { x, y, width, primary, index, kind }) {
  const { titleLines, metaLines, height } = itemHeight(item, fonts, width);
  const visible = item.clientVisible !== false;
  page.drawRectangle({ x, y: y - height, width, height, color: WHITE, borderColor: BORDER, borderWidth: 0.75 });
  page.drawCircle({ x: x + 18, y: y - 20, size: 10, color: visible ? primary : rgb(0.64, 0.68, 0.74) });
  const number = String(index + 1);
  const numberWidth = fonts.bold.widthOfTextAtSize(number, 7);
  page.drawText(number, { x: x + 18 - numberWidth / 2, y: y - 22.5, size: 7, font: fonts.bold, color: WHITE });
  drawTextLines(page, titleLines, { x: x + 36, y: y - 19, font: fonts.bold, size: 9.2, lineHeight: 12, color: INK });
  const metaY = y - 21 - (titleLines.length * 12);
  drawTextLines(page, metaLines, { x: x + 36, y: metaY, font: fonts.regular, size: 7.5, lineHeight: 10, color: MUTED });
  const badge = visible ? "INVESTOR" : "INTERNAL";
  const badgeColor = visible ? primary : MUTED;
  const badgeWidth = fonts.bold.widthOfTextAtSize(badge, 6.4) + 14;
  page.drawRectangle({ x: x + width - badgeWidth - 10, y: y - height + 10, width: badgeWidth, height: 16, color: LIGHT, borderColor: badgeColor, borderWidth: 0.55 });
  page.drawText(badge, { x: x + width - badgeWidth - 3, y: y - height + 15, size: 6.4, font: fonts.bold, color: badgeColor });
  if (kind === "action") {
    const status = String(item.status || "pending").replace(/_/g, " ").toUpperCase();
    page.drawText(status, { x: x + 36, y: y - height + 14, size: 6.5, font: fonts.bold, color: item.status === "completed" ? GREEN : AMBER });
  }
  return y - height - 10;
}

export async function generateMomPdf(mom, { branding = {}, advisor = {} } = {}) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { regular, bold, italic };
  const primary = pdfHexColor(branding.primaryColor || "#1F4ED8");
  const secondary = pdfHexColor(branding.secondaryColor || "#20B8CD");
  const pages = [];
  const [logo, icon, watermark] = await Promise.all([
    embedRemoteImage(doc, branding.pdfLogoUrl || branding.primaryLogoUrl || branding.emailLogoUrl || ""),
    embedRemoteImage(doc, branding.footerLogoUrl || branding.iconLogoUrl || ""),
    embedRemoteImage(doc, branding.watermarkUrl || "")
  ]);
  const normalized = { ...mom, __brandingAssets: { logo, icon, watermark } };

  doc.setTitle(`${mom.momCode || "GrowVest MOM"} - ${mom.meetingTitle || "Minutes of Meeting"}`);
  doc.setAuthor(branding.legalName || "GrowVest Advisors Private Limited");
  doc.setSubject(`Minutes of Meeting for ${mom.investorName || mom.leadName || "Client"}`);
  doc.setCreator(`${branding.companyName || "GrowVest"} Investor & Monthly Report Tool`);
  doc.setProducer("GrowVest MOM PDF Renderer 1.0.0");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  let page = createPage(doc, pages);
  page.drawRectangle({ x: PDF_MARGIN, y: 615, width: CONTENT_WIDTH, height: 135, color: rgb(0.035, 0.055, 0.12) });
  drawLabel(page, fonts, "Minutes of Meeting", PDF_MARGIN + 22, 720, secondary);
  const titleSize = fitText(fonts.bold, mom.meetingTitle || "Portfolio Review", 25, CONTENT_WIDTH - 44, 15);
  page.drawText(pdfSafeText(mom.meetingTitle || "Portfolio Review"), { x: PDF_MARGIN + 22, y: 678, size: titleSize, font: fonts.bold, color: WHITE });
  page.drawText(pdfSafeText(mom.momCode || ""), { x: PDF_MARGIN + 22, y: 645, size: 9, font: fonts.bold, color: secondary });

  const metaY = 578;
  const metaWidth = (CONTENT_WIDTH - 20) / 2;
  const meta = [
    ["Client", mom.investorName || mom.leadName || "Internal"],
    ["Meeting date", formatDate(mom.meetingDate)],
    ["Advisor", advisor.fullName || mom.advisorName || "GrowVest Advisor"],
    ["Status", String(mom.status || "draft").replace(/_/g, " ")]
  ];
  meta.forEach(([label, value], index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = PDF_MARGIN + col * (metaWidth + 20);
    const y = metaY - row * 76;
    page.drawRectangle({ x, y: y - 57, width: metaWidth, height: 57, color: LIGHT, borderColor: BORDER, borderWidth: 0.7 });
    drawLabel(page, fonts, label, x + 13, y - 18);
    const size = fitText(fonts.bold, value, 11, metaWidth - 26, 7.5);
    page.drawText(pdfSafeText(value), { x: x + 13, y: y - 40, size, font: fonts.bold, color: INK });
  });

  let y = 400;
  y = drawSectionHeading(page, fonts, "Client-facing summary", y, primary);
  y = drawNarrativeCard(page, fonts, { title: "Visible to Investor", text: mom.clientSummary || "No client-facing summary was recorded.", x: PDF_MARGIN, y, width: CONTENT_WIDTH, primary, tone: "client" });
  if (mom.followUpRequired) {
    const followUpText = `${formatDate(mom.followUpDate)}${mom.followUpTime ? ` at ${mom.followUpTime}` : ""}${mom.followUpPurpose ? ` - ${mom.followUpPurpose}` : ""}`;
    y = drawNarrativeCard(page, fonts, { title: "Next follow-up", text: followUpText, x: PDF_MARGIN, y, width: CONTENT_WIDTH, primary });
  }

  const narrativeSections = [
    ["Internal discussion record", mom.discussionSummary, "internal"],
    ["Client requirements", mom.clientRequirements, "default"],
    ["Goals discussed", mom.goalsDiscussed, "default"],
    ["Investments discussed", mom.investmentsDiscussed, "default"],
    ["Liabilities discussed", mom.liabilitiesDiscussed, "default"],
    ["Client concerns", mom.clientConcerns, "default"],
    ["Family inputs", mom.familyInputs, "default"],
    ["Advisor observations", mom.advisorObservations, "internal"],
    ["Internal notes", mom.internalNotes, "internal"]
  ].filter(([, text]) => String(text || "").trim());

  for (const [title, text, tone] of narrativeSections) {
    const preview = sectionHeight(text, fonts, CONTENT_WIDTH);
    if (y - preview.height < CONTENT_BOTTOM) {
      page = createPage(doc, pages);
      y = CONTENT_TOP;
    }
    y = drawNarrativeCard(page, fonts, { title, text, x: PDF_MARGIN, y, width: CONTENT_WIDTH, primary, tone });
  }

  const lists = [
    ["Decisions", mom.decisions || [], "decision"],
    ["Action items", mom.actionItems || [], "action"]
  ];
  for (const [title, items, kind] of lists) {
    if (!items.length) continue;
    if (y < 120) {
      page = createPage(doc, pages);
      y = CONTENT_TOP;
    }
    y = drawSectionHeading(page, fonts, title, y, primary);
    for (let index = 0; index < items.length; index += 1) {
      const height = itemHeight(items[index], fonts, CONTENT_WIDTH).height;
      if (y - height < CONTENT_BOTTOM) {
        page = createPage(doc, pages);
        y = CONTENT_TOP;
        y = drawSectionHeading(page, fonts, `${title} - continued`, y, primary);
      }
      y = drawListItem(page, fonts, items[index], { x: PDF_MARGIN, y, width: CONTENT_WIDTH, primary, index, kind });
    }
  }

  pages.forEach((item, index) => {
    drawPdfDocumentChrome(item, fonts, normalized, index + 1, {
      documentTitle: "Minutes of Meeting",
      showReportMonth: false,
      totalPages: pages.length
    });
  });

  return doc.save();
}
