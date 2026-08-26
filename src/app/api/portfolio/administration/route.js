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
    historyCount: 0,
    history: {
      transactions: 0,
      policies: 0,
      snapshots: 0,
      snapshotPositions: 0,
      imports: 0,
      recoveryJournals: 0,
      recoveryItems: 0,
      mappings: 0,
      fingerprints: 0,
      tradingSummaries: 0,
      brokerAccounts: 0,
      brokerAccountSnapshots: 0,
      brokerDpTransactions: 0,
      sipSchedules: 0,
      sipCycles: 0,
      manualAccounts: 0,
      manualCashEntries: 0,
      manualIncome: 0,
      manualCorporateActions: 0,
      manualCharges: 0,
      manualGoalAllocations: 0,
      manualReconciliations: 0,
      manualNotes: 0
    },
    scopes: {
      [PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR]: emptyScope(),
      [PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY]: emptyScope(),
      [PORTFOLIO_ADMIN_SCOPES.BROKER_DELIVERY]: emptyScope(),
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

function addHistory(summaries, investorIds, field) {
  investorIds.forEach((investorId) => {
    if (!investorId) return;
    const summary = summaries.get(investorId) || emptyInvestorSummary(investorId);
    summary.history[field] += 1;
    summary.historyCount += 1;
    summaries.set(investorId, summary);
  });
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) {
      return Response.json({ error: "Only Admin or Super Admin can use Portfolio Administration." }, { status: 403 });
    }

    const [
      positionsSnapshot,
      tradesSnapshot,
      transactionsSnapshot,
      policiesSnapshot,
      tradingSummariesSnapshot,
      brokerAccountsSnapshot,
      brokerAccountSnapshotsSnapshot,
      brokerDpTransactionsSnapshot,
      snapshotsSnapshot,
      snapshotPositionsSnapshot,
      importsSnapshot,
      recoveryJournalsSnapshot,
      recoveryItemsSnapshot,
      mappingsSnapshot,
      fingerprintsSnapshot,
      sipSchedulesSnapshot,
      sipCyclesSnapshot,
      manualAccountsSnapshot,
      manualAccountSnapshotsSnapshot,
      manualCashSnapshot,
      manualIncomeSnapshot,
      manualCorporateActionsSnapshot,
      manualChargesSnapshot,
      manualGoalAllocationsSnapshot,
      manualReconciliationsSnapshot,
      manualNotesSnapshot,
      trackedInvestorsSnapshot
    ] = await Promise.all([
      adminDb.collection("portfolioPositions").get(),
      adminDb.collection("tradingTransactions").get(),
      adminDb.collection("investmentTransactions").get(),
      adminDb.collection("ulipPolicies").get(),
      adminDb.collection("tradingMonthlySummaries").get(),
      adminDb.collection("brokerAccounts").get(),
      adminDb.collection("brokerAccountSnapshots").get(),
      adminDb.collection("brokerDpTransactions").get(),
      adminDb.collection("portfolioSnapshots").get(),
      adminDb.collection("portfolioSnapshotPositions").get(),
      adminDb.collection("portfolioImportFiles").get(),
      adminDb.collection("portfolioImportChanges").get(),
      adminDb.collection("portfolioImportChangeItems").get(),
      adminDb.collection("externalInvestorMappings").get(),
      adminDb.collection("portfolioFileFingerprints").get(),
      adminDb.collection("sipFundingSchedules").get(),
      adminDb.collection("sipFundingCycles").get(),
      adminDb.collection("manualPortfolioAccounts").get(),
      adminDb.collection("manualPortfolioAccountSnapshots").get(),
      adminDb.collection("manualPortfolioCashLedger").get(),
      adminDb.collection("manualPortfolioIncome").get(),
      adminDb.collection("manualPortfolioCorporateActions").get(),
      adminDb.collection("manualPortfolioCharges").get(),
      adminDb.collection("manualPortfolioGoalAllocations").get(),
      adminDb.collection("manualPortfolioReconciliations").get(),
      adminDb.collection("manualPortfolioNotes").get(),
      adminDb.collection("investors").where("fundbazaarDailyTrackingEnabled", "==", true).get()
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

    addHistory(summaries, transactionsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "transactions");
    addHistory(summaries, policiesSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "policies");
    addHistory(summaries, tradingSummariesSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "tradingSummaries");
    addHistory(summaries, brokerAccountsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "brokerAccounts");
    addHistory(summaries, brokerAccountSnapshotsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "brokerAccountSnapshots");
    addHistory(summaries, brokerDpTransactionsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "brokerDpTransactions");
    addHistory(summaries, snapshotsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "snapshots");
    addHistory(summaries, snapshotPositionsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "snapshotPositions");
    addHistory(summaries, importsSnapshot.docs.map((item) => String(item.data()?.matchedInvestorId || item.data()?.investorId || "")).filter(Boolean), "imports");
    addHistory(summaries, recoveryJournalsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "recoveryJournals");
    addHistory(summaries, recoveryItemsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "recoveryItems");
    addHistory(summaries, mappingsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "mappings");
    addHistory(summaries, fingerprintsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "fingerprints");
    addHistory(summaries, sipSchedulesSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "sipSchedules");
    addHistory(summaries, sipCyclesSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "sipCycles");
    addHistory(summaries, manualAccountsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualAccounts");
    addHistory(summaries, manualAccountSnapshotsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualAccountSnapshots");
    addHistory(summaries, manualCashSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualCashEntries");
    addHistory(summaries, manualIncomeSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualIncome");
    addHistory(summaries, manualCorporateActionsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualCorporateActions");
    addHistory(summaries, manualChargesSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualCharges");
    addHistory(summaries, manualGoalAllocationsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualGoalAllocations");
    addHistory(summaries, manualReconciliationsSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualReconciliations");
    addHistory(summaries, manualNotesSnapshot.docs.map((item) => String(item.data()?.investorId || "")).filter(Boolean), "manualNotes");
    trackedInvestorsSnapshot.docs.forEach((item) => {
      const investorId = String(item.id || "");
      if (!investorId) return;
      const summary = summaries.get(investorId) || emptyInvestorSummary(investorId);
      summaries.set(investorId, summary);
      investorIds.add(investorId);
    });
    summaries.forEach((_, investorId) => investorIds.add(String(investorId)));

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
          historyCount: summary.historyCount,
          history: summary.history,
          hasResettableHistory: summary.historyCount > 0 || summary.holdingCount > 0 || summary.tradeCount > 0 || Boolean(investor.latestPortfolioSnapshotId || investor.latestPortfolioUpdatedAt),
          scopes
        };
      })
      .sort((left, right) => String(left.fullName || "").localeCompare(String(right.fullName || "")));

    const totals = rows.reduce((total, row) => {
      total.investors += 1;
      total.holdings += Number(row.holdingCount || 0);
      total.currentValue += Number(row.currentValue || 0);
      total.trades += Number(row.tradeCount || 0);
      total.history += Number(row.historyCount || 0);
      return total;
    }, { investors: 0, holdings: 0, currentValue: 0, trades: 0, history: 0 });

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
