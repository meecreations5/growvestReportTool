import { createHash } from "node:crypto";
import { adminDb } from "@/lib/server/firebaseAdmin";

function value(value) { return value === undefined || value === null ? "" : value; }

/**
 * Administrative approval of a physical capture from the following month is
 * specific to a single investor, reporting cutoff, revision and frozen set of
 * positions. It is never a blanket approval for a date or for future reports.
 */
export function monthEndCaptureApprovalId(investorId, cutoffDate, snapshotId) {
  return `meca_${createHash("sha256").update(JSON.stringify([investorId, cutoffDate, snapshotId])).digest("hex").slice(0, 45)}`;
}

export function monthEndCaptureFingerprint(snapshot = {}, positions = []) {
  const normalizedPositions = positions.map((position) => ({
    id: value(position.id || position.positionId),
    source: value(position.source), instrument: value(position.instrumentName || position.schemeName),
    navDate: value(position.navDate || position.valuationDate || position.priceDate),
    manualImportDate: value(position.manualSourceRefreshDate || position.manualImportDate),
    units: Number(position.totalUnits ?? position.quantity ?? 0),
    currentValue: Number(position.currentValue || 0),
    totalInvested: Number(position.totalInvested ?? position.investedAmount ?? 0)
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify({
    snapshotId: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    version: Number(snapshot.snapshotVersion || 0),
    totalValue: Number(snapshot.summary?.currentValue || 0),
    positionCount: Number(snapshot.summary?.positionCount || 0),
    positions: normalizedPositions
  })).digest("hex");
}

export async function inspectMonthEndCaptureApproval({ investorId, cutoffDate, snapshot, positions }) {
  const ref = adminDb.collection("portfolioMonthEndCaptureApprovals")
    .doc(monthEndCaptureApprovalId(investorId, cutoffDate, snapshot.id));
  const doc = await ref.get();
  const record = doc.exists ? doc.data() : null;
  const fingerprint = monthEndCaptureFingerprint(snapshot, positions);
  const approved = Boolean(record?.status === "approved"
    && record.investorId === investorId
    && record.cutoffDate === cutoffDate
    && record.sourceSnapshotId === snapshot.id
    && record.sourceSnapshotFingerprint === fingerprint);
  return { ref, record, fingerprint, approved };
}
