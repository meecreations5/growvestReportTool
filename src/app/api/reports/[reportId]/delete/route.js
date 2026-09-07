import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminBucket,
  adminDb,
  appRequestErrorStatus,
  canStaffAccessRecord,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";
import {
  ACCESS_LEVELS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveEffectivePermissions
} from "@/lib/constants/permissions";

export const runtime = "nodejs";

function actorName(actor = {}) {
  return actor.fullName || actor.displayName || actor.email || "GrowVest User";
}

function isPublishedReport(report = {}) {
  return Boolean(
    report.investorVisible === true
    || report.publicationStatus === "published"
    || report.activePublishedVersionId
    || Number(report.publishedVersion || 0) > 0
  );
}

async function reportPermissionLevel(actor) {
  const settings = await adminDb.collection("reportSettings").doc("global").get();
  const rolePermissions = settings.exists
    ? settings.data()?.accessControl?.rolePermissions || DEFAULT_ROLE_PERMISSIONS
    : DEFAULT_ROLE_PERMISSIONS;
  const effective = resolveEffectivePermissions(actor.role, rolePermissions, actor.permissionOverrides || {});
  return effective.reports || ACCESS_LEVELS.NONE;
}

async function assertDeletePermission(actor, report) {
  if (["super_admin", "admin"].includes(actor.role)) return;
  if (actor.role !== "advisor" || !canStaffAccessRecord(actor, report)) {
    const error = new Error("You are not authorised to delete this Monthly Report.");
    error.statusCode = 403;
    throw error;
  }
  const level = await reportPermissionLevel(actor);
  const allowed = isPublishedReport(report)
    ? level === ACCESS_LEVELS.FULL
    : [ACCESS_LEVELS.FULL, ACCESS_LEVELS.MANAGE].includes(level);
  if (!allowed) {
    const error = new Error(
      isPublishedReport(report)
        ? "Published report deletion requires Full Monthly Reports permission."
        : "Report deletion requires Manage or Full Monthly Reports permission."
    );
    error.statusCode = 403;
    throw error;
  }
}

async function getByReportId(collectionName, reportId) {
  return adminDb.collection(collectionName).where("reportId", "==", reportId).get();
}

async function commitOperations(operations = []) {
  for (let start = 0; start < operations.length; start += 400) {
    const batch = adminDb.batch();
    operations.slice(start, start + 400).forEach((operation) => {
      if (operation.type === "delete") batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data, { merge: true });
    });
    await batch.commit();
  }
}

async function linkedActions(reportId) {
  const [source, last] = await Promise.all([
    adminDb.collection("investorActions").where("sourceReportId", "==", reportId).get(),
    adminDb.collection("investorActions").where("lastReportId", "==", reportId).get()
  ]);
  const unique = new Map();
  [...source.docs, ...last.docs].forEach((item) => unique.set(item.id, item));
  return [...unique.values()];
}

async function nextLatestReport(investorId, deletedReportId) {
  if (!investorId) return null;
  const snapshot = await adminDb.collection("monthlyReports")
    .where("investorId", "==", investorId)
    .limit(250)
    .get();
  return snapshot.docs
    .filter((item) => item.id !== deletedReportId)
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => {
      const monthCompare = String(b.reportMonthKey || "").localeCompare(String(a.reportMonthKey || ""));
      if (monthCompare) return monthCompare;
      return Number(b.version || 0) - Number(a.version || 0);
    })[0] || null;
}

function storageManifest(report, versionDocs = []) {
  const investorPart = String(report.investorId || "investor").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const reportPart = String(report.id || "report").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const prefix = `monthly-reports/${investorPart}/${reportPart}/`;
  const extraPaths = [...new Set([
    report.pdfStoragePath,
    ...versionDocs.map((item) => item.data()?.pdfStoragePath)
  ].filter((item) => item && !String(item).startsWith(prefix)).map(String))];
  return { prefix, extraPaths };
}

async function cleanupStorage(manifest = {}) {
  if (manifest.prefix) await adminBucket.deleteFiles({ prefix: manifest.prefix });
  await Promise.all((manifest.extraPaths || []).map(async (storagePath) => {
    try {
      await adminBucket.file(storagePath).delete({ ignoreNotFound: true });
    } catch (error) {
      if (Number(error?.code || 0) !== 404) throw error;
    }
  }));
}

