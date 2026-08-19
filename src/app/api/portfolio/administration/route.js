import {
  adminDb,
  verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_ADMIN_SCOPES,
  portfolioAdministrationScope
} from "@/lib/constants/portfolio";

export const runtime = "nodejs";

function isAdmin(actor) {
  return ["super_admin", "admin"].includes(actor?.role);
}

function activePosition(position = {}) {
  return !["inactive", "exited", "removed"].includes(String(position.status || "").toLowerCase());
}

function emptyScope() {
  return { count: 0, currentValue: 0, positionIds: [] };
}

function emptyInvestorSummary(investorId) {
  return {
    investorId,
    holdingCount: 0,
    currentValue: 0,
    tradeCount: 0,
    tradingNetPnl: 0,
    scopes: {
      [PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR]: emptyScope(),
      [PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY]: emptyScope(),
      [PORTFOLIO_ADMIN_SCOPES.ULIP]: emptyScope(),
      [PORTFOLIO_ADMIN_SCOPES.MANUAL]: emptyScope(),
      [PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER]: emptyScope()
    }
  };
}

async function getInvestorDocuments(investorIds) {
  const result = new Map();
  const chunkSize = 100;
  for (let index = 0; index < investorIds.length; index += chunkSize) {
    const chunk = investorIds.slice(index, index + chunkSize);
    const snapshots = await adminDb.getAll(...chunk.map((id) => adminDb.collection("investors").doc(id)));
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;
      const data = snapshot.data();
      if (data?.isDeleted === true) return;
      result.set(snapshot.id, { id: snapshot.id, ...data });
    });
  }
  return result;
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) {
      return Response.json({ error: "Only Admin or Super Admin can use Portfolio Administration." }, { status: 403 });
    }

    const [positionsSnapshot, tradesSnapshot] = await Promise.all([
      adminDb.collection("portfolioPositions").get(),
      adminDb.collection("tradingTransactions").get()
    ]);

    const summaries = new Map();
    const investorIds = new Set();

    positionsSnapshot.docs.forEach((snapshot) => {
      const position = { id: snapshot.id, ...snapshot.data() };
      if (!position.investorId || !activePosition(position)) return;
      investorIds.add(String(position.investorId));
      const summary = summaries.get(position.investorId) || emptyInvestorSummary(position.investorId);
      const scopeKey = portfolioAdministrationScope(position);
      const scope = summary.scopes[scopeKey] || summary.scopes[PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER];
      const currentValue = Number(position.currentValue || 0);
      scope.count += 1;
      scope.currentValue += currentValue;
      scope.positionIds.push(position.id);
      summary.holdingCount += 1;
      summary.currentValue += currentValue;
      summaries.set(position.investorId, summary);
    });

    tradesSnapshot.docs.forEach((snapshot) => {
      const trade = snapshot.data();
      if (!trade?.investorId) return;
      investorIds.add(String(trade.investorId));
      const summary = summaries.get(trade.investorId) || emptyInvestorSummary(trade.investorId);
      summary.tradeCount += 1;
      summary.tradingNetPnl += Number(trade.netPnl || 0);
      summaries.set(trade.investorId, summary);
    });

    const investors = await getInvestorDocuments([...investorIds]);
    const rows = [...summaries.values()]
      .filter((summary) => investors.has(summary.investorId))
      .map((summary) => {
        const investor = investors.get(summary.investorId);
        const scopes = Object.fromEntries(Object.entries(summary.scopes).map(([key, scope]) => [key, {
          ...scope,
          currentValue: Number(Number(scope.currentValue || 0).toFixed(2))
        }]));
        return {
          id: summary.investorId,
          fullName: investor.fullName || investor.name || "Investor",
          clientCode: investor.clientCode || "",
          assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
          holdingCount: summary.holdingCount,
          currentValue: Number(Number(summary.currentValue || 0).toFixed(2)),
          tradeCount: summary.tradeCount,
          tradingNetPnl: Number(Number(summary.tradingNetPnl || 0).toFixed(2)),
          scopes
        };
      })
      .sort((left, right) => String(left.fullName || "").localeCompare(String(right.fullName || "")));

    const totals = rows.reduce((total, row) => {
      total.investors += 1;
      total.holdings += Number(row.holdingCount || 0);
      total.currentValue += Number(row.currentValue || 0);
      total.trades += Number(row.tradeCount || 0);
      return total;
    }, { investors: 0, holdings: 0, currentValue: 0, trades: 0 });

    return Response.json({
      rows,
      totals: {
        ...totals,
        currentValue: Number(totals.currentValue.toFixed(2))
      }
    });
  } catch (error) {
    console.error("Portfolio Administration summary failed", error);
    return Response.json(
      { error: error?.message || "Unable to load Portfolio Administration." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
