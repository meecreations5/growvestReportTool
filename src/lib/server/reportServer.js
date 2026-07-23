import { adminBucket, adminDb, canInvestorAccessReport, canStaffAccessRecord } from "@/lib/server/firebaseAdmin";
import { generateMonthlyReportPdf } from "@/lib/server/reportPdf";
import { getServerBranding } from "@/lib/server/settingsServer";

function cleanFilePart(value = "") {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function monthName(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1] || "Month";
}

function brandedPdfFileName(report, branding, effectiveVersion, reportId) {
  const pattern = String(branding.pdfFilenamePattern || "{InvestorName}_{Month}_{Year}_GrowVest_Report.pdf");
  const values = {
    InvestorName: report.investorName || "Investor",
    Month: monthName(report.reportMonth),
    Year: report.reportYear || "",
    ClientCode: report.clientCode || "Client",
    ReportCode: report.reportCode || reportId || "Report",
    Version: effectiveVersion
  };
  let name = pattern.replace(/\{(InvestorName|Month|Year|ClientCode|ReportCode|Version)\}/g, (_, key) => values[key]);
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  const withoutExtension = name.replace(/\.pdf$/i, "");
  return `${cleanFilePart(withoutExtension)}.pdf`;
}

export function assertReportAccess(actor, report) {
  const staff = ["super_admin", "admin", "advisor"].includes(actor.role);
  if (staff && canStaffAccessRecord(actor, report)) return "staff";
  if (canInvestorAccessReport(actor, report)) return "investor";
  throw new Error("You are not authorised to access this monthly report.");
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
  const storagePath = `monthly-reports/${cleanFilePart(report.investorId || "investor")}/${cleanFilePart(reportId)}/${fileName}`;
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
    pdfRendererVersion: "2.0.0",
    brandingSnapshot
  };
}

export async function loadReportAndVersion(reportId) {
  const reportSnapshot = await adminDb.collection("monthlyReports").doc(reportId).get();
  if (!reportSnapshot.exists) throw new Error("Monthly report was not found.");
  const report = { id: reportSnapshot.id, ...reportSnapshot.data() };
  let version = null;
  if (report.activePublishedVersionId) {
    const versionSnapshot = await adminDb.collection("reportVersions").doc(report.activePublishedVersionId).get();
    if (versionSnapshot.exists) version = { id: versionSnapshot.id, ...versionSnapshot.data() };
  }
  return { report, version };
}
