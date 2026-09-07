import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  verifyAppRequest
} from "@/lib/server/firebaseAdmin";
import { normalisePortfolioGoalAllocations } from "@/lib/portfolioGoalAllocation";

export const runtime = "nodejs";

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  return value;
}

function dateValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function active(position = {}) {
  return !["inactive", "exited", "closed"].includes(String(position.status || "").toLowerCase());
}

function transactionMatches(position = {}, transaction = {}) {
  if (transaction.positionId && String(transaction.positionId) === String(position.id)) return true;
  const identifiers = [
    [position.isin, transaction.isin],
    [position.folioNo, transaction.folioNo],
    [position.symbol, transaction.symbol],
    [position.policyNumber, transaction.policyNumber]
  ];
  if (identifiers.some(([left, right]) => left && right && String(left).trim().toUpperCase() === String(right).trim().toUpperCase())) return true;
  const positionName = String(position.instrumentName || position.schemeName || position.stockName || position.fundName || "").trim().toLowerCase();
  const txnName = String(transaction.instrumentName || transaction.schemeName || transaction.stockName || transaction.fundName || "").trim().toLowerCase();
  return Boolean(positionName && txnName && positionName === txnName);
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    if (actor.role !== "investor" || actor.portalEnabled === false || !actor.investorId) {
      throw new AppRequestError("Investor App access is required.", 403, "investor_app_required");
    }
    const { searchParams } = new URL(request.url);
    const positionId = String(searchParams.get("positionId") || "").trim();
    if (!positionId) throw new AppRequestError("Investment holding is required.", 400, "holding_required");

    const [positionSnapshot, investorSnapshot] = await Promise.all([
      adminDb.collection("portfolioPositions").doc(positionId).get(),
      adminDb.collection("investors").doc(String(actor.investorId)).get()
    ]);
    if (!positionSnapshot.exists) throw new AppRequestError("This investment holding was not found.", 404, "holding_missing");
    if (!investorSnapshot.exists) throw new AppRequestError("Investor profile was not found.", 404, "investor_missing");

    const position = { id: positionSnapshot.id, ...positionSnapshot.data() };
    if (String(position.investorId || "") !== String(actor.investorId)) {
      throw new AppRequestError("You do not have access to this investment holding.", 403, "holding_access_denied");
    }

    const [positionRowsSnapshot, transactionSnapshot] = await Promise.all([
      adminDb.collection("portfolioPositions").where("investorId", "==", String(actor.investorId)).get(),
      adminDb.collection("investmentTransactions").where("investorId", "==", String(actor.investorId)).get()
    ]);
    const activePositions = rows(positionRowsSnapshot).filter(active);
    const totalPortfolioValue = activePositions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const transactions = rows(transactionSnapshot)
      .filter((item) => transactionMatches(position, item))
      .sort((a, b) => String(b.transactionDate || "").localeCompare(String(a.transactionDate || "")) || dateValue(b.createdAt) - dateValue(a.createdAt))
      .slice(0, 120);

    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    const goalSource = Array.isArray(investor.bucketList) && investor.bucketList.length ? investor.bucketList : (Array.isArray(investor.goals) ? investor.goals : []);
    const goalMap = new Map(goalSource.map((goal) => [String(goal.id || goal.goalId || ""), goal]));
    const goalAllocations = normalisePortfolioGoalAllocations(position.goalAllocations).map((item) => ({
      ...item,
      goalName: item.goalName || goalMap.get(String(item.goalId || ""))?.name || goalMap.get(String(item.goalId || ""))?.goalName || "Bucket List"
    }));

    return Response.json(serialise({
      position: { ...position, goalAllocations },
      transactions,
      portfolioValue: Number(totalPortfolioValue.toFixed(2)),
      allocationPercentage: totalPortfolioValue > 0 ? Number((Number(position.currentValue || 0) / totalPortfolioValue * 100).toFixed(2)) : 0
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Investor holding detail failed", error);
    return Response.json({ error: error?.message || "Unable to load investment holding." }, { status: appRequestErrorStatus(error, 500) });
  }
}
