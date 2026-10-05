import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  canStaffAccessRecord,
  verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { createAndUploadReportPdf, publishedSnapshotData } from "@/lib/server/reportServer";
import { sendReportDelivery } from "@/lib/server/reportDelivery";
import { REPORT_TYPE, getReportTypeLabel, getReportVersionId } from "@/lib/constants/report";
import { buildReportReconciliation } from "@/lib/reportReconciliation";
import { isMonthlyPeriodAfterOpening } from "@/lib/reportPeriodRules";

export const runtime = "nodejs";

const PUBLISH_CLAIM_TTL_MS = 10 * 60 * 1000;

function requestError(message, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function claimDate(value) {
  if (!value) return null;
  const date = value?.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPublishedReview(report = {}) {
  return Boolean(
    report.investorVisible === true
      && (
        report.activePublishedVersionId
        || Number(report.publishedVersion || 0) > 0
        || report.publicationStatus === "published"
      )
  );
}

async function publishLinkedActionVisibility({ investorId, reportId, publishedVersion }) {
  if (!investorId) return 0;
  const actionSnapshots = await adminDb.collection("investorActions").where("investorId", "==", investorId).get();
  const linkedActions = actionSnapshots.docs.filter((item) => {
    const data = item.data();
    return data.sourceReportId === reportId || data.lastReportId === reportId;
  });
  if (!linkedActions.length) return 0;

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

async function releasePublishClaim(reportRef, claimToken, fallbackPublicationStatus = "internal", failureReason = "") {
  if (!claimToken) return;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reportRef);
      if (!snapshot.exists) return;
      const data = snapshot.data() || {};
      if (data.publicationClaim?.token !== claimToken) return;
      transaction.set(reportRef, {
        publicationClaim: FieldValue.delete(),
        publicationStatus: data.activePublishedVersionId ? (data.pdfIsStale ? "revision_ready" : "published") : fallbackPublicationStatus,
        lastPublishFailureReason: failureReason ? String(failureReason).slice(0, 1200) : null,
        lastPublishFailedAt: failureReason ? new Date() : null,
        updatedAt: new Date()
      }, { merge: true });
    });
  } catch (releaseError) {
    console.error("Unable to release Wealth Review publication claim", releaseError);
  }
}

