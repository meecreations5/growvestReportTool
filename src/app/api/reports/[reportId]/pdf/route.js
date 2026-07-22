import { NextResponse } from "next/server";
import { adminBucket, adminDb, verifyAppRequest } from "@/lib/server/firebaseAdmin";
import { assertReportAccess, loadReportAndVersion } from "@/lib/server/reportServer";


export const runtime = "nodejs";
export async function GET(request, { params }) {
  try {
    const actor = await verifyAppRequest(request);
    const { reportId } = await params;
    const { report, version } = await loadReportAndVersion(reportId);
    const accessType = assertReportAccess(actor, report);
    const requestedVersionId = new URL(request.url).searchParams.get("versionId");
    let requestedVersion = null;
    if (requestedVersionId) {
      const requestedSnapshot = await adminDb.collection("reportVersions").doc(requestedVersionId).get();
      if (requestedSnapshot.exists && requestedSnapshot.data().reportId === reportId) {
        requestedVersion = { id: requestedSnapshot.id, ...requestedSnapshot.data() };
      }
    }
    if (accessType === "investor" && requestedVersionId && requestedVersionId !== report.activePublishedVersionId) {
      return NextResponse.json({ error: "Only the active published report version is available." }, { status: 403 });
    }
    const source = accessType === "investor" ? version : (requestedVersion || version || report);
    if (!source?.pdfStoragePath) return NextResponse.json({ error: "The final PDF has not been generated yet." }, { status: 404 });

    const [buffer] = await adminBucket.file(source.pdfStoragePath).download();
    const downloadRef = adminDb.collection("reportDownloads").doc();
    const batch = adminDb.batch();
    batch.set(downloadRef, {
      reportId,
      reportVersionId: source.versionId || report.activePublishedVersionId || null,
      publishedVersion: source.publishedVersion || report.publishedVersion || null,
      investorId: report.investorId || null,
      advisorUid: report.advisorUid || null,
      downloadedByUid: actor.uid,
      downloadedByRole: actor.role,
      downloadedByName: actor.fullName || actor.email || "User",
      downloadedAt: new Date()
    });
    batch.set(adminDb.collection("monthlyReports").doc(reportId), {
      downloadCount: Number(report.downloadCount || 0) + 1,
      lastDownloadedAt: new Date(),
      lastDownloadedByUid: actor.uid
    }, { merge: true });
    await batch.commit();

    const fileName = source.pdfFileName || `${report.reportCode || "GrowVest-report"}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName.replace(/\"/g, "")}"`,
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("Report PDF download failed", error);
    const message = error.message || "Unable to download report PDF.";
    return NextResponse.json({ error: message }, { status: message.includes("authorised") ? 403 : 500 });
  }
}
