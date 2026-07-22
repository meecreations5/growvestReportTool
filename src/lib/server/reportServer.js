import { adminBucket, adminDb, canInvestorAccessReport, canStaffAccessRecord } from "@/lib/server/firebaseAdmin";
import { generateMonthlyReportPdf } from "@/lib/server/reportPdf";
import { getServerBranding } from "@/lib/server/settingsServer";

function cleanFilePart(value = "") {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
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

export async function createAndUploadReportPdf(report, { reportId, publishedVersion, versionId = null } = {}) {
  const branding = await getServerBranding();
  const pdfBytes = await generateMonthlyReportPdf({ ...report, branding });
  const effectiveVersion = Number(publishedVersion || report.publishedVersion || report.version || 1);
  const fileName = `${cleanFilePart(report.reportCode || reportId)}-v${effectiveVersion}.pdf`;
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
    pdfVersion: effectiveVersion
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
