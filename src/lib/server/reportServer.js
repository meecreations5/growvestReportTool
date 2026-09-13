import { adminBucket, adminDb, canInvestorAccessReport, canStaffAccessRecord } from "@/lib/server/firebaseAdmin";
import { generateMonthlyReportPdf } from "@/lib/server/reportPdf";
import { getServerBranding } from "@/lib/server/settingsServer";
import { REPORT_TYPE, getReportTypeLabel } from "@/lib/constants/report";

function cleanFilePart(value = "") {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function monthName(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1] || "Month";
}

function fileToken(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "") || "Report";
}

function brandedPdfFileName(report, branding, effectiveVersion, reportId) {
  const reportType = report.reportType === REPORT_TYPE.OPENING ? REPORT_TYPE.OPENING : REPORT_TYPE.MONTHLY;
  const legacyPattern = "{InvestorName}_{Month}_{Year}_GrowVest_Report.pdf";
  const configuredPattern = String(branding.pdfFilenamePattern || "").trim();
  const pattern = !configuredPattern || configuredPattern === legacyPattern
    ? "{CompanyName}_{ReportType}_{InvestorName}_{ReportPeriod}.pdf"
    : configuredPattern;
  const reportPeriod = reportType === REPORT_TYPE.OPENING
    ? String(report.statementDate || report.portfolioAsOfDate || report.reportMonthKey || "").slice(0, 10)
    : (report.reportMonthKey || `${report.reportYear || ""}-${String(report.reportMonth || "").padStart(2, "0")}`);
  const values = {
    CompanyName: branding.companyName || "GrowVest",
    ReportType: getReportTypeLabel(reportType),
    ReportPeriod: reportPeriod,
    AsOfDate: String(report.statementDate || report.portfolioAsOfDate || "").slice(0, 10),
    InvestorName: report.investorName || "Investor",
    Month: monthName(report.reportMonth),
    Year: report.reportYear || "",
    ClientCode: report.clientCode || "Client",
    ReportCode: report.reportCode || reportId || "Report",
    Version: `v${String(effectiveVersion).padStart(3, "0")}`
  };
  let name = pattern.replace(/\{(CompanyName|ReportType|ReportPeriod|AsOfDate|InvestorName|Month|Year|ClientCode|ReportCode|Version)\}/g, (_, key) => values[key]);
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  const withoutExtension = name.replace(/\.pdf$/i, "");
  return `${fileToken(withoutExtension)}.pdf`;
}

export function assertReportAccess(actor, report) {
  const staff = ["super_admin", "admin", "advisor"].includes(actor.role);
  if (staff && canStaffAccessRecord(actor, report)) return "staff";
  if (canInvestorAccessReport(actor, report)) return "investor";
  throw new Error("You are not authorised to access this Wealth Review.");
}

export function publishedSnapshotData(report, publishedVersion, versionId) {
  const { id: _id, activePublishedVersionId: _activePublishedVersionId, ...cleanReport } = report;
  return {
    ...cleanReport,
    publishedVersion,
    versionId,
    sourceReportVersion: Number(report.version || 1),
    status: "completed",
    investorVisible: true,
    publicationStatus: "published",
    publishedAt: new Date(),
    updatedAt: new Date()
  };
}

async function loadReportHistoryForPdf(report) {
  if (!report?.investorId) return [];
  try {
    const snapshot = await adminDb.collection("monthlyReports")
      .where("investorId", "==", report.investorId)
      .limit(50)
      .get();
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.id !== report.id && item.reportMonthKey)
      .sort((a, b) => String(a.reportMonthKey).localeCompare(String(b.reportMonthKey)))
      .slice(-12);
  } catch (error) {
    console.warn("Unable to load report history for PDF generation", error);
    return [];
  }
}

export async function createAndUploadReportPdf(report, { reportId, publishedVersion, versionId = null } = {}) {
  const branding = await getServerBranding();
  const reportWithId = { ...report, id: report.id || reportId };
  const history = await loadReportHistoryForPdf(reportWithId);
  const brandingSnapshot = { ...branding };
  const pdfBytes = await generateMonthlyReportPdf({ ...reportWithId, branding: brandingSnapshot, brandingSnapshot }, { history });
  const effectiveVersion = Number(publishedVersion || report.publishedVersion || report.version || 1);
  const fileName = brandedPdfFileName(report, branding, effectiveVersion, reportId);
  const reportTypeFolder = report.reportType === REPORT_TYPE.OPENING ? "opening" : "monthly";
  const periodFolder = report.reportType === REPORT_TYPE.OPENING
    ? cleanFilePart(String(report.statementDate || report.portfolioAsOfDate || report.reportMonthKey || "opening").slice(0, 10))
    : cleanFilePart(report.reportMonthKey || `${report.reportYear || "year"}-${String(report.reportMonth || "month").padStart(2, "0")}`);
  const versionFolder = `v${String(effectiveVersion).padStart(3, "0")}`;
  const storagePath = `monthly-reports/${cleanFilePart(report.investorId || "investor")}/${reportTypeFolder}/${periodFolder}/${versionFolder}/${fileName}`;
  const file = adminBucket.file(storagePath);
  await file.save(Buffer.from(pdfBytes), {
    resumable: false,
    contentType: "application/pdf",
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      metadata: {
        reportId,
        investorId: report.investorId || "",
        reportCode: report.reportCode || "",
        publishedVersion: String(effectiveVersion),
        versionId: versionId || ""
      }
    }
  });
  return {
    pdfStoragePath: storagePath,
    pdfFileName: fileName,
    pdfSizeBytes: pdfBytes.length,
    pdfGeneratedAt: new Date(),
    pdfVersion: effectiveVersion,
    pdfRendererVersion: "2.4.10",
    brandingSnapshot
  };
}

export async function loadReportAndVersion(reportId) {
  const reportSnapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
  if (!reportSnapshot.exists) throw new Error("Wealth Review was not found.");
  const report = { id: reportSnapshot.id, ...reportSnapshot.data() };
  let version = null;
  if (report.activePublishedVersionId) {
    const versionSnapshot = await adminDb.collection("reportVersions").doc(report.activePublishedVersionId).get();
    if (versionSnapshot.exists) version = { id: versionSnapshot.id, ...versionSnapshot.data() };
  }
  return { report, version };
}
