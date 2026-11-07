import { adminDb, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { getAccessibleInvestor } from "@/lib/server/portfolioServer";
import { archiveImportedFundbazaarValuation } from "@/lib/server/portfolioDatedValuationStore";

export const runtime = "nodejs";

function asItems(snapshot) { return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })); }
function plainArchive(item) {
  return {
    id: item.id,
    source: item.source,
    sourceFileName: item.sourceFileName || "",
    sourceImportFileId: item.sourceImportFileId || "",
    valuationDate: item.valuationDate || "",
    earliestNavDate: item.earliestNavDate || "",
    latestNavDate: item.latestNavDate || "",
    uniformNavDate: item.uniformNavDate === true,
    historyReady: item.historyReady === true,
    status: item.status || "",
    verificationStatus: item.verificationStatus || "pending_review",
    monthlyReportEligible: item.monthlyReportEligible === true,
    approvedMonthKey: item.approvedMonthKey || "",
    reportSnapshotId: item.reportSnapshotId || "",
    summary: item.summary || {}
  };
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { searchParams } = new URL(request.url);
    const investorId = String(searchParams.get("investorId") || "").trim();
    const valuationId = String(searchParams.get("valuationId") || "").trim();
    if (!investorId) return Response.json({ error: "Investor ID is required." }, { status: 400 });
    await getAccessibleInvestor(actor, investorId);
    if (valuationId) {
      const snap = await adminDb.collection("portfolioDatedValuations").doc(valuationId).get();
      if (!snap.exists || snap.data()?.investorId !== investorId || snap.data()?.status !== "available") {
        return Response.json({ error: "Dated valuation was not found for this investor." }, { status: 404 });
      }
      const [holdings, transactions] = await Promise.all([
        adminDb.collection("portfolioDatedValuationHoldings").where("valuationId", "==", valuationId).get(),
        adminDb.collection("portfolioDatedValuationTransactions").where("valuationId", "==", valuationId).get()
      ]);
      return Response.json({
        valuation: plainArchive({ id: snap.id, ...snap.data() }),
        holdings: asItems(holdings),
        transactions: asItems(transactions)
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const snapshot = await adminDb.collection("portfolioDatedValuations").where("investorId", "==", investorId).get();
    const valuations = asItems(snapshot)
      .filter((item) => item.status === "available")
      .sort((a, b) => String(b.valuationDate || "").localeCompare(String(a.valuationDate || "")))
      .slice(0, 180).map(plainArchive);
    return Response.json({ investorId, valuations }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Dated valuation lookup failed", { message: error?.message || "lookup_failed" });
    return Response.json({ error: error?.message || "Unable to load dated valuation history." }, { status: appRequestErrorStatus(error, 500) });
  }
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { fileId } = await request.json();
    const safeFileId = String(fileId || "").trim();
    if (!safeFileId || safeFileId.length > 200 || safeFileId.includes("/")) {
      return Response.json({ error: "An imported Fundbazaar file ID is required." }, { status: 400 });
    }
    const snapshot = await adminDb.collection("portfolioImportFiles").doc(safeFileId).get();
    if (!snapshot.exists || snapshot.data()?.status !== "imported") {
      return Response.json({ error: "The completed source import was not found." }, { status: 404 });
    }
    const file = { id: snapshot.id, ...snapshot.data() };
    const investorId = String(file.matchedInvestorId || "").trim();
    await getAccessibleInvestor(actor, investorId);
    const result = await archiveImportedFundbazaarValuation({ file, investorId, actor });
    return Response.json({ archive: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Dated Fundbazaar valuation archive failed", { message: error?.message || "archive_failed" });
    return Response.json({ error: error?.message || "Unable to archive Fundbazaar valuation." }, { status: appRequestErrorStatus(error, 500) });
  }
}
