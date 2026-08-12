import { NextResponse } from "next/server";
import { adminDb, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { createAndUploadReportPdf, publishedSnapshotData } from "@/lib/server/reportServer";
import { sendReportDelivery } from "@/lib/server/reportDelivery";


export const runtime = "nodejs";

async function publishLinkedActionVisibility({ investorId, reportId, publishedVersion }) {
  if (!investorId) return 0;
  const actionSnapshots = await adminDb.collection("investorActions").where("investorId", "==", investorId).get();
  const linkedActions = actionSnapshots.docs.filter((item) => {
    const data = item.data();
    return data.sourceReportId === reportId || data.lastReportId === reportId;
  });
  if (!linkedActions.length) return 0;

  // Keep action/event visibility consistent. Report-origin actions are hidden
  // while drafts are internal, then both the action and its timeline become
  // visible together once the source report is published.
  const operations = [];
  for (const item of linkedActions) {
    operations.push({
      ref: item.ref,
      data: {
        investorVisible: true,
        publishedWithReportId: reportId,
        publishedWithReportVersion: publishedVersion,
        updatedAt: new Date()
      }
    });
    const eventSnapshots = await adminDb.collection("investorActionEvents").where("actionId", "==", item.id).get();
    eventSnapshots.docs.forEach((event) => operations.push({ ref: event.ref, data: { investorVisible: true } }));
  }

  for (let start = 0; start < operations.length; start += 400) {
    const batch = adminDb.batch();
    operations.slice(start, start + 400).forEach((operation) => batch.set(operation.ref, operation.data, { merge: true }));
    await batch.commit();
  }
  return linkedActions.length;
}
export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const sendEmail = body.sendEmail !== false;
    const reportRef = adminDb.collection("monthlyReports").doc(reportId);
    const snapshot = await reportRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Monthly report was not found." }, { status: 404 });
    const report = { id: snapshot.id, ...snapshot.data() };
    if (!canStaffAccessRecord(actor, report)) return NextResponse.json({ error: "You are not authorised to publish this report." }, { status: 403 });
    if (report.status !== "completed") return NextResponse.json({ error: "Complete the report before publishing it." }, { status: 422 });

    const nextPublishedVersion = Number(report.publishedVersion || 0) + 1;
    const versionId = `${reportId}_v${nextPublishedVersion}`;
    const versionRef = adminDb.collection("reportVersions").doc(versionId);
    const snapshotData = publishedSnapshotData(report, nextPublishedVersion, versionId);
    const pdf = await createAndUploadReportPdf(snapshotData, { reportId, publishedVersion: nextPublishedVersion, versionId });
    const versionData = { ...snapshotData, ...pdf, reportId, isActive: true, publishedByUid: actor.uid, publishedByName: actor.fullName || actor.email };

    const batch = adminDb.batch();
    if (report.activePublishedVersionId) {
      batch.set(adminDb.collection("reportVersions").doc(report.activePublishedVersionId), { isActive: false, supersededAt: new Date(), supersededByVersionId: versionId }, { merge: true });
    }
    batch.set(versionRef, versionData);
    batch.set(reportRef, {
      investorVisible: true,
      publicationStatus: "published",
      activePublishedVersionId: versionId,
      publishedVersion: nextPublishedVersion,
      publishedSourceVersion: Number(report.version || 1),
      publishedAt: new Date(),
      publishedByUid: actor.uid,
      publishedByName: actor.fullName || actor.email,
      ...pdf,
      pdfIsStale: false,
      pdfInvalidatedAt: null,
      pdfInvalidationReason: null,
      updatedAt: new Date()
    }, { merge: true });

    if (report.investorPortalUid) {
      const notificationRef = adminDb.collection("notifications").doc();
      batch.set(notificationRef, {
        recipientUid: report.investorPortalUid,
        recipientType: "investor",
        title: nextPublishedVersion > 1 ? "Updated Monthly Wealth Report Available" : "Monthly Wealth Report Available",
        message: `Your GrowVest report for ${report.title || report.reportMonthKey || "this month"} is ready.`,
        eventType: nextPublishedVersion > 1 ? "monthly_report_updated" : "monthly_report_published",
        link: `/investor/reports/${reportId}`,
        investorId: report.investorId || null,
        reportId,
        createdByUid: actor.uid,
        metadata: { reportCode: report.reportCode || "", publishedVersion: nextPublishedVersion },
        status: "unread",
        createdAt: new Date(),
        readAt: null
      });
    }

    if (report.advisorUid && report.advisorUid !== actor.uid) {
      const advisorNotificationRef = adminDb.collection("notifications").doc();
      batch.set(advisorNotificationRef, {
        recipientUid: report.advisorUid,
        recipientType: "advisor",
        title: "Monthly report published",
        message: `${report.investorName || "Investor"}'s monthly report version ${nextPublishedVersion} was published.`,
        eventType: "monthly_report_publish_confirmation",
        link: `/reports/${reportId}`,
        investorId: report.investorId || null,
        reportId,
        createdByUid: actor.uid,
        status: "unread",
        createdAt: new Date(),
        readAt: null
      });
    }

    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "monthly_report",
      recordId: reportId,
      reportId,
      investorId: report.investorId || null,
      advisorUid: report.advisorUid || actor.uid,
      action: nextPublishedVersion > 1 ? "monthly_report_revision_published" : "monthly_report_published",
      title: nextPublishedVersion > 1 ? "Monthly report revision published" : "Monthly report published",
      description: `${report.title || "Monthly report"} version ${nextPublishedVersion} was published by ${actor.fullName || actor.email}.`,
      metadata: { publishedVersion: nextPublishedVersion, versionId, pdfStoragePath: pdf.pdfStoragePath },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email,
      createdAt: new Date()
    });
    await batch.commit();

    // Report-origin actions remain internal while a report is a draft. Publishing
    // exposes the linked action and its complete client-visible timeline together.
    await publishLinkedActionVisibility({
      investorId: report.investorId,
      reportId,
      publishedVersion: nextPublishedVersion
    });

    let emailStatus = "not_requested";
    let emailError = null;
    if (sendEmail && report.investorEmail) {
      try {
        const deliveryReport = {
          ...report,
          id: reportId,
          investorVisible: true,
          publicationStatus: "published",
          activePublishedVersionId: versionId,
          publishedVersion: nextPublishedVersion,
          ...pdf
        };
        const delivery = await sendReportDelivery({ report: deliveryReport, actor, payload: {}, testMode: false });
        emailStatus = delivery.status;
      } catch (error) {
        emailStatus = "failed";
        emailError = error.message;
      }
    }
    if (!sendEmail) {
      await reportRef.set({ lastEmailStatus: "not_requested", lastEmailError: null, lastEmailAttemptAt: null }, { merge: true });
    }

    return NextResponse.json({ success: true, publishedVersion: nextPublishedVersion, versionId, ...pdf, emailStatus, emailError });
  } catch (error) {
    console.error("Report publication failed", error);
    return NextResponse.json({ error: error.message || "Unable to publish monthly report." }, { status: 500 });
  }
}
