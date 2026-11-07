import { FieldPath } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { inspectStoredMonthlySourceCoverage } from "@/lib/server/portfolioReportCashFlowCoverage";
import { assessInvestorMonthEnd, portfolioMonthCutoff } from "@/lib/portfolioSystemWideAudit";
import { resolveMonthEndSnapshot } from "@/lib/server/portfolioMonthEndSelection";
import { inspectFrozenSourceSet } from "@/lib/portfolioMonthlyIntegrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCursor(value) {
  const cursor = String(value || "").trim();
  if (cursor.length > 200 || cursor.includes("/")) throw new Error("Invalid pagination cursor.");
  return cursor;
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["admin", "super_admin"].includes(actor.role)) {
      return Response.json({ error: "System-wide portfolio audit is restricted to administrators." }, { status: 403 });
    }
    const url = new URL(request.url);
    const monthKey = String(url.searchParams.get("month") || "").trim();
    let cutoffDate;
    try { cutoffDate = portfolioMonthCutoff(monthKey); } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (cutoffDate >= today) return Response.json({ error: "The reporting month must end before its month-end coverage can be audited." }, { status: 400 });
    const cursor = safeCursor(url.searchParams.get("cursor"));
    const size = Math.min(15, Math.max(1, Number(url.searchParams.get("limit")) || 8));
    let query = adminDb.collection("investors").orderBy(FieldPath.documentId()).limit(size);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    const active = page.docs.filter((item) => item.data()?.isDeleted !== true && item.data()?.lifecycleStatus !== "deleted");
    const rows = [];
    // Limit in-flight per-investor reads, especially for large client books.
    for (let index = 0; index < active.length; index += 4) {
      const slice = active.slice(index, index + 4);
      const group = await Promise.all(slice.map(async (item) => {
        const investorId = item.id;
        const investor = item.data();
        const [snapshotDocs, valuationDocs] = await Promise.all([
          adminDb.collection("portfolioSnapshots").where("investorId", "==", investorId).get(),
          adminDb.collection("portfolioDatedValuations").where("investorId", "==", investorId).get()
        ]);
        const snapshots = snapshotDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const valuations = valuationDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const selection = await resolveMonthEndSnapshot({ investorId, snapshots, cutoffDate });
        const closing = selection.snapshot;
        const positionDocs = closing && !selection.positions
          ? await adminDb.collection("portfolioSnapshotPositions").where("snapshotId", "==", closing.id).get()
          : null;
        const snapshotPositions = selection.positions || positionDocs?.docs.map((doc) => ({ id: doc.id, ...doc.data() })) || [];
        const sourceCoverage = closing ? await inspectStoredMonthlySourceCoverage({
          investorId, snapshot: closing, cutoffDate, positions: snapshotPositions
        }) : null;
        const uncovered = sourceCoverage?.postValuationCash || null;
        const laterInvestmentActivity = sourceCoverage?.postValuationActivity || null;
        const assessment = assessInvestorMonthEnd({
          monthKey, snapshots, valuations,
          snapshotPositions,
          uncoveredCashFlows: uncovered, laterInvestmentActivity,
          closingOverride: closing, captureIssue: selection.captureIssue,
          sourceSet: closing ? inspectFrozenSourceSet({ snapshot: closing, positions: snapshotPositions, archives: valuations, cutoffDate }) : null
        });
        return { captureCandidate: selection.captureCandidate || null, investorId, investorName: String(investor.fullName || investor.name || "Investor"), clientCode: String(investor.clientCode || ""), ...assessment };
      }));
      rows.push(...group);
    }
    const nextCursor = page.size === size ? page.docs.at(-1)?.id || "" : "";
    return Response.json({ monthKey, cutoffDate, rows, scannedCount: page.size, nextCursor }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("System-wide portfolio audit failed", { message: error?.message || "audit_failed" });
    return Response.json({ error: error?.message || "Unable to audit portfolio history." }, { status: appRequestErrorStatus(error, 500) });
  }
}
