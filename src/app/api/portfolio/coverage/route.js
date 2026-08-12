import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { buildDailyPortfolioCoverage } from "@/lib/server/portfolioCoverage";
import { getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";
import { PORTFOLIO_SOURCES } from "@/lib/constants/portfolio";

export const runtime = "nodejs";

function safeDateKey(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : indiaDateKey();
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { searchParams } = new URL(request.url);
    const dateKey = safeDateKey(searchParams.get("date"));
    const coverage = await buildDailyPortfolioCoverage(actor, { dateKey });
    return Response.json(coverage);
  } catch (error) {
    console.error("Portfolio coverage load failed", error);
    return Response.json({ error: error?.message || "Unable to load daily portfolio coverage." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "Only Admin or Super Admin can change daily portfolio tracking." }, { status: 403 });
    }
    const payload = await request.json();
    const investorId = String(payload?.investorId || "").trim();
    const enabled = payload?.enabled !== false;
    if (!investorId) return Response.json({ error: "Investor is required." }, { status: 400 });

    const investor = await getAccessibleInvestor(actor, investorId);
    const mappingSnapshot = await adminDb.collection("externalInvestorMappings")
      .where("investorId", "==", investorId)
      .get();
    const mappings = mappingSnapshot.docs.filter((item) => item.data()?.source === PORTFOLIO_SOURCES.FUNDBAZAAR);
    if (!mappings.length) return Response.json({ error: "No verified Fundbazaar mapping exists for this investor." }, { status: 404 });

    const writer = adminDb.bulkWriter();
    mappings.forEach((item) => {
      writer.set(item.ref, {
        coverageEnabled: enabled,
        coverageUpdatedAt: FieldValue.serverTimestamp(),
        coverageUpdatedByUid: actor.uid
      }, { merge: true });
    });
    writer.set(adminDb.collection("investors").doc(investorId), {
      fundbazaarDailyTrackingEnabled: enabled,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await writer.close();

    await adminDb.collection("activityLogs").add({
      recordType: "investor",
      recordId: investorId,
      investorId,
      clientCode: investor.clientCode || "",
      leadName: investor.fullName || "Investor",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      action: enabled ? "portfolio_daily_tracking_enabled" : "portfolio_daily_tracking_paused",
      title: enabled ? "Daily portfolio tracking enabled" : "Daily portfolio tracking paused",
      description: `Fundbazaar daily portfolio coverage tracking was ${enabled ? "enabled" : "paused"} for ${investor.fullName || "the investor"}.`,
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: FieldValue.serverTimestamp()
    });

    return Response.json({ investorId, enabled });
  } catch (error) {
    console.error("Portfolio coverage tracking update failed", error);
    return Response.json({ error: error?.message || "Unable to update daily portfolio tracking." }, { status: 500 });
  }
}
