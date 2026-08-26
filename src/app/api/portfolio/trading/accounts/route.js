import { adminDb, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { PORTFOLIO_SOURCES } from "@/lib/constants/portfolio";
import { indiaDateKey } from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

async function accessibleInvestors(actor) {
  let query = adminDb.collection("investors").where("isDeleted", "==", false);
  if (actor.role === "advisor") query = query.where("assignedAdvisorUid", "==", actor.uid);
  const snapshot = await query.get();
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function rowsByInvestorIds(collectionName, investorIds = []) {
  if (!investorIds.length) return [];
  const rows = [];
  const chunkSize = 30;
  for (let index = 0; index < investorIds.length; index += chunkSize) {
    const chunk = investorIds.slice(index, index + chunkSize);
    const snapshot = await adminDb.collection(collectionName).where("investorId", "in", chunk).get();
    rows.push(...snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }
  return rows;
}

function activePosition(row = {}) {
  return !["inactive", "exited", "removed"].includes(String(row.status || "").toLowerCase());
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const investors = await accessibleInvestors(actor);
    const investorIds = investors.map((item) => item.id);
    const investorById = new Map(investors.map((item) => [item.id, item]));
    const [accounts, positions, snapshots, dpTransactions, trades] = await Promise.all([
      rowsByInvestorIds("brokerAccounts", investorIds),
      rowsByInvestorIds("portfolioPositions", investorIds),
      rowsByInvestorIds("brokerAccountSnapshots", investorIds),
      rowsByInvestorIds("brokerDpTransactions", investorIds),
      rowsByInvestorIds("tradingTransactions", investorIds)
    ]);

    const brokerPositions = positions.filter((item) => item.brokerAccountId && item.productType === "stock_delivery" && activePosition(item));
    const latestSnapshotByAccount = new Map();
    snapshots.forEach((item) => {
      if (!item.brokerAccountId) return;
      const existing = latestSnapshotByAccount.get(item.brokerAccountId);
      const itemDate = String(item.valuationDate || item.snapshotDate || "");
      const existingDate = String(existing?.valuationDate || existing?.snapshotDate || "");
      if (!existing || itemDate > existingDate || (itemDate === existingDate && timestampMillis(item.updatedAt) > timestampMillis(existing.updatedAt))) {
        latestSnapshotByAccount.set(item.brokerAccountId, item);
      }
    });

    const dpByAccount = new Map();
    dpTransactions.forEach((item) => {
      if (!item.brokerAccountId) return;
      const rows = dpByAccount.get(item.brokerAccountId) || [];
      rows.push(item);
      dpByAccount.set(item.brokerAccountId, rows);
    });
    const tradesByAccount = new Map();
    trades.forEach((item) => {
      if (!item.brokerAccountId) return;
      const rows = tradesByAccount.get(item.brokerAccountId) || [];
      rows.push(item);
      tradesByAccount.set(item.brokerAccountId, rows);
    });

    const monthKey = indiaDateKey().slice(0, 7);
    const rows = accounts.map((account) => {
      const investor = investorById.get(account.investorId) || {};
      const holdings = brokerPositions.filter((item) => item.brokerAccountId === account.id);
      const movements = (dpByAccount.get(account.id) || []).sort((a, b) => String(b.transactionDate || "").localeCompare(String(a.transactionDate || "")));
      const accountTrades = (tradesByAccount.get(account.id) || []).filter((item) => String(item.status || "") !== "cancelled");
      const currentMonthTrades = accountTrades.filter((item) => String(item.tradeDate || "").startsWith(monthKey));
      const latest = latestSnapshotByAccount.get(account.id) || null;
      const holdingValue = Number(holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0).toFixed(2));
      const costBasisPendingCount = holdings.filter((item) => item.costBasisAvailable === false || item.costBasisStatus === "pending").length;
      const intradayNetPnlMonth = Number(currentMonthTrades.reduce((sum, item) => sum + Number(item.netPnl || 0), 0).toFixed(2));
      const intradayChargesMonth = Number(currentMonthTrades.reduce((sum, item) => sum + Number(item.totalCharges || 0), 0).toFixed(2));
      return {
        id: account.id,
        investorId: account.investorId,
        investorName: investor.fullName || investor.name || account.investorName || "Investor",
        clientCode: investor.clientCode || account.clientCode || "",
        source: account.source || "",
        provider: account.provider || account.broker || "Broker",
        accountType: account.accountType || "trading_demat",
        accountReference: account.accountReference || "",
        dematId: account.dematId || "",
        status: account.status || "active",
        lastValuationDate: account.lastValuationDate || latest?.valuationDate || "",
        lastStatementDate: account.lastStatementDate || "",
        holdingValue,
        positionCount: holdings.length,
        costBasisPendingCount,
        dpTransactionCount: movements.length,
        latestDpTransactions: movements.slice(0, 5).map((item) => ({
          id: item.id,
          transactionDate: item.transactionDate || "",
          instrumentName: item.instrumentName || "",
          isin: item.isin || "",
          debitQuantity: Number(item.debitQuantity || 0),
          creditQuantity: Number(item.creditQuantity || 0),
          reportedBalance: Number(item.reportedBalance || 0),
          description: item.description || ""
        })),
        intradayTradeCountMonth: currentMonthTrades.length,
        intradayNetPnlMonth,
        intradayChargesMonth,
        latestSnapshot: latest ? {
          valuationDate: latest.valuationDate || latest.snapshotDate || "",
          holdingValue: Number(latest.holdingValue || 0),
          positionCount: Number(latest.positionCount || 0),
          dpTransactionCount: Number(latest.dpTransactionCount || 0)
        } : null
      };
    }).sort((left, right) => left.investorName.localeCompare(right.investorName) || left.provider.localeCompare(right.provider));

    const accessibleTrades = trades.filter((item) => String(item.status || "") !== "cancelled");
    const monthTrades = accessibleTrades.filter((item) => String(item.tradeDate || "").startsWith(monthKey));
    const summary = {
      accountCount: rows.length,
      investorCount: new Set(rows.map((item) => item.investorId)).size,
      brokerCount: new Set(rows.map((item) => item.provider).filter(Boolean)).size,
      deliveryValue: Number(rows.reduce((sum, item) => sum + item.holdingValue, 0).toFixed(2)),
      deliveryPositionCount: rows.reduce((sum, item) => sum + item.positionCount, 0),
      costBasisPendingCount: rows.reduce((sum, item) => sum + item.costBasisPendingCount, 0),
      dpTransactionCount: rows.reduce((sum, item) => sum + item.dpTransactionCount, 0),
      intradayTradeCountMonth: monthTrades.length,
      intradayNetPnlMonth: Number(monthTrades.reduce((sum, item) => sum + Number(item.netPnl || 0), 0).toFixed(2)),
      monthKey
    };

    return Response.json({ dateKey: indiaDateKey(), summary, rows });
  } catch (error) {
    console.error("Trading account centre load failed", error);
    return Response.json({ error: error?.message || "Unable to load trading accounts." }, { status: appRequestErrorStatus(error, 500) });
  }
}
