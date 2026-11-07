import { FieldValue } from "firebase-admin/firestore";
import { AppRequestError, adminDb, appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";
import { monthlyReportingWindow } from "@/lib/portfolioMonthlyClose";
import { resolveMonthEndSnapshot } from "@/lib/server/portfolioMonthEndSelection";
import { inspectMonthEndCaptureApproval, monthEndCaptureApprovalId } from "@/lib/server/portfolioMonthEndCaptureApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const value = (v) => String(v || "").trim();

async function preview(actor, investorId, monthKey, snapshotId) {
  if (!["admin", "super_admin"].includes(actor.role)) {
    throw new AppRequestError("Only an administrator may approve a next-month portfolio capture.", 403, "month_end_approval_forbidden");
  }
  if (!investorId || investorId.length > 200 || investorId.includes("/")) {
    throw new AppRequestError("A valid investor is required.", 400, "month_end_investor_invalid");
  }
  await getAccessibleInvestor(actor, investorId);
  const { cutoffDate } = monthlyReportingWindow(monthKey);
  if (cutoffDate >= indiaDateKey()) {
    throw new AppRequestError("Approve closing data only after the reporting month has ended.", 409, "month_end_not_closed");
  }
  const docs = await adminDb.collection("portfolioSnapshots").where("investorId", "==", investorId).get();
  const snapshots = docs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const selected = await resolveMonthEndSnapshot({ investorId, snapshots, cutoffDate });
  const candidate = selected.captureCandidate;
  if (!candidate || !selected.snapshot || selected.snapshot.reportSnapshotMode !== "post_cutoff_capture"
    || (snapshotId && selected.snapshot.id !== snapshotId)) {
    return {
      ready: false, investorId, monthKey, cutoffDate,
      blockers: [selected.captureIssue?.message || "No verified, source-complete next-month capture is currently eligible for this reporting cutoff. Check the NAV dates, transaction history and source coverage."],
      captureCandidate: candidate || null
    };
  }
  const record = snapshots.find((item) => item.id === selected.snapshot.id);
  const approval = await inspectMonthEndCaptureApproval({ investorId, cutoffDate, snapshot: record, positions: selected.positions });
  const positions = selected.positions || [];
  const sources = [...new Set(positions.map((item) => String(item.source || "unknown")))].map((source) => {
    const holdings = positions.filter((item) => String(item.source || "unknown") === source);
    return {
      source,
      holdingCount: holdings.length,
      navDates: [...new Set(holdings.map((item) => String(item.navDate || item.valuationDate || item.priceDate || "").slice(0, 10)))].sort(),
      closingValue: Number(holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0).toFixed(2))
    };
  });
  return {
    ready: true, investorId, monthKey, cutoffDate,
    snapshotId: record.id,
    capturedDate: candidate.capturedDate,
    effectiveDate: candidate.effectiveDate,
    approved: approval.approved,
    sourceFingerprint: approval.fingerprint,
    closingValue: Number(record.summary?.currentValue || 0),
    sources,
    blockers: [],
    // This preview verifies structure and later-month exclusion, not the
    // actual source-published NAV timetable or completeness of absent data.
    disclosures: [
      "Confirm each provider's last eligible NAV and all holdings through month-end.",
      "Confirm no transaction, withdrawal or internal switch after the cutoff was included in this captured portfolio.",
      "Older unchanged NAVs must retain their original price dates in the Monthly Wealth Review."
    ]
  };
}

async function handle(request, approve) {
  try {
    const actor = await verifyStaffRequest(request);
    const input = approve ? await request.json().catch(() => ({})) : Object.fromEntries(new URL(request.url).searchParams);
    const investorId = value(input.investorId);
    const monthKey = value(input.monthKey);
    const snapshotId = value(input.snapshotId);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
      throw new AppRequestError("Provide a valid reporting month (YYYY-MM).", 400, "month_end_invalid_month");
    }
    if (approve && (!snapshotId || value(input.confirm) !== "APPROVE VERIFIED MONTH END CAPTURE")) {
      throw new AppRequestError("Select the exact capture and acknowledge the NAV and source-coverage checks.", 400, "month_end_approval_confirmation_missing");
    }
    const assessment = await preview(actor, investorId, monthKey, snapshotId);
    if (!approve) return Response.json(assessment, { headers: { "Cache-Control": "private, no-store" } });
    if (!assessment.ready) throw new AppRequestError(assessment.blockers.join(" "), 409, "month_end_capture_not_eligible");
    if (assessment.approved) return Response.json({ ...assessment, alreadyApproved: true });

    const approvalRef = adminDb.collection("portfolioMonthEndCaptureApprovals")
      .doc(monthEndCaptureApprovalId(investorId, assessment.cutoffDate, snapshotId));
    // The capture's frozen content is fingerprinted in the read-only preview;
    // the report selector rechecks that fingerprint on every subsequent load.
    await adminDb.runTransaction(async (tx) => {
      const snapshotRef = adminDb.collection("portfolioSnapshots").doc(snapshotId);
      const live = await tx.get(snapshotRef);
      if (!live.exists || live.data()?.investorId !== investorId || live.data()?.verificationStatus !== "verified"
        || String(live.data()?.snapshotDate || "").slice(0, 10) !== assessment.capturedDate
        || Number(live.data()?.summary?.currentValue || 0) !== assessment.closingValue) {
        throw new AppRequestError("The captured portfolio changed during approval. Preview the reporting month again.", 409, "month_end_capture_changed");
      }
      tx.set(approvalRef, {
        status: "approved", investorId, cutoffDate: assessment.cutoffDate, monthKey,
        sourceSnapshotId: snapshotId,
        sourceSnapshotFingerprint: assessment.sourceFingerprint,
        effectiveValuationDate: assessment.effectiveDate,
        capturedSnapshotDate: assessment.capturedDate,
        approvedByUid: actor.uid,
        approvedAt: FieldValue.serverTimestamp(),
        approvalBasis: "last_eligible_nav_and_complete_source_confirmation",
        sources: assessment.sources
      }, { merge: true });
      const auditRef = adminDb.collection("portfolioHistoricalApprovalAudit")
        .doc(`${approvalRef.id}_approval`);
      tx.set(auditRef, {
        investorId, monthKey, cutoffDate: assessment.cutoffDate,
        snapshotId, sourceFingerprint: assessment.sourceFingerprint,
        sourceValue: assessment.closingValue, actorUid: actor.uid,
        checklist: "Confirmed cutoff, actual NAV dates, all portfolio sources, October cash/units, no November investments in closing",
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    return Response.json({ ...assessment, approved: true, approvalRecorded: true }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error?.code !== "month_end_capture_not_eligible") console.error("Month-end capture review failed", { code: error?.code || "unexpected", message: error?.message || "unknown" });
    return Response.json({ error: error?.message || "Unable to review this monthly closing capture.", code: error?.code || "month_end_capture_failed" }, { status: appRequestErrorStatus(error, 500) });
  }
}

export async function GET(request) { return handle(request, false); }
export async function POST(request) { return handle(request, true); }
