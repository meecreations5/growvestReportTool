import { adminDb } from "@/lib/server/firebaseAdmin";
import { selectVerifiedMonthEndClosingSnapshot } from "@/lib/portfolioSnapshotSelection";
import { addCalendarDays, inspectPostCutoffCapture } from "@/lib/portfolioMonthlyClose";
import { loadInvestorPortfolioLedger } from "@/lib/server/portfolioHistoricalManualLedger";
import { inspectMonthEndCaptureApproval } from "@/lib/server/portfolioMonthEndCaptureApproval";

const rows = (docs) => docs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

/**
 * Shared by the staff monthly report and the all-investor readiness scan.
 * Never alters live holdings, historical snapshots or approved reports.
 */
export async function resolveMonthEndSnapshot({ investorId, snapshots = [], cutoffDate }) {
  const ordinary = selectVerifiedMonthEndClosingSnapshot(snapshots, cutoffDate);
  let selected = ordinary;
  let selectedPositions = null;
  let candidateIssue = null;
  let captureCandidate = null;
  const endOfGrace = addCalendarDays(cutoffDate, 7);
  const candidates = snapshots
    .filter((item) => item.verificationStatus === "verified" && String(item.snapshotDate || "") > cutoffDate && String(item.snapshotDate || "") <= endOfGrace)
    .sort((a, b) => String(b.snapshotDate || "").localeCompare(String(a.snapshotDate || "")));

  if (!candidates.length) return { snapshot: selected, positions: selectedPositions, captureIssue: null, captureCandidate: null };

  // Only request transaction/ledger records when a post-cutoff candidate exists.
  const ledger = await loadInvestorPortfolioLedger(investorId);
  const activity = [
    ...ledger.transactions,
    ...ledger.manualCash.filter((item) => Math.abs(Number(item.amount ?? item.signedAmount ?? 0)) > 0),
    ...ledger.investorActions.filter((item) => item.financialImpactStatus === "confirmed" && item.financialConfirmationMode === "manual_cash_movement"),
    ...ledger.manualCorporateActions,
    ...ledger.manualIncome,
    ...ledger.manualCharges
  ];
  for (const candidate of candidates) {
    const positions = rows(await adminDb.collection("portfolioSnapshotPositions").where("snapshotId", "==", candidate.id).get());
    const approval = inspectPostCutoffCapture({ snapshot: candidate, positions, cutoffDate, postCutoffActivity: activity });
    if (!approval.eligible) {
      candidateIssue ||= { captureDate: approval.capturedDate, message: approval.errors.join(" ") };
      continue;
    }
    if (selected && approval.effectiveDate <= String(selected.snapshotDate || "")) continue;
    const signoff = await inspectMonthEndCaptureApproval({ investorId, cutoffDate, snapshot: candidate, positions });
    captureCandidate = {
      id: candidate.id, capturedDate: approval.capturedDate, effectiveDate: approval.effectiveDate,
      approved: signoff.approved, positionCount: positions.length,
      needsReview: !signoff.approved, valuationDates: approval.valuationDates
    };
    selected = {
      ...candidate,
      snapshotDate: approval.effectiveDate,
      capturedSnapshotDate: approval.capturedDate,
      reportSnapshotMode: "post_cutoff_capture",
      reportCutoffDate: cutoffDate,
      requiresMonthEndApproval: !signoff.approved,
      monthEndApprovalStatus: signoff.approved ? "approved" : "pending_review"
    };
    selectedPositions = positions;
    break;
  }
  return { snapshot: selected, positions: selectedPositions, captureIssue: candidateIssue, captureCandidate };
}
