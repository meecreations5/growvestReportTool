import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  canStaffAccessRecord,
  verifyAppRequest
} from "@/lib/server/firebaseAdmin";
import { normalisePortfolioGoalAllocations, portfolioAllocationStatus } from "@/lib/portfolioGoalAllocation";

export const runtime = "nodejs";

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function dateSortValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  }
  return value;
}

function actorCanAccessInvestor(actor, investor) {
  if (actor.role === "investor") {
    return actor.portalEnabled !== false && Boolean(actor.investorId) && String(actor.investorId) === String(investor.id);
  }
  if (["super_admin", "admin", "advisor"].includes(actor.role)) {
    return canStaffAccessRecord(actor, investor);
  }
  return false;
}

function publicInvestor(investor = {}) {
  return {
    id: investor.id,
    fullName: investor.fullName || investor.name || "Investor",
    name: investor.name || investor.fullName || "Investor",
    clientCode: investor.clientCode || "",
    bucketList: Array.isArray(investor.bucketList) ? investor.bucketList : [],
    goals: Array.isArray(investor.goals) ? investor.goals : [],
    assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    advisorUid: investor.advisorUid || investor.assignedAdvisorUid || "",
    investorPortalUid: investor.investorPortalUid || investor.portalUid || "",
    portalUid: investor.portalUid || investor.investorPortalUid || "",
    latestPortfolioSnapshotId: investor.latestPortfolioSnapshotId || "",
    latestPortfolioSnapshotDate: investor.latestPortfolioSnapshotDate || "",
    latestPortfolioValue: Number(investor.latestPortfolioValue || 0),
    latestPortfolioInvested: Number(investor.latestPortfolioInvested || 0),
    latestPortfolioGainLoss: Number(investor.latestPortfolioGainLoss || 0),
    latestPortfolioMonthlySip: Number(investor.latestPortfolioMonthlySip || 0),
    latestPortfolioReconciliationStatus: investor.latestPortfolioReconciliationStatus || ""
  };
}

async function byInvestor(collectionName, investorId) {
  const snapshot = await adminDb.collection(collectionName).where("investorId", "==", investorId).get();
  return rows(snapshot);
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const { searchParams } = new URL(request.url);
    const requestedInvestorId = String(searchParams.get("investorId") || "").trim();
    const investorId = actor.role === "investor" ? String(actor.investorId || "").trim() : requestedInvestorId;

    if (!investorId) throw new AppRequestError("Investor is required.", 400, "portfolio_investor_required");

    const investorSnapshot = await adminDb.collection("investors").doc(investorId).get();
    if (!investorSnapshot.exists) throw new AppRequestError("Investor profile was not found.", 404, "portfolio_investor_missing");
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };

    if (investor.isDeleted === true || investor.lifecycleStatus === "deleted") {
      throw new AppRequestError("This Investor has been deleted from active GrowVest records.", 410, "portfolio_investor_deleted");
    }
    if (!actorCanAccessInvestor(actor, investor)) {
      throw new AppRequestError("You are not authorised to view this investor portfolio.", 403, "portfolio_access_denied");
    }

    // Portfolio Master collections are loaded through Firebase Admin after the
    // actor/investor relationship is verified. This avoids browser Firestore
    // list-query permission failures caused by legacy ownership metadata while
    // preserving the same access boundary.
    const [positionRows, ulipRows, snapshotRows, transactionRows, tradeRows, manualAccountRows] = await Promise.all([
      byInvestor("portfolioPositions", investorId),
      byInvestor("ulipPolicies", investorId),
      byInvestor("portfolioSnapshots", investorId),
      byInvestor("investmentTransactions", investorId),
      byInvestor("tradingTransactions", investorId),
      byInvestor("manualPortfolioAccounts", investorId)
    ]);

    const positions = positionRows
      .filter((item) => !["inactive", "exited"].includes(String(item.status || "").toLowerCase()))
      .map((item) => ({
        ...item,
        goalAllocations: normalisePortfolioGoalAllocations(item.goalAllocations),
        allocationStatus: portfolioAllocationStatus(item.goalAllocations)
      }))
      .sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0));

    const ulipPolicies = ulipRows
      .filter((item) => String(item.status || "").toLowerCase() !== "inactive")
      .sort((a, b) => String(a.policyNumber || "").localeCompare(String(b.policyNumber || "")));

    const snapshots = snapshotRows
      .sort((a, b) => {
        const dateCompare = String(b.snapshotDate || "").localeCompare(String(a.snapshotDate || ""));
        return dateCompare || dateSortValue(b.updatedAt || b.createdAt) - dateSortValue(a.updatedAt || a.createdAt);
      })
      .slice(0, 70);

    const transactions = transactionRows
      .sort((a, b) => {
        const dateCompare = String(b.transactionDate || "").localeCompare(String(a.transactionDate || ""));
        return dateCompare || dateSortValue(b.createdAt) - dateSortValue(a.createdAt);
      })
      .slice(0, 300);

    const trades = tradeRows
      .sort((a, b) => {
        const dateCompare = String(b.tradeDate || "").localeCompare(String(a.tradeDate || ""));
        return dateCompare || dateSortValue(b.createdAt) - dateSortValue(a.createdAt);
      })
      .slice(0, 150);

    const manualAccounts = manualAccountRows
      .sort((a, b) => String(a.accountCode || "").localeCompare(String(b.accountCode || "")));

    return Response.json(serialise({
      investor: publicInvestor(investor),
      positions,
      ulipPolicies,
      snapshots,
      transactions,
      trades,
      manualAccounts
    }), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Investor portfolio view failed", error);
    return Response.json(
      { error: error?.message || "Unable to load investor portfolio." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