export async function POST(request, { params }) {
  let reportRef = null;
  let claimToken = "";
  let fallbackPublicationStatus = "internal";
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const sendEmail = body.sendEmail !== false;
    reportRef = adminDb.collection("monthlyReports").doc(reportId);

    const claim = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reportRef);
      if (!snapshot.exists) throw requestError("Wealth Review was not found.", 404);
      const report = { id: snapshot.id, ...snapshot.data() };
      if (!canStaffAccessRecord(actor, report)) throw requestError("You are not authorised to publish this report.", 403);
      if (report.status !== "completed") throw requestError("Complete the report before publishing it.", 422);

      if (report.reportType === REPORT_TYPE.MONTHLY && report.investorId) {
        const historyQuery = adminDb.collection("monthlyReports")
          .where("investorId", "==", report.investorId)
          .limit(50);
        const historySnapshot = await transaction.get(historyQuery);
        const history = historySnapshot.docs
          .filter((item) => item.id !== reportId)
          .map((item) => ({ id: item.id, ...item.data() }));
        const openingReport = history.find((item) => item.reportType === REPORT_TYPE.OPENING) || null;
        const hasLegacyPublishedReview = history.some((item) => item.reportType !== REPORT_TYPE.OPENING && isPublishedReview(item));
        if (!openingReport && !hasLegacyPublishedReview) {
          throw requestError("The first investor-facing GrowVest report must be an Opening Wealth Review. Create and publish the Opening Wealth Review before publishing Monthly Wealth Reviews.", 422);
        }
        if (openingReport) {
          if (!isPublishedReview(openingReport)) {
            throw requestError("Publish the Opening Wealth Review before publishing a Monthly Wealth Review for this investor.", 422);
          }
          if (!isMonthlyPeriodAfterOpening(openingReport, String(report.reportMonthKey || ""), report.statementDate || "")) {
            throw requestError(`The Opening Wealth Review establishes this investor's baseline on ${openingReport.statementDate || openingReport.reportMonthKey || "the opening snapshot"}. The Monthly Wealth Review cutoff must be later than that baseline.`, 422);
          }
        }
      }

      const reportReconciliation = buildReportReconciliation(report);
      if (reportReconciliation.status === "blocked") {
        const blockers = reportReconciliation.checks.filter((item) => item.status === "block").map((item) => item.label).join(", ");
        throw requestError(`Pre-publish reconciliation is blocked: ${blockers}. Reopen the report and resolve the data mismatch before publishing.`, 422);
      }

      const sourceVersion = Number(report.version || 1);
      const alreadyPublished = Boolean(
        report.activePublishedVersionId
        && Number(report.publishedSourceVersion || 0) === sourceVersion
        && report.publicationStatus === "published"
        && report.pdfIsStale !== true
      );
      if (alreadyPublished) return { idempotent: true, report };

      const claimedAt = claimDate(report.publicationClaim?.claimedAt);
      if (report.publicationClaim?.token && claimedAt && Date.now() - claimedAt.getTime() < PUBLISH_CLAIM_TTL_MS) {
        throw requestError("This Wealth Review is already being published. Wait a moment and refresh before trying again.", 409);
      }

      const nextPublishedVersion = Number(report.publishedVersion || 0) + 1;
      const versionId = getReportVersionId(reportId, nextPublishedVersion);
      const token = randomUUID();
      fallbackPublicationStatus = report.activePublishedVersionId ? "revision_ready" : (report.publicationStatus || "internal");
      transaction.set(reportRef, {
        publicationStatus: "publishing",
        reportReconciliation,
        publicationClaim: {
          token,
          sourceVersion,
          publishedVersion: nextPublishedVersion,
          versionId,
          claimedAt: new Date(),
          claimedByUid: actor.uid
        },
        updatedAt: new Date()
      }, { merge: true });
      return { idempotent: false, report, token, sourceVersion, nextPublishedVersion, versionId };
    });

    if (claim.idempotent) {
      const report = claim.report;
      return NextResponse.json({
        success: true,
        idempotent: true,
        publishedVersion: Number(report.publishedVersion || 0),
        versionId: report.activePublishedVersionId || null,
        pdfStoragePath: report.pdfStoragePath || null,
        pdfFileName: report.pdfFileName || null,
        pdfSizeBytes: report.pdfSizeBytes || null,
        emailStatus: "not_requested",
        emailError: null
      });
    }

    claimToken = claim.token;
    const report = claim.report;
    const nextPublishedVersion = claim.nextPublishedVersion;
    const versionId = claim.versionId;
    const versionRef = adminDb.collection("reportVersions").doc(versionId);
    const snapshotData = publishedSnapshotData(report, nextPublishedVersion, versionId);
    const pdf = await createAndUploadReportPdf(snapshotData, { reportId, publishedVersion: nextPublishedVersion, versionId });
    const versionData = {
      ...snapshotData,
      ...pdf,
      reportId,
      isActive: true,
      publishedByUid: actor.uid,
      publishedByName: actor.fullName || actor.email
    };

    // Confirm the publication claim is still ours before committing the final
    // immutable version and investor-visible state.
    const freshSnapshot = await reportRef.get();
    if (!freshSnapshot.exists || freshSnapshot.data()?.publicationClaim?.token !== claimToken) {
      throw requestError("The publication lock changed before the PDF could be committed. Refresh the report and try again.", 409);
    }

    const batch = adminDb.batch();
    if (report.activePublishedVersionId) {
      batch.set(adminDb.collection("reportVersions").doc(report.activePublishedVersionId), {
        isActive: false,
        supersededAt: new Date(),
        supersededByVersionId: versionId
      }, { merge: true });
    }
    batch.set(versionRef, versionData);
    batch.set(reportRef, {
      investorVisible: true,
      publicationStatus: "published",
      publicationClaim: FieldValue.delete(),
      activePublishedVersionId: versionId,
      publishedVersion: nextPublishedVersion,
      publishedSourceVersion: claim.sourceVersion,
      publishedAt: new Date(),
      publishedByUid: actor.uid,
      publishedByName: actor.fullName || actor.email,
      ...pdf,
      pdfIsStale: false,
      pdfInvalidatedAt: null,
      pdfInvalidationReason: null,
      lastPublishFailureReason: null,
      lastPublishFailedAt: null,
      updatedAt: new Date()
    }, { merge: true });

    if (report.investorPortalUid) {
      const notificationRef = adminDb.collection("notifications").doc();
      batch.set(notificationRef, {
        recipientUid: report.investorPortalUid,
        recipientType: "investor",
        title: nextPublishedVersion > 1
          ? `Updated ${getReportTypeLabel(report.reportType)} Available`
          : `${getReportTypeLabel(report.reportType)} Available`,
        message: `Your GrowVest report for ${report.title || report.reportMonthKey || "this month"} is ready.`,
        eventType: nextPublishedVersion > 1 ? "wealth_report_updated" : "wealth_report_published",
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
        title: `${getReportTypeLabel(report.reportType)} published`,
        message: `${report.investorName || "Investor"}'s ${getReportTypeLabel(report.reportType).toLowerCase()} version ${nextPublishedVersion} was published.`,
        eventType: "wealth_report_publish_confirmation",
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
      title: nextPublishedVersion > 1 ? `${getReportTypeLabel(report.reportType)} revision published` : `${getReportTypeLabel(report.reportType)} published`,
      description: `${report.title || getReportTypeLabel(report.reportType)} version ${nextPublishedVersion} was published by ${actor.fullName || actor.email}.`,
      metadata: { publishedVersion: nextPublishedVersion, versionId, pdfStoragePath: pdf.pdfStoragePath },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email,
      createdAt: new Date()
    });
    await batch.commit();
    claimToken = "";

    try {
      await publishLinkedActionVisibility({
        investorId: report.investorId,
        reportId,
        publishedVersion: nextPublishedVersion
      });
    } catch (actionError) {
      console.error("Wealth Review published but linked action visibility sync failed", actionError);
    }

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

    return NextResponse.json({
      success: true,
      idempotent: false,
      publishedVersion: nextPublishedVersion,
      versionId,
      ...pdf,
      emailStatus,
      emailError
    });
  } catch (error) {
    if (reportRef && claimToken) {
      await releasePublishClaim(reportRef, claimToken, fallbackPublicationStatus, error?.message || "Publication failed");
    }
    console.error("Report publication failed", error);
    return NextResponse.json(
      { error: error.message || "Unable to publish wealth review." },
      { status: appRequestErrorStatus(error, error?.statusCode || 500) }
    );
  }
}
