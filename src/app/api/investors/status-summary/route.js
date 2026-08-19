import { adminDb, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { buildInvestorStatusSummary } from "@/lib/investor/profileStatus";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const isAdmin = ["super_admin", "admin"].includes(actor.role);
    let investorQuery = adminDb.collection("investors").where("isDeleted", "==", false);
    if (!isAdmin) investorQuery = investorQuery.where("assignedAdvisorUid", "==", actor.uid);
    const investorsSnapshot = await investorQuery.limit(500).get();
    const investors = investorsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const ids = new Set(investors.map((item) => item.id));

    let documentsQuery = adminDb.collection("investorDocuments");
    if (!isAdmin) documentsQuery = documentsQuery.where("advisorUid", "==", actor.uid);
    const documentsSnapshot = await documentsQuery.limit(5000).get();
    const grouped = new Map();
    documentsSnapshot.docs.forEach((item) => {
      const data = { id: item.id, ...item.data() };
      if (!ids.has(data.investorId)) return;
      if (!grouped.has(data.investorId)) grouped.set(data.investorId, []);
      grouped.get(data.investorId).push(data);
    });

    return Response.json({
      summaries: Object.fromEntries(investors.map((investor) => [
        investor.id,
        buildInvestorStatusSummary(investor, grouped.get(investor.id) || [])
      ]))
    });
  } catch (error) {
    console.error("Investor status summary failed", error);
    return Response.json({ error: error?.message || "Unable to load investor status summaries." }, { status: appRequestErrorStatus(error, 500) });
  }
}
