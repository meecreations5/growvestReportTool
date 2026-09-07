import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  appRequestErrorStatus,
  canStaffAccessRecord,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function requestError(message, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function canonicalReportId(report = {}) {
  const investorId = String(report.investorId || "").trim();
  const monthKey = String(report.reportMonthKey || "").trim();
  return investorId && /^\d{4}-\d{2}$/.test(monthKey) ? `${investorId}_${monthKey}` : "";
}

function isPublished(report = {}) {
  return Boolean(
    report.investorVisible === true
      || report.activePublishedVersionId
      || Number(report.publishedVersion || 0) > 0
      || report.publicationStatus === "published"
  );
}

async function updateLinkedReportReferences(sourceReportId, targetReportId) {
  const [sourceActions, lastActions, deliveries, notifications, acknowledgements, downloads] = await Promise.all([
    adminDb.collection("investorActions").where("sourceReportId", "==", sourceReportId).get(),
    adminDb.collection("investorActions").where("lastReportId", "==", sourceReportId).get(),
    adminDb.collection("emailDeliveries").where("reportId", "==", sourceReportId).get(),
    adminDb.collection("notifications").where("reportId", "==", sourceReportId).get(),
    adminDb.collection("reportAcknowledgements").where("reportId", "==", sourceReportId).get(),
    adminDb.collection("reportDownloads").where("reportId", "==", sourceReportId).get()
  ]);

  const actionMap = new Map();
  [...sourceActions.docs, ...lastActions.docs].forEach((item) => actionMap.set(item.id, item));
  const operations = [];
  actionMap.forEach((item) => {
    const data = item.data() || {};
    operations.push({
      ref: item.ref,
      data: {
        sourceReportId: data.sourceReportId === sourceReportId ? targetReportId : (data.sourceReportId || ""),
        lastReportId: data.lastReportId === sourceReportId ? targetReportId : (data.lastReportId || ""),
        updatedAt: new Date()
      }
    });
  });
  [...deliveries.docs, ...notifications.docs, ...acknowledgements.docs, ...downloads.docs].forEach((item) => {
    operations.push({ ref: item.ref, data: { reportId: targetReportId, updatedAt: new Date() } });
  });

  for (let start = 0; start < operations.length; start += 400) {
    const batch = adminDb.batch();
    operations.slice(start, start + 400).forEach((operation) => batch.set(operation.ref, operation.data, { merge: true }));
    await batch.commit();
  }

  return {
    actions: actionMap.size,
    deliveries: deliveries.size,
    notifications: notifications.size,
    acknowledgements: acknowledgements.size,
    downloads: downloads.size
  };
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const requestedTargetId = String(body.targetReportId || "").trim();
    if (!requestedTargetId) throw requestError("The target report period is required.");
    if (requestedTargetId === reportId) {
      return NextResponse.json({ success: true, reportId, migrated: false, idempotent: true });
    }

    const sourceRef = adminDb.collection("monthlyReports").doc(reportId);
    const targetRef = adminDb.collection("monthlyReports").doc(requestedTargetId);
    let migratedReport = null;

    const result = await adminDb.runTransaction(async (transaction) => {
      const [sourceSnapshot, targetSnapshot] = await Promise.all([
        transaction.get(sourceRef),
        transaction.get(targetRef)
      ]);

      if (!sourceSnapshot.exists) {
        if (!targetSnapshot.exists) throw requestError("Monthly report was not found.", 404);
        const targetData = { id: targetSnapshot.id, ...targetSnapshot.data() };
        if (!canStaffAccessRecord(actor, targetData)) throw requestError("You are not authorised to move this report period.", 403);
        if (String(targetData.migratedFromReportId || "") === reportId) {
          migratedReport = targetData;
          return { idempotent: true };
        }
        throw requestError("The original report no longer exists and the target period belongs to another report.", 409);
      }

      const report = { id: sourceSnapshot.id, ...sourceSnapshot.data() };
      if (!canStaffAccessRecord(actor, report)) throw requestError("You are not authorised to move this report period.", 403);
      if (isPublished(report)) throw requestError("A published Monthly Report cannot be moved to another reporting month. Create a revision or unpublish through the controlled workflow instead.", 422);

      const expectedTargetId = canonicalReportId(report);
      if (!expectedTargetId || expectedTargetId !== requestedTargetId) {
        throw requestError("The requested report ID does not match the Investor and reporting month.", 409);
      }

      if (targetSnapshot.exists) {
        const targetData = { id: targetSnapshot.id, ...targetSnapshot.data() };
        if (String(targetData.migratedFromReportId || "") !== reportId) {
          throw requestError("A Monthly Report already exists for this Investor and reporting month.", 409);
        }
        transaction.delete(sourceRef);
        migratedReport = targetData;
        return { idempotent: true };
      }

      const investorRef = report.investorId ? adminDb.collection("investors").doc(report.investorId) : null;
      const investorSnapshot = investorRef ? await transaction.get(investorRef) : null;
      const now = new Date();
      const generatedReportCode = `GV-RPT-${Number(report.reportYear || 0)}-${String(Number(report.reportMonth || 0)).padStart(2, "0")}-${report.clientCode || requestedTargetId.slice(-8)}`;
      const targetData = {
        ...sourceSnapshot.data(),
        reportCode: generatedReportCode,
        migratedFromReportId: reportId,
        reportPeriodMigratedAt: now,
        reportPeriodMigratedByUid: actor.uid,
        reportPeriodMigratedByName: actor.fullName || actor.email || "GrowVest User",
        updatedAt: now
      };
      transaction.set(targetRef, targetData);
      transaction.delete(sourceRef);

      if (investorRef && investorSnapshot?.exists && investorSnapshot.data()?.latestReportId === reportId) {
        transaction.set(investorRef, {
          latestReportId: requestedTargetId,
          latestReportMonthKey: report.reportMonthKey || null,
          updatedAt: now
        }, { merge: true });
      }

      migratedReport = { id: requestedTargetId, ...targetData };
      return { idempotent: false };
    });

    const linked = await updateLinkedReportReferences(reportId, requestedTargetId);
    await adminDb.collection("activityLogs").add({
      recordType: "monthly_report",
      recordId: requestedTargetId,
      reportId: requestedTargetId,
      previousReportId: reportId,
      investorId: migratedReport?.investorId || null,
      advisorUid: migratedReport?.advisorUid || migratedReport?.assignedAdvisorUid || actor.uid,
      action: "monthly_report_period_migrated",
      title: "Monthly report period updated",
      description: `Draft Monthly Report was moved from ${reportId} to ${requestedTargetId} after its reporting month changed.`,
      metadata: { sourceReportId: reportId, targetReportId: requestedTargetId, linked },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      reportId: requestedTargetId,
      migrated: true,
      idempotent: Boolean(result?.idempotent),
      linked
    });
  } catch (error) {
    console.error("Monthly report period migration failed", error);
    return NextResponse.json(
      { error: error?.message || "Unable to update Monthly Report period." },
      { status: appRequestErrorStatus(error, error?.statusCode || 500) }
    );
  }
}
