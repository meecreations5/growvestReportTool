import { FieldValue } from "firebase-admin/firestore";
import { AppRequestError, adminDb, appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { createPortfolioSnapshot, getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

/**
 * Safe repair after a provider import updated live holdings but its derived
 * portfolioSnapshots write failed. Creates a CURRENT-DAY snapshot only. It is
 * not a historical backfill and can never be used to fake an earlier NAV.
 */
export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      throw new AppRequestError("Only administrators can rebuild a verified portfolio snapshot.", 403, "snapshot_rebuild_forbidden");
    }
    const body = await request.json().catch(() => ({}));
    const investorId = String(body.investorId || "").trim();
    if (!investorId) throw new AppRequestError("Investor is required.", 400, "investor_required");
    await getAccessibleInvestor(actor, investorId);
    const activePositions = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
    const activeCount = activePositions.docs.filter((item) => !["exited", "inactive"].includes(String(item.data()?.status || "").toLowerCase())).length;
    if (!activeCount) throw new AppRequestError("No active portfolio positions are available to create a snapshot.", 409, "no_active_positions");
    const snapshotDate = indiaDateKey();
    const snapshot = await createPortfolioSnapshot(investorId, actor, { snapshotDate, verificationStatus: "verified" });
    let auditWarning = "";
    await adminDb.collection("portfolioSnapshotRebuildAudit").add({
      investorId,
      snapshotId: snapshot.id,
      snapshotDate,
      value: Number(snapshot.summary?.currentValue || 0),
      activePositionCount: activeCount,
      mode: "current_day_rebuild_not_historical",
      actorUid: actor.uid,
      createdAt: FieldValue.serverTimestamp()
    }).catch((error) => { auditWarning = "Snapshot rebuilt, but the additional audit entry could not be saved."; console.error("Snapshot rebuild audit failed", error); });
    return Response.json({ success: true, snapshotId: snapshot.id, snapshotDate, currentValue: Number(snapshot.summary?.currentValue || 0), ...(auditWarning ? { warning: auditWarning } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Current portfolio snapshot rebuild failed", { error: error?.message || "unknown" });
    return Response.json({ error: error?.message || "Unable to rebuild the current portfolio snapshot." }, { status: appRequestErrorStatus(error, 500) });
  }
}