async function retryPendingStorageCleanup(actor, reportId, jobSnapshot) {
  const job = { id: jobSnapshot.id, ...jobSnapshot.data() };
  await assertDeletePermission(actor, job);
  if (job.status === "completed") {
    return NextResponse.json({ success: true, reportId, alreadyDeleted: true, storageCleanup: "completed" });
  }
  if (job.status !== "storage_cleanup_pending") {
    return NextResponse.json({ error: "Monthly report was not found." }, { status: 404 });
  }
  try {
    await cleanupStorage(job.storageManifest || {});
    await jobSnapshot.ref.set({
      status: "completed",
      storageCleanupStatus: "completed",
      storageCleanupCompletedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    return NextResponse.json({ success: true, reportId, alreadyDeleted: true, storageCleanup: "completed" });
  } catch (error) {
    await jobSnapshot.ref.set({
      lastStorageCleanupError: String(error?.message || error).slice(0, 1200),
      lastStorageCleanupAttemptAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    return NextResponse.json({
      success: true,
      reportId,
      alreadyDeleted: true,
      storageCleanup: "pending",
      message: "The report is deleted from GrowVest. Secure file cleanup is pending and can be retried safely."
    });
  }
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await params;
    const payload = await request.json().catch(() => ({}));
    const reason = String(payload.reason || "").trim().slice(0, 1200);
    const confirmation = String(payload.confirmation || "").trim().toUpperCase();
    if (reason.length < 5) return NextResponse.json({ error: "Enter a reason for deleting this report." }, { status: 422 });
    if (confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm report deletion." }, { status: 422 });

    const reportRef = adminDb.collection("monthlyReports").doc(reportId);
    const deletionJobRef = adminDb.collection("reportDeletionJobs").doc(reportId);
    const [reportSnapshot, deletionJobSnapshot] = await Promise.all([reportRef.get(), deletionJobRef.get()]);

    if (!reportSnapshot.exists) {
      if (deletionJobSnapshot.exists) return retryPendingStorageCleanup(actor, reportId, deletionJobSnapshot);
      return NextResponse.json({ error: "Monthly report was not found." }, { status: 404 });
    }

    const report = { id: reportSnapshot.id, ...reportSnapshot.data() };
    await assertDeletePermission(actor, report);

    const [versions, acknowledgements, downloads, notifications, deliveries, actions, replacementReport] = await Promise.all([
      getByReportId("reportVersions", reportId),
      getByReportId("reportAcknowledgements", reportId),
      getByReportId("reportDownloads", reportId),
      getByReportId("notifications", reportId),
      getByReportId("emailDeliveries", reportId),
      linkedActions(reportId),
      nextLatestReport(report.investorId, reportId)
    ]);

    const now = new Date();
    const manifest = storageManifest(report, versions.docs);
    await deletionJobRef.set({
      reportId,
      investorId: report.investorId || null,
      investorName: report.investorName || "",
      advisorUid: report.advisorUid || report.assignedAdvisorUid || null,
      investorVisible: Boolean(report.investorVisible),
      publicationStatus: report.publicationStatus || "",
      activePublishedVersionId: report.activePublishedVersionId || null,
      publishedVersion: Number(report.publishedVersion || 0),
      reportCode: report.reportCode || "",
      reportMonthKey: report.reportMonthKey || "",
      status: "deleting",
      storageCleanupStatus: "pending",
      storageManifest: manifest,
      reason,
      requestedByUid: actor.uid,
      requestedByName: actorName(actor),
      startedAt: deletionJobSnapshot.exists ? (deletionJobSnapshot.data()?.startedAt || now) : now,
      updatedAt: now
    }, { merge: true });

    const operations = [];
    [...versions.docs, ...acknowledgements.docs, ...downloads.docs, ...notifications.docs]
      .forEach((item) => operations.push({ type: "delete", ref: item.ref }));

    deliveries.docs.forEach((item) => operations.push({
      type: "set",
      ref: item.ref,
      data: {
        status: ["scheduled", "queued"].includes(item.data()?.status) ? "cancelled_report_deleted" : item.data()?.status,
        reportDeletedAt: now,
        reportDeletedByUid: actor.uid,
        reportDeletedByName: actorName(actor),
        reportDeletedReason: reason,
        updatedAt: now
      }
    }));

    actions.forEach((item) => operations.push({
      type: "set",
      ref: item.ref,
      data: {
        sourceReportId: item.data().sourceReportId === reportId ? "" : item.data().sourceReportId || "",
        sourceReportMonthKey: item.data().sourceReportId === reportId ? "" : item.data().sourceReportMonthKey || "",
        lastReportId: item.data().lastReportId === reportId ? "" : item.data().lastReportId || "",
        deletedSourceReportId: reportId,
        deletedSourceReportAt: now,
        updatedAt: now
      }
    }));

    // The live report is deleted last. If an earlier batch fails, retrying this
    // endpoint safely continues cleanup while the report remains authoritative.
    operations.push({ type: "delete", ref: reportRef });
    await commitOperations(operations);

    if (report.investorId) {
      const investorRef = adminDb.collection("investors").doc(report.investorId);
      const investorSnapshot = await investorRef.get();
      if (investorSnapshot.exists && investorSnapshot.data()?.latestReportId === reportId) {
        await investorRef.set({
          latestReportId: replacementReport?.id || null,
          latestReportMonthKey: replacementReport?.reportMonthKey || null,
          latestReportStatus: replacementReport?.status || null,
          latestReportedCorpus: replacementReport ? Number(replacementReport.summary?.totalCorpus || 0) : null,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    // Audit persistence must never resurrect or invalidate an already deleted
    // report, so it is best-effort after the controlled Firestore cleanup.
    try {
      await adminDb.collection("activityLogs").add({
        recordType: "monthly_report",
        recordId: reportId,
        reportId,
        reportCode: report.reportCode || "",
        reportMonthKey: report.reportMonthKey || "",
        investorId: report.investorId || null,
        investorName: report.investorName || "",
        advisorUid: report.advisorUid || report.assignedAdvisorUid || actor.uid,
        action: "monthly_report_deleted",
        title: "Monthly report deleted",
        description: `${report.title || report.reportMonthKey || "Monthly report"} was deleted by ${actorName(actor)}. Portfolio Master, Bucket Lists and Investor Actions were preserved.`,
        metadata: {
          reason,
          wasPublished: isPublishedReport(report),
          deletedVersionCount: versions.size,
          deletedAcknowledgementCount: acknowledgements.size,
          deletedDownloadCount: downloads.size,
          removedNotificationCount: notifications.size,
          preservedDeliveryCount: deliveries.size,
          detachedActionCount: actions.length
        },
        createdByUid: actor.uid,
        createdByName: actorName(actor),
        createdAt: FieldValue.serverTimestamp()
      });
    } catch (auditError) {
      console.error("Monthly report deletion audit log failed", auditError);
    }

    let storageCleanup = "completed";
    let storageCleanupError = "";
    try {
      await cleanupStorage(manifest);
    } catch (error) {
      storageCleanup = "pending";
      storageCleanupError = String(error?.message || error).slice(0, 1200);
    }

    await deletionJobRef.set({
      status: storageCleanup === "completed" ? "completed" : "storage_cleanup_pending",
      storageCleanupStatus: storageCleanup,
      lastStorageCleanupError: storageCleanupError || null,
      firestoreCleanupCompletedAt: now,
      storageCleanupCompletedAt: storageCleanup === "completed" ? new Date() : null,
      completedAt: storageCleanup === "completed" ? new Date() : null,
      updatedAt: new Date()
    }, { merge: true });

    return NextResponse.json({
      success: true,
      reportId,
      reportMonthKey: report.reportMonthKey || "",
      investorId: report.investorId || null,
      storageCleanup,
      message: storageCleanup === "pending"
        ? "The report is deleted from GrowVest. Secure file cleanup is pending and can be retried safely."
        : "Monthly Report deleted successfully.",
      deleted: {
        report: 1,
        versions: versions.size,
        acknowledgements: acknowledgements.size,
        downloads: downloads.size,
        notifications: notifications.size
      },
      preserved: {
        portfolio: true,
        bucketLists: true,
        investorActions: actions.length,
        emailDeliveryHistory: deliveries.size
      }
    });
  } catch (error) {
    console.error("Monthly report deletion failed", error);
    return NextResponse.json(
      { error: error?.message || "Unable to delete Monthly Report." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
