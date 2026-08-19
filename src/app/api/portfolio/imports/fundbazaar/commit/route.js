import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_IMPORT_STATUS,
  PORTFOLIO_MATCH_STATUS,
  PORTFOLIO_REPORT_TYPES,
  PORTFOLIO_SOURCES
} from "@/lib/constants/portfolio";
import { normaliseExternalName, stableHash } from "@/lib/server/portfolioImportParser";
import { buildDailyPortfolioCoverage } from "@/lib/server/portfolioCoverage";
import {
  loadPortfolioResetContext,
  portfolioContextHasResettableState
} from "@/lib/server/portfolioReset";
import {
  createPortfolioSnapshot,
  getAccessibleInvestor,
  indiaDateKey,
  positionDocumentId,
  transactionDocumentId
} from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

function mappingDocumentId(normalizedExternalClientName) {
  return `${PORTFOLIO_SOURCES.FUNDBAZAAR}_${stableHash(normalizedExternalClientName, 32)}`;
}

function panMappingDocumentId(pan = "") {
  return pan ? `${PORTFOLIO_SOURCES.FUNDBAZAAR}_pan_${stableHash(String(pan).toUpperCase(), 32)}` : "";
}

async function assertFundbazaarValuationFormat({ file, investor, batchId }) {
  if (file.reportType !== PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION) {
    throw new Error("Fundbazaar Portfolio Ledger is not applicable. Upload Client Wise Valuation Report.xlsx instead.");
  }

  if (/\.xlsx$/i.test(file.fileName || "")) return;

  const legacyBootstrap = file.fundbazaarBootstrapOnly === true
    && ["HTML-XLS", "XLS"].includes(String(file.fileFormat || "").toUpperCase());
  if (!legacyBootstrap) {
    throw new Error("Fundbazaar portfolio updates require Client Wise Valuation Report.xlsx.");
  }

  const context = await loadPortfolioResetContext(investor);
  const hasPreviousPortfolioState = portfolioContextHasResettableState(context, {
    excludeImportBatchIds: [batchId]
  });
  if (hasPreviousPortfolioState) {
    throw new Error("This Fundbazaar XLS/HTML-XLS file is allowed only for the first upload of a completely blank or newly reset portfolio. This investor already has portfolio data/history, so use Client Wise Valuation Report.xlsx for the ongoing update.");
  }
}

function transactionKind(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("sip")) return "sip";
  if (/switch\s*in/.test(text)) return "switch_in";
  if (/switch\s*out/.test(text)) return "switch_out";
  if (/redemption|redeem|withdraw/.test(text)) return "redemption";
  if (/dividend/.test(text)) return "dividend";
  if (/purchase|fresh|additional|lump|investment/.test(text)) return "purchase";
  return text.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "investment";
}

function canonicalTransactionKey(transaction = {}) {
  const amount = Number(transaction.purchaseAmount ?? transaction.investedAmount ?? transaction.amount ?? 0);
  const nav = Number(transaction.purchaseNav ?? transaction.navRate ?? 0);
  const units = Number(transaction.units || 0);
  return [
    String(transaction.folioNo || "").trim().toUpperCase(),
    String(transaction.transactionDate || ""),
    transactionKind(transaction.transactionType || transaction.sourceTransactionType),
    amount.toFixed(2),
    nav.toFixed(6),
    Math.abs(units).toFixed(6)
  ].join("|");
}

function sameFundHolding(existing = {}, holding = {}) {
  if (existing.source !== PORTFOLIO_SOURCES.FUNDBAZAAR) return false;
  const existingFolio = String(existing.folioNo || "").trim();
  const nextFolio = String(holding.folioNo || "").trim();
  if (!existingFolio || !nextFolio || existingFolio !== nextFolio) return false;
  if (existing.isin && holding.isin) return String(existing.isin) === String(holding.isin);
  return normaliseExternalName(existing.schemeName || existing.instrumentName) === normaliseExternalName(holding.schemeName || holding.instrumentName);
}

function recoveredGoalAllocation(file = {}, holding = {}) {
  const rows = Array.isArray(file.recoveryGoalAllocations) ? file.recoveryGoalAllocations : [];
  return rows.find((item) => {
    const folioMatches = String(item.folioNo || "").trim() && String(item.folioNo || "").trim() === String(holding.folioNo || "").trim();
    if (!folioMatches) return false;
    if (item.isin && holding.isin) return String(item.isin) === String(holding.isin);
    return normaliseExternalName(item.instrumentName || "") === normaliseExternalName(holding.instrumentName || holding.schemeName || "");
  }) || null;
}

function cashFlowType(transactionType = "") {
  const type = String(transactionType || "").toLowerCase();
  if (/switch\s*in|switch\s*out/.test(type)) return "internal";
  if (/redemption|withdraw/.test(type)) return "withdrawal";
  if (/sip|purchase|lump\s*sum|investment/.test(type)) return "new_money";
  return "review";
}

function recoveryItemId(fileId, collectionName, documentId) {
  return `chg_${stableHash(`${fileId}|${collectionName}|${documentId}`, 48)}`;
}

function recoveryData(record = null) {
  if (!record) return null;
  const { id, ref, ...data } = record;
  return data;
}

async function createRecoveryJournal({
  batchId,
  file,
  actor,
  investorId,
  mappingRef,
  mappingSnapshot,
  panMappingRef,
  panMappingSnapshot,
  fingerprintRef,
  fingerprintSnapshot,
  holdingEntries,
  exitedPositions,
  transactionEntries,
  mappingEntries = [],
  tradingEntries = [],
  tradingSummaryEntries = [],
  policyEntries = [],
  source = PORTFOLIO_SOURCES.FUNDBAZAAR
}) {
  const changeRef = adminDb.collection("portfolioImportChanges").doc(file.id);
  const changeWriter = adminDb.bulkWriter();
  const items = [];
  const seenItems = new Set();
  const positionById = new Map();
  [...holdingEntries, ...exitedPositions.map((item) => ({ ref: item.ref, existing: item }))].forEach((item) => {
    if (!positionById.has(item.ref.id)) positionById.set(item.ref.id, item);
  });

  const addItem = (collectionName, ref, beforeData, entityType) => {
    if (!ref) return;
    const itemId = recoveryItemId(file.id, collectionName, ref.id);
    if (seenItems.has(itemId)) return;
    seenItems.add(itemId);
    items.push(itemId);
    changeWriter.set(adminDb.collection("portfolioImportChangeItems").doc(itemId), {
      batchId,
      fileId: file.id,
      investorId,
      source,
      collectionName,
      entityType,
      entityId: ref.id,
      existedBefore: Boolean(beforeData),
      before: beforeData || null,
      createdAt: FieldValue.serverTimestamp()
    });
  };

  positionById.forEach((item) => addItem("portfolioPositions", item.ref, recoveryData(item.existing), "position"));
  transactionEntries.forEach((item) => addItem("investmentTransactions", item.ref, item.existingData || null, "transaction"));
  tradingEntries.forEach((item) => addItem("tradingTransactions", item.ref, item.existingData || null, "trade"));
  tradingSummaryEntries.forEach((item) => addItem("tradingMonthlySummaries", item.ref, item.existingData || null, "trading_summary"));
  policyEntries.forEach((item) => addItem("ulipPolicies", item.ref, item.existingData || null, "ulip_policy"));
  if (mappingEntries.length) {
    mappingEntries.forEach((item) => addItem("externalInvestorMappings", item.ref, item.snapshot?.exists ? item.snapshot.data() : null, `mapping_${item.identityType || "external"}`));
  } else {
    addItem("externalInvestorMappings", mappingRef, mappingSnapshot?.exists ? mappingSnapshot.data() : null, "mapping_name");
    if (panMappingRef) addItem("externalInvestorMappings", panMappingRef, panMappingSnapshot?.exists ? panMappingSnapshot.data() : null, "mapping_pan");
  }
  addItem("portfolioFileFingerprints", fingerprintRef, fingerprintSnapshot.exists ? fingerprintSnapshot.data() : null, "fingerprint");

  changeWriter.set(changeRef, {
    batchId,
    fileId: file.id,
    fileName: file.fileName || "",
    reportType: file.reportType || "",
    source,
    investorId,
    investorName: file.matchedInvestorName || "",
    advisorUid: actor.uid,
    status: "pending_commit",
    reversible: true,
    journalVersion: 1,
    itemIds: items,
    positionCount: positionById.size,
    policyCount: policyEntries.length,
    transactionCount: transactionEntries.length + tradingEntries.length,
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "GrowVest User",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await changeWriter.close();
  return changeRef;
}

function bajajMappingDescriptors(file = {}) {
  const source = PORTFOLIO_SOURCES.BAJAJ_BROKING;
  const rows = [];
  if (file.normalizedExternalClientName) rows.push({ identityType: "client_name", id: `${source}_name_${stableHash(file.normalizedExternalClientName, 32)}` });
  if (file.externalPan) rows.push({ identityType: "pan", id: `${source}_pan_${stableHash(String(file.externalPan).toUpperCase(), 32)}` });
  if (file.externalClientCode) rows.push({ identityType: "client_code", id: `${source}_client_${stableHash(String(file.externalClientCode).toUpperCase(), 32)}` });
  return rows;
}

async function loadBajajMappingEntries(file = {}) {
  const descriptors = bajajMappingDescriptors(file);
  if (!descriptors.length) return [];
  const refs = descriptors.map((item) => adminDb.collection("externalInvestorMappings").doc(item.id));
  const snapshots = await adminDb.getAll(...refs);
  return descriptors.map((item, index) => ({ ...item, ref: refs[index], snapshot: snapshots[index] }));
}

function sameBajajHolding(existing = {}, holding = {}) {
  if (existing.source !== PORTFOLIO_SOURCES.BAJAJ_BROKING || existing.productType !== "stock_delivery") return false;
  if (existing.isin && holding.isin) return String(existing.isin).trim().toUpperCase() === String(holding.isin).trim().toUpperCase();
  const existingSymbol = normaliseExternalName(existing.symbol || existing.stockName || existing.instrumentName);
  const nextSymbol = normaliseExternalName(holding.symbol || holding.stockName || holding.instrumentName);
  if (!existingSymbol || !nextSymbol || existingSymbol !== nextSymbol) return false;
  const existingExchange = String(existing.exchange || "").trim().toUpperCase();
  const nextExchange = String(holding.exchange || "").trim().toUpperCase();
  return !existingExchange || !nextExchange || existingExchange === nextExchange;
}

function recoveredBajajGoalAllocation(file = {}, holding = {}) {
  const rows = Array.isArray(file.recoveryGoalAllocations) ? file.recoveryGoalAllocations : [];
  return rows.find((item) => {
    if (item.isin && holding.isin) return String(item.isin).trim().toUpperCase() === String(holding.isin).trim().toUpperCase();
    return normaliseExternalName(item.symbol || item.instrumentName || "") === normaliseExternalName(holding.symbol || holding.instrumentName || holding.stockName || "");
  }) || null;
}

function requestedGoalAllocation(investor = {}, goalName = "") {
  const normalized = normaliseExternalName(goalName);
  if (!normalized || ["GENERAL WEALTH", "UNASSIGNED", "GENERAL WEALTH UNASSIGNED"].includes(normalized)) return [];
  const goals = Array.isArray(investor.bucketList) && investor.bucketList.length ? investor.bucketList : (investor.goals || []);
  const matches = goals.filter((goal) => normaliseExternalName(goal.name || goal.goalName || "") === normalized);
  if (matches.length !== 1) return [];
  const goal = matches[0];
  return [{ goalId: String(goal.id || goal.goalId || ""), goalName: goal.name || goal.goalName || goalName, percentage: 100 }].filter((item) => item.goalId);
}

function bajajTradeDocumentId(investorId, trade = {}) {
  const identity = [
    trade.externalTradeId ? `external:${String(trade.externalTradeId).trim()}` : "",
    trade.tradeDate || "",
    String(trade.exchange || "").toUpperCase(),
    normaliseExternalName(trade.symbol || trade.stockName || trade.instrumentName || ""),
    Number(trade.quantity || 0).toFixed(6),
    Number(trade.buyRate || 0).toFixed(6),
    Number(trade.sellRate || 0).toFixed(6)
  ].join("|");
  return `trade_${stableHash([investorId, PORTFOLIO_SOURCES.BAJAJ_BROKING, identity].join("|"), 48)}`;
}

function tradingSummaryForRows(rows = []) {
  const summary = rows.reduce((total, trade) => {
    const quantity = Number(trade.quantity || Math.min(Number(trade.buyQuantity || 0), Number(trade.sellQuantity || 0)) || 0);
    const buyQuantity = Number(trade.buyQuantity || quantity);
    const sellQuantity = Number(trade.sellQuantity || quantity);
    total.totalTrades += 1;
    total.grossPnl += Number(trade.grossPnl || 0);
    total.totalCharges += Number(trade.totalCharges || 0);
    total.netPnl += Number(trade.netPnl || 0);
    total.turnover += Number(trade.buyRate || 0) * buyQuantity + Number(trade.sellRate || 0) * sellQuantity;
    if (Number(trade.netPnl || 0) > 0) total.winningTrades += 1;
    if (Number(trade.netPnl || 0) < 0) total.losingTrades += 1;
    if (trade.tradeDate) total.tradingDays.add(trade.tradeDate);
    return total;
  }, { totalTrades: 0, winningTrades: 0, losingTrades: 0, grossPnl: 0, totalCharges: 0, netPnl: 0, turnover: 0, tradingDays: new Set() });
  return {
    tradingDays: summary.tradingDays.size,
    totalTrades: summary.totalTrades,
    winningTrades: summary.winningTrades,
    losingTrades: summary.losingTrades,
    grossPnl: Number(summary.grossPnl.toFixed(2)),
    totalCharges: Number(summary.totalCharges.toFixed(2)),
    netPnl: Number(summary.netPnl.toFixed(2)),
    turnover: Number(summary.turnover.toFixed(2))
  };
}

async function commitBajajFile({ actor, batchId, file, fileRef, investor, investorId, writer }) {
  const mappingEntries = await loadBajajMappingEntries(file);
  for (const entry of mappingEntries) {
    if (entry.snapshot.exists && entry.snapshot.data()?.investorId !== investorId) {
      throw new Error(`This Bajaj ${entry.identityType.replaceAll("_", " ")} is already mapped to another GrowVest investor.`);
    }
  }

  const holdings = Array.isArray(file.holdings) ? file.holdings : [];
  const trades = Array.isArray(file.trades) ? file.trades : [];
  const investorPositionSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
  const investorPositions = investorPositionSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
  const holdingEntries = holdings.map((holding) => {
    const existing = investorPositions.find((item) => sameBajajHolding(item, holding));
    const ref = existing?.ref || adminDb.collection("portfolioPositions").doc(positionDocumentId({
      investorId,
      source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
      isin: holding.isin || "",
      symbol: holding.symbol || "",
      folioNo: "",
      instrumentName: holding.instrumentName || holding.stockName || holding.symbol || "Stock"
    }));
    return { holding, ref, existing: existing || null };
  });
  // Do not infer a Bajaj exit merely because a security is absent from an
  // unverified broker export layout. Once a real Bajaj Holdings sample confirms
  // that the report is always a complete holding set, this can safely become an
  // authoritative missing-position exit check. Explicit/manual stock sales remain
  // available meanwhile and recovery protects all imported position updates.
  const exitedPositions = [];

  const tradeRefs = trades.map((trade) => adminDb.collection("tradingTransactions").doc(bajajTradeDocumentId(investorId, trade)));
  const tradeSnapshots = tradeRefs.length ? await adminDb.getAll(...tradeRefs) : [];
  const tradingEntries = trades.map((trade, index) => ({
    trade,
    ref: tradeRefs[index],
    existingData: tradeSnapshots[index]?.exists ? tradeSnapshots[index].data() : null
  }));
  const monthKeys = [...new Set(trades.map((trade) => String(trade.tradeDate || "").slice(0, 7)).filter(Boolean))];
  const summaryRefs = monthKeys.map((monthKey) => adminDb.collection("tradingMonthlySummaries").doc(`${investorId}_${monthKey}`));
  const summarySnapshots = summaryRefs.length ? await adminDb.getAll(...summaryRefs) : [];
  const tradingSummaryEntries = summaryRefs.map((ref, index) => ({ ref, existingData: summarySnapshots[index]?.exists ? summarySnapshots[index].data() : null }));

  const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(file.fileFingerprint);
  const fingerprintSnapshot = await fingerprintRef.get();
  const recoveryRef = await createRecoveryJournal({
    batchId,
    file,
    actor,
    investorId,
    fingerprintRef,
    fingerprintSnapshot,
    holdingEntries,
    exitedPositions,
    transactionEntries: [],
    mappingEntries,
    tradingEntries,
    tradingSummaryEntries,
    source: PORTFOLIO_SOURCES.BAJAJ_BROKING
  });

  try {
    const mappingPayload = {
    source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
    externalClientName: file.externalClientName || "",
    normalizedExternalClientName: file.normalizedExternalClientName || "",
    externalPan: file.externalPan || "",
    externalClientCode: file.externalClientCode || "",
    investorId,
    investorName: investor.fullName || "",
    clientCode: investor.clientCode || "",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    status: "verified",
    coverageEnabled: true,
    verifiedByUid: actor.uid,
    verifiedByName: actor.fullName || actor.email || "GrowVest User",
    lastSuccessfulImportAt: FieldValue.serverTimestamp(),
    lastSuccessfulImportId: batchId,
    updatedAt: FieldValue.serverTimestamp()
  };
  mappingEntries.forEach((entry) => writer.set(entry.ref, {
    ...mappingPayload,
    identityType: entry.identityType,
    verifiedAt: entry.snapshot.exists ? entry.snapshot.data()?.verifiedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
  }, { merge: true }));

  exitedPositions.forEach((item) => writer.update(item.ref, {
    status: "exited",
    exitDetectedByImportId: batchId,
    exitDetectedByFileId: file.id,
    exitedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.fullName || actor.email || "GrowVest User"
  }));

  holdingEntries.forEach(({ holding, ref, existing }) => {
    const previous = existing || {};
    const recovered = recoveredBajajGoalAllocation(file, holding);
    let goalAllocations = recovered?.goalAllocations || (Array.isArray(previous.goalAllocations) ? previous.goalAllocations : []);
    if (!goalAllocations.length && !existing && holding.requestedGoalName) goalAllocations = requestedGoalAllocation(investor, holding.requestedGoalName);
    const valuationDate = holding.valuationDate || file.summary?.valuationDate || file.reportPeriodEnd || "";
    const currentRate = Number(holding.currentRate || 0);
    const currentValue = Number(holding.currentValue || 0);
    const totalInvested = Number(holding.totalInvested ?? holding.investedAmount ?? 0);
    const quantity = Number(holding.quantity || 0);
    const averageBuyRate = Number(holding.averageBuyRate || (quantity > 0 ? totalInvested / quantity : 0));
    const gainLoss = Number(holding.gainLoss ?? (currentValue - totalInvested));
    const returnPercentage = totalInvested > 0 ? gainLoss / totalInvested * 100 : Number(holding.returnPercentage || 0);
    const valuationChanged = Boolean(previous.currentValue || previous.currentRate || previous.valuationDate) && (
      Number(previous.currentValue || 0) !== currentValue
      || Number(previous.currentRate || 0) !== currentRate
      || String(previous.valuationDate || previous.priceDate || "") !== String(valuationDate || "")
    );
    writer.set(ref, {
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
      provider: holding.provider || "Bajaj Broking",
      productType: "stock_delivery",
      assetClass: "Equity",
      instrumentName: holding.instrumentName || holding.stockName || holding.symbol || previous.instrumentName || "Stock",
      stockName: holding.stockName || holding.instrumentName || holding.symbol || previous.stockName || "",
      symbol: holding.symbol || previous.symbol || "",
      isin: holding.isin || previous.isin || "",
      exchange: holding.exchange || previous.exchange || "NSE",
      investmentMode: "Delivery",
      purchaseDate: holding.purchaseDate || previous.purchaseDate || "",
      quantity: Number(quantity.toFixed(6)),
      averageBuyRate: Number(averageBuyRate.toFixed(6)),
      totalInvested: Number(totalInvested.toFixed(2)),
      investedAmount: Number(totalInvested.toFixed(2)),
      currentRate: Number(currentRate.toFixed(6)),
      currentValue: Number(currentValue.toFixed(2)),
      gainLoss: Number(gainLoss.toFixed(2)),
      returnPercentage: Number(returnPercentage.toFixed(2)),
      valuationDate,
      priceDate: valuationDate,
      previousRate: valuationChanged ? Number(previous.currentRate || 0) : Number(previous.previousRate || 0),
      previousCurrentValue: valuationChanged ? Number(previous.currentValue || 0) : Number(previous.previousCurrentValue || 0),
      previousValuationDate: valuationChanged ? (previous.valuationDate || previous.priceDate || "") : (previous.previousValuationDate || ""),
      goalAllocations,
      allocationStatus: goalAllocations.length ? (recovered?.allocationStatus || previous.allocationStatus || "allocated") : "general_wealth",
      requestedGoalName: holding.requestedGoalName || "",
      goalImportReviewRequired: Boolean(holding.requestedGoalName && !goalAllocations.length && !/general wealth|unassigned/i.test(holding.requestedGoalName)),
      notes: holding.notes || previous.notes || "",
      status: quantity > 0 || currentValue > 0 ? "active" : "exited",
      valuationSourceReportType: file.reportType || "",
      sourceImportId: batchId,
      sourceImportFileId: file.id,
      sourceFileName: file.fileName || "",
      createdAt: previous.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: actor.fullName || actor.email || "GrowVest User"
    }, { merge: true });
  });

  tradingEntries.forEach(({ trade, ref, existingData }) => {
    const existing = existingData || {};
    const quantity = Number(trade.quantity || Math.min(Number(trade.buyQuantity || 0), Number(trade.sellQuantity || 0)) || 0);
    const buyQuantity = Number(trade.buyQuantity || quantity);
    const sellQuantity = Number(trade.sellQuantity || quantity);
    const totalCharges = Number(trade.totalCharges || 0);
    const grossPnl = Number(trade.grossPnl ?? ((Number(trade.sellRate || 0) - Number(trade.buyRate || 0)) * quantity));
    const netPnl = Number(trade.netPnl ?? (grossPnl - totalCharges));
    writer.set(ref, {
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
      provider: trade.provider || "Bajaj Broking",
      tradeType: "intraday",
      tradeDate: trade.tradeDate || "",
      stockName: trade.stockName || trade.instrumentName || trade.symbol || "Stock",
      instrumentName: trade.instrumentName || trade.stockName || trade.symbol || "Stock",
      symbol: trade.symbol || "",
      exchange: trade.exchange || "NSE",
      buyQuantity: Number(buyQuantity.toFixed(6)),
      sellQuantity: Number(sellQuantity.toFixed(6)),
      quantity: Number(quantity.toFixed(6)),
      buyRate: Number(Number(trade.buyRate || 0).toFixed(6)),
      sellRate: Number(Number(trade.sellRate || 0).toFixed(6)),
      grossPnl: Number(grossPnl.toFixed(2)),
      brokerage: Number(Number(trade.brokerage || 0).toFixed(2)),
      stt: Number(Number(trade.stt || 0).toFixed(2)),
      exchangeCharges: Number(Number(trade.exchangeCharges || 0).toFixed(2)),
      gst: Number(Number(trade.gst || 0).toFixed(2)),
      stampDuty: Number(Number(trade.stampDuty || 0).toFixed(2)),
      otherCharges: Number(Number(trade.otherCharges || 0).toFixed(2)),
      totalCharges: Number(totalCharges.toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      turnover: Number((Number(trade.buyRate || 0) * buyQuantity + Number(trade.sellRate || 0) * sellQuantity).toFixed(2)),
      result: netPnl > 0 ? "profit" : netPnl < 0 ? "loss" : "breakeven",
      status: "closed",
      externalTradeId: trade.externalTradeId || "",
      notes: trade.notes || existing.notes || "",
      sourceImportId: batchId,
      sourceImportFileId: file.id,
      sourceFileName: file.fileName || "",
      sourceRow: trade.sourceRow || null,
      createdByUid: existing.createdByUid || actor.uid,
      createdByName: existing.createdByName || actor.fullName || actor.email || "GrowVest User",
      createdAt: existing.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  writer.set(fingerprintRef, {
    source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
    batchId,
    fileId: file.id,
    investorId,
    importedAt: FieldValue.serverTimestamp(),
    importedByUid: actor.uid
  }, { merge: true });
  writer.update(fileRef, {
    matchedInvestorId: investorId,
    matchedInvestorName: investor.fullName || "",
    matchedClientCode: investor.clientCode || "",
    matchStatus: PORTFOLIO_MATCH_STATUS.VERIFIED,
    status: "imported",
    importedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await writer.flush();

  if (monthKeys.length) {
    const allTradeSnapshot = await adminDb.collection("tradingTransactions").where("investorId", "==", investorId).get();
    const allBajajTrades = allTradeSnapshot.docs.map((item) => item.data()).filter((item) => item.source === PORTFOLIO_SOURCES.BAJAJ_BROKING && item.status !== "cancelled");
    monthKeys.forEach((monthKey) => {
      const monthTrades = allBajajTrades.filter((item) => String(item.tradeDate || "").startsWith(monthKey));
      const summary = tradingSummaryForRows(monthTrades);
      writer.set(adminDb.collection("tradingMonthlySummaries").doc(`${investorId}_${monthKey}`), {
        investorId,
        investorName: investor.fullName || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        monthKey,
        source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
        provider: "Bajaj Broking",
        ...summary,
        sourceImportId: batchId,
        sourceImportFileId: file.id,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await writer.flush();
  }

  await recoveryRef.update({
    status: "committed",
    committedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }).catch(async (journalError) => {
    console.error("Bajaj recovery journal finalisation failed", journalError);
    await fileRef.set({ recoveryJournalError: journalError?.message || "Recovery journal could not be finalised." }, { merge: true }).catch(() => {});
  });

    return {
      fileId: file.id,
      fileName: file.fileName,
      status: "imported",
      investorId,
      investorName: investor.fullName || "",
      positionCount: holdings.length,
      newPositionCount: holdingEntries.filter((item) => !item.existing).length,
      exitedPositionCount: exitedPositions.length,
      transactionCount: trades.length,
      tradeCount: trades.length,
      currentValue: Number(file.summary?.currentValue || 0),
      tradingNetPnl: Number(file.summary?.netPnl || 0)
    };
  } catch (error) {
    await recoveryRef.set({
      status: "commit_failed",
      reversible: true,
      failureReason: error?.message || "Bajaj import failed",
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
    throw error;
  }
}



function genericMappingDescriptors(file = {}) {
  const source = PORTFOLIO_SOURCES.GROWVEST_STANDARD;
  const rows = [];
  if (file.normalizedExternalClientName) rows.push({ identityType: "client_name", id: `${source}_name_${stableHash(file.normalizedExternalClientName, 32)}` });
  if (file.externalPan) rows.push({ identityType: "pan", id: `${source}_pan_${stableHash(String(file.externalPan).toUpperCase(), 32)}` });
  if (file.externalClientCode) rows.push({ identityType: "client_code", id: `${source}_client_${stableHash(String(file.externalClientCode).toUpperCase(), 32)}` });
  return rows.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
}

async function loadGenericMappingEntries(file = {}) {
  const descriptors = genericMappingDescriptors(file);
  if (!descriptors.length) return [];
  const refs = descriptors.map((item) => adminDb.collection("externalInvestorMappings").doc(item.id));
  const snapshots = await adminDb.getAll(...refs);
  return descriptors.map((item, index) => ({ ...item, ref: refs[index], snapshot: snapshots[index] }));
}

function genericHoldingReference(value = {}) {
  return String(value.accountReference || value.folioNo || value.policyNumber || "").trim().toUpperCase();
}

function sameGenericHolding(existing = {}, holding = {}) {
  if (existing.source !== PORTFOLIO_SOURCES.GROWVEST_STANDARD) return false;
  if (existing.productType && holding.productType && existing.productType !== holding.productType) return false;
  const leftProvider = normaliseExternalName(existing.provider || "");
  const rightProvider = normaliseExternalName(holding.provider || "");
  if (leftProvider && rightProvider && leftProvider !== rightProvider) return false;
  const leftRef = genericHoldingReference(existing);
  const rightRef = genericHoldingReference(holding);
  if (leftRef && rightRef) return leftRef === rightRef;
  if (existing.isin && holding.isin) return String(existing.isin).trim().toUpperCase() === String(holding.isin).trim().toUpperCase();
  const leftSymbol = normaliseExternalName(existing.symbol || "");
  const rightSymbol = normaliseExternalName(holding.symbol || "");
  if (leftSymbol && rightSymbol) {
    const leftExchange = String(existing.exchange || "").trim().toUpperCase();
    const rightExchange = String(holding.exchange || "").trim().toUpperCase();
    return leftSymbol === rightSymbol && (!leftExchange || !rightExchange || leftExchange === rightExchange);
  }
  return normaliseExternalName(existing.instrumentName || existing.schemeName || existing.stockName || existing.fundName || "")
    === normaliseExternalName(holding.instrumentName || holding.schemeName || holding.stockName || holding.fundName || "");
}

function recoveredGenericGoalAllocation(file = {}, holding = {}) {
  const rows = Array.isArray(file.recoveryGoalAllocations) ? file.recoveryGoalAllocations : [];
  return rows.find((item) => {
    if (item.productType && holding.productType && item.productType !== holding.productType) return false;
    const itemRef = String(item.accountReference || item.folioNo || item.policyNumber || "").trim().toUpperCase();
    const holdingRef = genericHoldingReference(holding);
    if (itemRef && holdingRef) return itemRef === holdingRef;
    if (item.isin && holding.isin) return String(item.isin).trim().toUpperCase() === String(holding.isin).trim().toUpperCase();
    if (item.symbol && holding.symbol) return normaliseExternalName(item.symbol) === normaliseExternalName(holding.symbol);
    return normaliseExternalName(item.instrumentName || "") === normaliseExternalName(holding.instrumentName || "");
  }) || null;
}

function genericTransactionKey(transaction = {}) {
  const externalReference = String(transaction.transactionReference || transaction.externalTransactionId || "").trim().toUpperCase();
  if (externalReference) return `external|${normaliseExternalName(transaction.provider || "")}|${externalReference}`;
  return [
    normaliseExternalName(transaction.provider || ""),
    transaction.productType || "",
    String(transaction.accountReference || transaction.folioNo || transaction.policyNumber || "").trim().toUpperCase(),
    String(transaction.isin || "").trim().toUpperCase(),
    normaliseExternalName(transaction.symbol || transaction.instrumentName || ""),
    String(transaction.transactionDate || ""),
    String(transaction.transactionType || "").trim().toLowerCase(),
    Number(transaction.amount ?? transaction.purchaseAmount ?? 0).toFixed(2),
    Number(transaction.transactionRate ?? transaction.purchaseNav ?? 0).toFixed(6),
    Math.abs(Number(transaction.quantity ?? transaction.units ?? 0)).toFixed(6)
  ].join("|");
}

function genericPolicyDocumentId(investorId, policyNumber = "") {
  return `ulip_${stableHash([investorId, String(policyNumber).trim().toUpperCase()].join("|"), 40)}`;
}

async function commitGenericFile({ actor, batchId, file, fileRef, investor, investorId, writer }) {
  const mappingEntries = await loadGenericMappingEntries(file);
  for (const entry of mappingEntries) {
    if (entry.snapshot.exists && entry.snapshot.data()?.investorId !== investorId) {
      throw new Error(`This GrowVest Standard ${entry.identityType.replaceAll("_", " ")} is already mapped to another investor.`);
    }
  }

  const holdings = Array.isArray(file.holdings) ? file.holdings : [];
  const transactions = Array.isArray(file.transactions) ? file.transactions : [];
  if (!holdings.length && !transactions.length) throw new Error("This GrowVest Standard import has no usable holdings or transactions.");

  for (const holding of holdings) {
    const accountReference = genericHoldingReference(holding);
    if (!accountReference) continue;
    const snapshot = await adminDb.collection("portfolioPositions").where("accountReference", "==", accountReference).get();
    const conflict = snapshot.docs.find((item) => {
      const data = item.data();
      if (data.source !== PORTFOLIO_SOURCES.GROWVEST_STANDARD || data.investorId === investorId) return false;
      return normaliseExternalName(data.provider || "") === normaliseExternalName(holding.provider || "")
        && (!data.productType || !holding.productType || data.productType === holding.productType);
    });
    if (conflict) throw new Error(`Account/reference ${accountReference} is already linked to another GrowVest investor for this provider.`);
  }

  const positionSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
  const investorPositions = positionSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
  const previousGenericPositions = investorPositions.filter((item) => item.source === PORTFOLIO_SOURCES.GROWVEST_STANDARD && !["inactive", "exited"].includes(item.status));
  const holdingEntries = holdings.map((holding) => {
    const existing = investorPositions.find((item) => sameGenericHolding(item, holding));
    const accountReference = genericHoldingReference(holding);
    const ref = existing?.ref || adminDb.collection("portfolioPositions").doc(positionDocumentId({
      investorId,
      source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
      isin: holding.isin || "",
      symbol: holding.symbol || "",
      folioNo: accountReference,
      instrumentName: holding.instrumentName || "Investment"
    }));
    return { holding, ref, existing: existing || null };
  });

  const representedProviders = new Set(holdings.map((item) => normaliseExternalName(item.provider || "GrowVest Standard")).filter(Boolean));
  const currentIds = new Set(holdingEntries.map((item) => item.ref.id));
  const exitedPositions = file.completeSnapshot === true
    ? previousGenericPositions.filter((item) => representedProviders.has(normaliseExternalName(item.provider || "GrowVest Standard")) && !currentIds.has(item.id))
    : [];

  const existingTransactionSnapshot = await adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get();
  const existingTransactions = new Map();
  existingTransactionSnapshot.docs.forEach((item) => {
    const data = item.data();
    if (data.source === PORTFOLIO_SOURCES.GROWVEST_STANDARD) existingTransactions.set(genericTransactionKey(data), { ref: item.ref, data });
  });
  const transactionEntries = transactions.map((transaction) => {
    const key = genericTransactionKey(transaction);
    const existing = existingTransactions.get(key) || null;
    const ref = existing?.ref || adminDb.collection("investmentTransactions").doc(`txn_${stableHash([investorId, PORTFOLIO_SOURCES.GROWVEST_STANDARD, key].join("|"), 48)}`);
    return { transaction, ref, existingData: existing?.data || null };
  });

  const ulipHoldings = holdings.filter((item) => item.productType === "ulip" && genericHoldingReference(item));
  const policyGroups = new Map();
  ulipHoldings.forEach((holding) => {
    const policyNumber = genericHoldingReference(holding);
    const group = policyGroups.get(policyNumber) || [];
    group.push(holding);
    policyGroups.set(policyNumber, group);
  });
  const policyRefs = [...policyGroups.keys()].map((policyNumber) => adminDb.collection("ulipPolicies").doc(genericPolicyDocumentId(investorId, policyNumber)));
  const policySnapshots = policyRefs.length ? await adminDb.getAll(...policyRefs) : [];
  const policyEntries = [...policyGroups.entries()].map(([policyNumber, funds], index) => ({
    policyNumber,
    funds,
    ref: policyRefs[index],
    existingData: policySnapshots[index]?.exists ? policySnapshots[index].data() : null
  }));

  const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(file.fileFingerprint);
  const fingerprintSnapshot = await fingerprintRef.get();
  const recoveryRef = await createRecoveryJournal({
    batchId,
    file,
    actor,
    investorId,
    fingerprintRef,
    fingerprintSnapshot,
    holdingEntries,
    exitedPositions,
    transactionEntries,
    mappingEntries,
    policyEntries,
    source: PORTFOLIO_SOURCES.GROWVEST_STANDARD
  });

  try {
    const mappingPayload = {
      source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
      externalClientName: file.externalClientName || "",
      normalizedExternalClientName: file.normalizedExternalClientName || "",
      externalPan: file.externalPan || "",
      externalClientCode: file.externalClientCode || "",
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      status: "verified",
      verifiedByUid: actor.uid,
      verifiedByName: actor.fullName || actor.email || "GrowVest User",
      lastSuccessfulImportAt: FieldValue.serverTimestamp(),
      lastSuccessfulImportId: batchId,
      updatedAt: FieldValue.serverTimestamp()
    };
    mappingEntries.forEach((entry) => writer.set(entry.ref, {
      ...mappingPayload,
      identityType: entry.identityType,
      verifiedAt: entry.snapshot.exists ? entry.snapshot.data()?.verifiedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
    }, { merge: true }));

    exitedPositions.forEach((item) => writer.update(item.ref, {
      status: "exited",
      exitDetectedByImportId: batchId,
      exitDetectedByFileId: file.id,
      exitedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: actor.fullName || actor.email || "GrowVest User"
    }));

    holdingEntries.forEach(({ holding, ref, existing }) => {
      const previous = existing || {};
      const recovered = recoveredGenericGoalAllocation(file, holding);
      let goalAllocations = recovered?.goalAllocations || (Array.isArray(previous.goalAllocations) ? previous.goalAllocations : []);
      if (!goalAllocations.length && !existing && holding.requestedGoalName) goalAllocations = requestedGoalAllocation(investor, holding.requestedGoalName);
      const productType = holding.productType || previous.productType || "other";
      const quantity = Number(holding.quantity ?? holding.totalUnits ?? 0);
      const averagePurchaseRate = Number(holding.averagePurchaseRate ?? holding.averageBuyRate ?? holding.averagePurchaseNav ?? 0);
      let totalInvested = Number(holding.totalInvested ?? holding.investedAmount ?? 0);
      let currentRate = Number(holding.currentRate ?? holding.currentNav ?? 0);
      let currentValue = Number(holding.currentValue || 0);
      if (!totalInvested && quantity && averagePurchaseRate) totalInvested = quantity * averagePurchaseRate;
      if (!currentValue && quantity && currentRate) currentValue = quantity * currentRate;
      const gainLoss = currentValue - totalInvested;
      const valuationDate = holding.valuationDate || holding.navDate || file.summary?.valuationDate || file.reportPeriodEnd || "";
      const accountReference = genericHoldingReference(holding);
      const valuationChanged = Boolean(previous.currentValue || previous.currentRate || previous.currentNav || previous.valuationDate) && (
        Number(previous.currentValue || 0) !== currentValue
        || Number(previous.currentRate || previous.currentNav || 0) !== currentRate
        || String(previous.valuationDate || previous.navDate || "") !== String(valuationDate || "")
      );
      writer.set(ref, {
        investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        provider: holding.provider || previous.provider || "GrowVest Standard",
        productType,
        assetClass: holding.assetClass || previous.assetClass || "Other",
        instrumentName: holding.instrumentName || previous.instrumentName || "Investment",
        schemeName: holding.schemeName || previous.schemeName || "",
        stockName: holding.stockName || previous.stockName || "",
        fundName: holding.fundName || previous.fundName || "",
        symbol: holding.symbol || previous.symbol || "",
        isin: holding.isin || previous.isin || "",
        exchange: holding.exchange || previous.exchange || "",
        accountReference,
        folioNo: holding.folioNo || (productType === "mutual_fund" ? accountReference : previous.folioNo || ""),
        policyNumber: holding.policyNumber || (productType === "ulip" ? accountReference : previous.policyNumber || ""),
        investmentMode: holding.investmentMode || previous.investmentMode || "",
        purchaseDate: holding.purchaseDate || previous.purchaseDate || "",
        quantity: Number(quantity.toFixed(6)),
        totalUnits: Number(quantity.toFixed(6)),
        units: Number(quantity.toFixed(6)),
        averagePurchaseRate: Number(averagePurchaseRate.toFixed(6)),
        averageBuyRate: productType === "stock_delivery" ? Number(averagePurchaseRate.toFixed(6)) : Number(previous.averageBuyRate || 0),
        averagePurchaseNav: productType === "mutual_fund" ? Number(averagePurchaseRate.toFixed(6)) : Number(previous.averagePurchaseNav || 0),
        totalInvested: Number(totalInvested.toFixed(2)),
        investedAmount: Number(totalInvested.toFixed(2)),
        currentRate: Number(currentRate.toFixed(6)),
        currentNav: ["mutual_fund", "ulip"].includes(productType) ? Number(currentRate.toFixed(6)) : Number(previous.currentNav || 0),
        currentValue: Number(currentValue.toFixed(2)),
        gainLoss: Number(gainLoss.toFixed(2)),
        returnPercentage: totalInvested > 0 ? Number((gainLoss / totalInvested * 100).toFixed(2)) : 0,
        valuationDate,
        navDate: ["mutual_fund", "ulip"].includes(productType) ? valuationDate : (holding.navDate || previous.navDate || ""),
        priceDate: productType === "stock_delivery" ? valuationDate : (previous.priceDate || ""),
        maturityDate: holding.maturityDate || previous.maturityDate || "",
        previousRate: valuationChanged ? Number(previous.currentRate || previous.currentNav || 0) : Number(previous.previousRate || 0),
        previousNav: valuationChanged ? Number(previous.currentNav || previous.currentRate || 0) : Number(previous.previousNav || 0),
        previousCurrentValue: valuationChanged ? Number(previous.currentValue || 0) : Number(previous.previousCurrentValue || 0),
        previousValuationDate: valuationChanged ? (previous.valuationDate || previous.navDate || previous.priceDate || "") : (previous.previousValuationDate || ""),
        goalAllocations,
        allocationStatus: goalAllocations.length ? (recovered?.allocationStatus || previous.allocationStatus || "allocated") : "general_wealth",
        requestedGoalName: holding.requestedGoalName || "",
        goalImportReviewRequired: Boolean(holding.requestedGoalName && !goalAllocations.length && !/general wealth|unassigned/i.test(holding.requestedGoalName)),
        notes: holding.notes || previous.notes || "",
        status: currentValue > 0 || quantity > 0 || totalInvested > 0 ? "active" : "inactive",
        valuationSourceReportType: file.reportType || "",
        mappingProfileId: file.mappingProfileId || "",
        sourceImportId: batchId,
        sourceImportFileId: file.id,
        sourceFileName: file.fileName || "",
        createdAt: previous.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    });

    transactionEntries.forEach(({ transaction, ref, existingData }) => {
      const previous = existingData || {};
      const amount = Number(transaction.amount ?? transaction.purchaseAmount ?? 0);
      const quantity = Number(transaction.quantity ?? transaction.units ?? 0);
      const rate = Number(transaction.transactionRate ?? transaction.purchaseNav ?? 0);
      writer.set(ref, {
        investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        provider: transaction.provider || previous.provider || "GrowVest Standard",
        productType: transaction.productType || previous.productType || "other",
        instrumentName: transaction.instrumentName || previous.instrumentName || "Investment",
        symbol: transaction.symbol || previous.symbol || "",
        isin: transaction.isin || previous.isin || "",
        accountReference: transaction.accountReference || previous.accountReference || "",
        folioNo: transaction.folioNo || previous.folioNo || "",
        policyNumber: transaction.policyNumber || previous.policyNumber || "",
        transactionDate: transaction.transactionDate || "",
        transactionType: transaction.transactionType || "Other",
        transactionReference: transaction.transactionReference || transaction.externalTransactionId || previous.transactionReference || "",
        externalTransactionId: transaction.externalTransactionId || transaction.transactionReference || previous.externalTransactionId || "",
        investmentMode: transaction.investmentMode || "",
        quantity: Number(quantity.toFixed(6)),
        units: Number(quantity.toFixed(6)),
        transactionRate: Number(rate.toFixed(6)),
        purchaseNav: Number(rate.toFixed(6)),
        amount: Number(amount.toFixed(2)),
        purchaseAmount: Number(amount.toFixed(2)),
        cashFlowType: transaction.cashFlowType || "review",
        notes: transaction.notes || previous.notes || "",
        sourceRow: transaction.sourceRow || null,
        mappingProfileId: file.mappingProfileId || "",
        sourceImportId: batchId,
        sourceImportFileId: file.id,
        sourceFileName: file.fileName || "",
        createdByUid: previous.createdByUid || actor.uid,
        createdByName: previous.createdByName || actor.fullName || actor.email || "GrowVest User",
        createdAt: previous.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    policyEntries.forEach(({ policyNumber, funds, ref, existingData }) => {
      const previous = existingData || {};
      const currentFundValue = funds.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
      const totalPremiumPaid = Math.max(...funds.map((item) => Number(item.totalInvested || item.investedAmount || 0)), 0);
      const latestNavDate = funds.map((item) => item.navDate || item.valuationDate || "").filter(Boolean).sort().at(-1) || "";
      writer.set(ref, {
        investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        provider: funds[0]?.provider || previous.provider || "ULIP Provider",
        insurer: funds[0]?.provider || previous.insurer || "ULIP Provider",
        policyNumber,
        planName: previous.planName || "",
        totalPremiumPaid: Number(totalPremiumPaid.toFixed(2)),
        currentFundValue: Number(currentFundValue.toFixed(2)),
        fundCount: funds.length,
        latestNavDate,
        maturityDate: funds.map((item) => item.maturityDate).filter(Boolean).sort().at(-1) || previous.maturityDate || "",
        policyStatus: previous.policyStatus || "Active",
        status: "active",
        sourceImportId: batchId,
        sourceImportFileId: file.id,
        sourceFileName: file.fileName || "",
        createdAt: previous.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    });

    writer.set(fingerprintRef, {
      source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
      batchId,
      fileId: file.id,
      investorId,
      importedAt: FieldValue.serverTimestamp(),
      importedByUid: actor.uid
    }, { merge: true });
    writer.update(fileRef, {
      matchedInvestorId: investorId,
      matchedInvestorName: investor.fullName || "",
      matchedClientCode: investor.clientCode || "",
      matchStatus: PORTFOLIO_MATCH_STATUS.VERIFIED,
      status: "imported",
      importedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await writer.flush();

    await recoveryRef.update({
      status: "committed",
      committedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }).catch(async (journalError) => {
      console.error("Generic portfolio recovery journal finalisation failed", journalError);
      await fileRef.set({ recoveryJournalError: journalError?.message || "Recovery journal could not be finalised." }, { merge: true }).catch(() => {});
    });

    return {
      fileId: file.id,
      fileName: file.fileName,
      status: "imported",
      investorId,
      investorName: investor.fullName || "",
      positionCount: holdings.length,
      newPositionCount: holdingEntries.filter((item) => !item.existing).length,
      exitedPositionCount: exitedPositions.length,
      transactionCount: transactions.length,
      currentValue: Number(file.summary?.currentValue || 0)
    };
  } catch (error) {
    await recoveryRef.set({
      status: "commit_failed",
      reversible: true,
      failureReason: error?.message || "GrowVest Standard import failed",
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
    throw error;
  }
}

function ulipMappingDescriptors(file = {}) {
  const source = PORTFOLIO_SOURCES.ULIP;
  const rows = [];
  if (file.normalizedExternalClientName) rows.push({ identityType: "client_name", id: `${source}_name_${stableHash(file.normalizedExternalClientName, 32)}` });
  if (file.externalPan) rows.push({ identityType: "pan", id: `${source}_pan_${stableHash(String(file.externalPan).toUpperCase(), 32)}` });
  if (file.externalClientCode) rows.push({ identityType: "client_code", id: `${source}_client_${stableHash(String(file.externalClientCode).toUpperCase(), 32)}` });
  (file.policies || []).forEach((policy) => {
    const policyNumber = String(policy?.policyNumber || "").trim().toUpperCase();
    if (policyNumber) rows.push({ identityType: "policy_number", id: `${source}_policy_${stableHash(policyNumber, 32)}` });
  });
  return rows.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
}

async function loadUlipMappingEntries(file = {}) {
  const descriptors = ulipMappingDescriptors(file);
  if (!descriptors.length) return [];
  const refs = descriptors.map((item) => adminDb.collection("externalInvestorMappings").doc(item.id));
  const snapshots = await adminDb.getAll(...refs);
  return descriptors.map((item, index) => ({ ...item, ref: refs[index], snapshot: snapshots[index] }));
}

function sameUlipHolding(existing = {}, holding = {}) {
  if (existing.source !== PORTFOLIO_SOURCES.ULIP || existing.productType !== "ulip") return false;
  if (String(existing.policyNumber || "").trim().toUpperCase() !== String(holding.policyNumber || "").trim().toUpperCase()) return false;
  const leftCode = String(existing.fundCode || "").trim().toUpperCase();
  const rightCode = String(holding.fundCode || "").trim().toUpperCase();
  if (leftCode && rightCode) return leftCode === rightCode;
  return normaliseExternalName(existing.fundName || existing.instrumentName || "") === normaliseExternalName(holding.fundName || holding.instrumentName || "");
}

function recoveredUlipGoalAllocation(file = {}, holding = {}) {
  const rows = Array.isArray(file.recoveryGoalAllocations) ? file.recoveryGoalAllocations : [];
  return rows.find((item) => {
    const samePolicy = String(item.policyNumber || item.folioNo || "").trim().toUpperCase() === String(holding.policyNumber || "").trim().toUpperCase();
    if (!samePolicy) return false;
    if (item.fundCode && holding.fundCode) return String(item.fundCode).trim().toUpperCase() === String(holding.fundCode).trim().toUpperCase();
    return normaliseExternalName(item.instrumentName || "") === normaliseExternalName(holding.fundName || holding.instrumentName || "");
  }) || null;
}

function ulipPolicyDocumentId(investorId, policyNumber = "") {
  return `ulip_${stableHash([investorId, String(policyNumber).trim().toUpperCase()].join("|"), 40)}`;
}

async function commitUlipFile({ actor, batchId, file, fileRef, investor, investorId, writer }) {
  const mappingEntries = await loadUlipMappingEntries(file);
  for (const entry of mappingEntries) {
    if (entry.snapshot.exists && entry.snapshot.data()?.investorId !== investorId) {
      throw new Error(`This ULIP ${entry.identityType.replaceAll("_", " ")} is already mapped to another GrowVest investor.`);
    }
  }

  const holdings = Array.isArray(file.holdings) ? file.holdings : [];
  const policies = Array.isArray(file.policies) ? file.policies : [];
  if (!holdings.length || !policies.length) throw new Error("This ULIP report does not contain usable policy/fund positions.");

  // Policy numbers are ownership identifiers. They must never silently move
  // between investors because a name match changed.
  for (const policy of policies) {
    const policyNumber = String(policy.policyNumber || "").trim();
    if (!policyNumber) continue;
    const policySnapshot = await adminDb.collection("ulipPolicies").where("policyNumber", "==", policyNumber).get();
    const conflict = policySnapshot.docs.find((item) => item.data()?.investorId && item.data().investorId !== investorId);
    if (conflict) throw new Error(`ULIP policy ${policyNumber} is already linked to another GrowVest investor.`);
  }

  const investorPositionSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
  const investorPositions = investorPositionSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
  const holdingEntries = holdings.map((holding) => {
    const existing = investorPositions.find((item) => sameUlipHolding(item, holding));
    const ref = existing?.ref || adminDb.collection("portfolioPositions").doc(positionDocumentId({
      investorId,
      source: PORTFOLIO_SOURCES.ULIP,
      isin: "",
      symbol: holding.fundCode || "",
      folioNo: holding.policyNumber || "",
      instrumentName: holding.fundName || holding.instrumentName || "ULIP Fund"
    }));
    return { holding, ref, existing: existing || null };
  });

  // Missing funds are not automatically marked switched/exited until a real
  // insurer export proves the report is an authoritative full-policy snapshot.
  const exitedPositions = [];

  const policyRefs = policies.map((policy) => adminDb.collection("ulipPolicies").doc(ulipPolicyDocumentId(investorId, policy.policyNumber)));
  const policySnapshots = policyRefs.length ? await adminDb.getAll(...policyRefs) : [];
  const policyEntries = policies.map((policy, index) => ({
    policy,
    ref: policyRefs[index],
    existingData: policySnapshots[index]?.exists ? policySnapshots[index].data() : null
  }));

  const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(file.fileFingerprint);
  const fingerprintSnapshot = await fingerprintRef.get();
  const recoveryRef = await createRecoveryJournal({
    batchId,
    file,
    actor,
    investorId,
    fingerprintRef,
    fingerprintSnapshot,
    holdingEntries,
    exitedPositions,
    transactionEntries: [],
    mappingEntries,
    policyEntries,
    source: PORTFOLIO_SOURCES.ULIP
  });

  try {
    const mappingPayload = {
      source: PORTFOLIO_SOURCES.ULIP,
      externalClientName: file.externalClientName || "",
      normalizedExternalClientName: file.normalizedExternalClientName || "",
      externalPan: file.externalPan || "",
      externalClientCode: file.externalClientCode || "",
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      status: "verified",
      verifiedByUid: actor.uid,
      verifiedByName: actor.fullName || actor.email || "GrowVest User",
      lastSuccessfulImportAt: FieldValue.serverTimestamp(),
      lastSuccessfulImportId: batchId,
      updatedAt: FieldValue.serverTimestamp()
    };
    mappingEntries.forEach((entry) => writer.set(entry.ref, {
      ...mappingPayload,
      identityType: entry.identityType,
      verifiedAt: entry.snapshot.exists ? entry.snapshot.data()?.verifiedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
    }, { merge: true }));

    policyEntries.forEach(({ policy, ref, existingData }) => {
      const previous = existingData || {};
      writer.set(ref, {
        investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.ULIP,
        provider: policy.provider || policy.insurer || previous.provider || "ULIP Provider",
        insurer: policy.insurer || policy.provider || previous.insurer || "ULIP Provider",
        policyNumber: policy.policyNumber || previous.policyNumber || "",
        planName: policy.planName || previous.planName || "",
        policyStartDate: policy.policyStartDate || previous.policyStartDate || "",
        premiumAmount: Number(policy.premiumAmount || previous.premiumAmount || 0),
        premiumFrequency: policy.premiumFrequency || previous.premiumFrequency || "",
        totalPremiumPaid: Number(policy.totalPremiumPaid || previous.totalPremiumPaid || 0),
        maturityDate: policy.maturityDate || previous.maturityDate || "",
        sumAssured: Number(policy.sumAssured || previous.sumAssured || 0),
        currentFundValue: Number(policy.currentFundValue || 0),
        fundCount: Number(policy.fundCount || 0),
        latestNavDate: policy.latestNavDate || file.summary?.navDate || file.reportPeriodEnd || "",
        policyStatus: policy.policyStatus || previous.policyStatus || "Active",
        requestedGoalName: policy.requestedGoalName || "",
        status: /lapse|terminated|surrendered|matured|closed/i.test(policy.policyStatus || "") ? "inactive" : "active",
        sourceImportId: batchId,
        sourceImportFileId: file.id,
        sourceFileName: file.fileName || "",
        createdAt: previous.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    });

    holdingEntries.forEach(({ holding, ref, existing }) => {
      const previous = existing || {};
      const recovered = recoveredUlipGoalAllocation(file, holding);
      let goalAllocations = recovered?.goalAllocations || (Array.isArray(previous.goalAllocations) ? previous.goalAllocations : []);
      if (!goalAllocations.length && !existing && holding.requestedGoalName) goalAllocations = requestedGoalAllocation(investor, holding.requestedGoalName);
      const navDate = holding.navDate || holding.valuationDate || file.summary?.navDate || file.reportPeriodEnd || "";
      const currentValue = Number(holding.currentValue || 0);
      const totalUnits = Number(holding.totalUnits || 0);
      const currentNav = Number(holding.currentNav || (totalUnits > 0 ? currentValue / totalUnits : 0));
      const fundCost = Number(holding.totalInvested ?? holding.allocatedInvestedAmount ?? 0);
      const gainLossAvailable = fundCost > 0;
      const gainLoss = gainLossAvailable ? currentValue - fundCost : 0;
      const valuationChanged = Boolean(previous.currentValue || previous.currentNav || previous.navDate) && (
        Number(previous.currentValue || 0) !== currentValue
        || Number(previous.currentNav || 0) !== currentNav
        || String(previous.navDate || "") !== String(navDate || "")
      );
      writer.set(ref, {
        investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.ULIP,
        provider: holding.provider || holding.insurer || "ULIP Provider",
        insurer: holding.insurer || holding.provider || "ULIP Provider",
        productType: "ulip",
        assetClass: "Insurance",
        instrumentName: holding.fundName || holding.instrumentName || previous.instrumentName || "ULIP Fund",
        fundName: holding.fundName || holding.instrumentName || previous.fundName || "",
        fundCode: holding.fundCode || previous.fundCode || "",
        policyNumber: holding.policyNumber || previous.policyNumber || "",
        folioNo: holding.policyNumber || previous.folioNo || "",
        planName: holding.planName || previous.planName || "",
        policyStartDate: holding.policyStartDate || previous.policyStartDate || "",
        premiumAmount: Number(holding.premiumAmount || previous.premiumAmount || 0),
        premiumFrequency: holding.premiumFrequency || previous.premiumFrequency || "",
        policyTotalPremiumPaid: Number(holding.policyTotalPremiumPaid || previous.policyTotalPremiumPaid || 0),
        maturityDate: holding.maturityDate || previous.maturityDate || "",
        sumAssured: Number(holding.sumAssured || previous.sumAssured || 0),
        policyStatus: holding.policyStatus || previous.policyStatus || "Active",
        investmentMode: "ULIP Fund",
        totalUnits: Number(totalUnits.toFixed(6)),
        currentNav: Number(currentNav.toFixed(6)),
        navDate,
        valuationDate: navDate,
        totalInvested: Number(fundCost.toFixed(2)),
        investedAmount: Number(fundCost.toFixed(2)),
        gainLossAvailable,
        currentValue: Number(currentValue.toFixed(2)),
        gainLoss: Number(gainLoss.toFixed(2)),
        returnPercentage: gainLossAvailable && fundCost > 0 ? Number((gainLoss / fundCost * 100).toFixed(2)) : 0,
        previousNav: valuationChanged ? Number(previous.currentNav || 0) : Number(previous.previousNav || 0),
        previousNavDate: valuationChanged ? (previous.navDate || "") : (previous.previousNavDate || ""),
        previousCurrentValue: valuationChanged ? Number(previous.currentValue || 0) : Number(previous.previousCurrentValue || 0),
        previousValuationDate: valuationChanged ? (previous.valuationDate || previous.navDate || "") : (previous.previousValuationDate || ""),
        goalAllocations,
        allocationStatus: goalAllocations.length ? (recovered?.allocationStatus || previous.allocationStatus || "allocated") : "general_wealth",
        requestedGoalName: holding.requestedGoalName || "",
        goalImportReviewRequired: Boolean(holding.requestedGoalName && !goalAllocations.length && !/general wealth|unassigned/i.test(holding.requestedGoalName)),
        notes: holding.notes || previous.notes || "",
        status: currentValue > 0 || totalUnits > 0 ? "active" : "inactive",
        valuationSourceReportType: file.reportType || "",
        sourceImportId: batchId,
        sourceImportFileId: file.id,
        sourceFileName: file.fileName || "",
        createdAt: previous.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    });

    writer.set(fingerprintRef, {
      source: PORTFOLIO_SOURCES.ULIP,
      batchId,
      fileId: file.id,
      investorId,
      importedAt: FieldValue.serverTimestamp(),
      importedByUid: actor.uid
    }, { merge: true });
    writer.update(fileRef, {
      matchedInvestorId: investorId,
      matchedInvestorName: investor.fullName || "",
      matchedClientCode: investor.clientCode || "",
      matchStatus: PORTFOLIO_MATCH_STATUS.VERIFIED,
      status: "imported",
      importedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await writer.flush();

    await recoveryRef.update({
      status: "committed",
      committedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }).catch(async (journalError) => {
      console.error("ULIP recovery journal finalisation failed", journalError);
      await fileRef.set({ recoveryJournalError: journalError?.message || "Recovery journal could not be finalised." }, { merge: true }).catch(() => {});
    });

    return {
      fileId: file.id,
      fileName: file.fileName,
      status: "imported",
      investorId,
      investorName: investor.fullName || "",
      positionCount: holdings.length,
      policyCount: policies.length,
      newPositionCount: holdingEntries.filter((item) => !item.existing).length,
      exitedPositionCount: 0,
      transactionCount: 0,
      currentValue: Number(file.summary?.currentValue || 0)
    };
  } catch (error) {
    await recoveryRef.set({
      status: "commit_failed",
      reversible: true,
      failureReason: error?.message || "ULIP import failed",
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
    throw error;
  }
}


export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const payload = await request.json();
    const batchId = String(payload?.batchId || "").trim();
    if (!batchId) return Response.json({ error: "Portfolio import batch is required." }, { status: 400 });

    const batchRef = adminDb.collection("portfolioImports").doc(batchId);
    const batchSnapshot = await batchRef.get();
    if (!batchSnapshot.exists) return Response.json({ error: "Portfolio import batch was not found." }, { status: 404 });
    const batch = batchSnapshot.data();
    if (batch.advisorUid !== actor.uid && !["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "You are not authorised to process this import batch." }, { status: 403 });
    }
    if (batch.status === PORTFOLIO_IMPORT_STATUS.COMPLETED) {
      return Response.json({ error: "This import batch has already been completed." }, { status: 409 });
    }

    const decisions = new Map((payload?.mappings || []).map((item) => [item.fileId, item]));
    const fileIds = Array.isArray(batch.fileIds) ? batch.fileIds : [];
    const fileSnapshots = fileIds.length
      ? await adminDb.getAll(...fileIds.map((id) => adminDb.collection("portfolioImportFiles").doc(id)))
      : [];
    const hasFundbazaarFiles = fileSnapshots.some((snapshot) => snapshot.exists && snapshot.data()?.source === PORTFOLIO_SOURCES.FUNDBAZAAR);

    await batchRef.update({ status: PORTFOLIO_IMPORT_STATUS.PROCESSING, processingStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

    const results = [];
    const affectedInvestors = new Map();
    const writer = adminDb.bulkWriter();

    for (const fileSnapshot of fileSnapshots) {
      if (!fileSnapshot.exists) continue;
      const file = { id: fileSnapshot.id, ...fileSnapshot.data() };
      const fileRef = fileSnapshot.ref;

      if (["failed", "unsupported", "needs_package"].includes(file.status)) {
        results.push({ fileId: file.id, fileName: file.fileName, status: file.status, error: file.parseError || "This report is not ready for automatic import." });
        continue;
      }
      if (file.matchStatus === PORTFOLIO_MATCH_STATUS.DUPLICATE) {
        results.push({ fileId: file.id, fileName: file.fileName, status: "duplicate" });
        continue;
      }

      const decision = decisions.get(file.id) || {};
      let investorId = file.matchStatus === PORTFOLIO_MATCH_STATUS.VERIFIED ? file.matchedInvestorId : String(decision.investorId || file.matchedInvestorId || "");
      let recoveryRef = null;
      if (!investorId) {
        writer.update(fileRef, { status: "review_required", updatedAt: FieldValue.serverTimestamp() });
        results.push({ fileId: file.id, fileName: file.fileName, status: "review_required", error: "Investor mapping is required." });
        continue;
      }

      try {
        const investor = await getAccessibleInvestor(actor, investorId);
        if (file.source === PORTFOLIO_SOURCES.BAJAJ_BROKING) {
          const bajajResult = await commitBajajFile({ actor, batchId, file, fileRef, investor, investorId, writer });
          affectedInvestors.set(investorId, investor);
          results.push(bajajResult);
          continue;
        }
        if (file.source === PORTFOLIO_SOURCES.ULIP) {
          const ulipResult = await commitUlipFile({ actor, batchId, file, fileRef, investor, investorId, writer });
          affectedInvestors.set(investorId, investor);
          results.push(ulipResult);
          continue;
        }
        if (file.source === PORTFOLIO_SOURCES.GROWVEST_STANDARD) {
          const genericResult = await commitGenericFile({ actor, batchId, file, fileRef, investor, investorId, writer });
          affectedInvestors.set(investorId, investor);
          results.push(genericResult);
          continue;
        }
        if (file.source !== PORTFOLIO_SOURCES.FUNDBAZAAR) {
          throw new Error("This portfolio source is not enabled for automatic commit yet.");
        }
        await assertFundbazaarValuationFormat({ file, investor, batchId });
        const mappingId = mappingDocumentId(file.normalizedExternalClientName);
        const panMappingId = panMappingDocumentId(file.externalPan);
        const mappingRef = adminDb.collection("externalInvestorMappings").doc(mappingId);
        const panMappingRef = panMappingId ? adminDb.collection("externalInvestorMappings").doc(panMappingId) : null;
        const [mappingSnapshot, panMappingSnapshot] = await Promise.all([
          mappingRef.get(),
          panMappingRef ? panMappingRef.get() : Promise.resolve(null)
        ]);
        if (mappingSnapshot.exists && mappingSnapshot.data()?.investorId !== investorId) {
          throw new Error("This Fundbazaar client identity is already mapped to another GrowVest investor.");
        }
        if (panMappingSnapshot?.exists && panMappingSnapshot.data()?.investorId !== investorId) {
          throw new Error("This Fundbazaar PAN is already mapped to another GrowVest investor.");
        }

        // Folio ownership is a stronger check than a client-name suggestion.
        // Client Wise Valuation can also use ISIN; Ledger files may not contain ISIN.
        for (const holding of (file.holdings || [])) {
          if (!holding.folioNo) continue;
          const folioSnapshot = await adminDb.collection("portfolioPositions").where("folioNo", "==", holding.folioNo).get();
          const ownershipConflict = folioSnapshot.docs.find((item) => {
            const data = item.data();
            if (data.source !== PORTFOLIO_SOURCES.FUNDBAZAAR || !data.investorId || data.investorId === investorId) return false;
            if (holding.isin && data.isin) return String(data.isin) === String(holding.isin);
            return normaliseExternalName(data.schemeName || data.instrumentName) === normaliseExternalName(holding.schemeName || holding.instrumentName);
          });
          if (ownershipConflict) {
            throw new Error(`Portfolio ownership conflict for folio ${holding.folioNo}. This holding is already linked to another investor.`);
          }
        }

        const mappingPayload = {
          source: PORTFOLIO_SOURCES.FUNDBAZAAR,
          externalClientName: file.externalClientName,
          normalizedExternalClientName: file.normalizedExternalClientName,
          externalPan: file.externalPan || "",
          investorId,
          investorName: investor.fullName || "",
          clientCode: investor.clientCode || "",
          advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
          status: "verified",
          verifiedByUid: actor.uid,
          verifiedByName: actor.fullName || actor.email || "GrowVest User",
          lastSuccessfulImportAt: FieldValue.serverTimestamp(),
          lastSuccessfulImportId: batchId,
          updatedAt: FieldValue.serverTimestamp()
        };

        const investorPositionSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
        const investorPositions = investorPositionSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
        const previousFundbazaarPositions = investorPositions.filter((item) => item.source === PORTFOLIO_SOURCES.FUNDBAZAAR && item.status !== "exited");

        const holdingEntries = (file.holdings || []).map((holding) => {
          const existingPosition = investorPositions.find((item) => sameFundHolding(item, holding));
          const ref = existingPosition?.ref || adminDb.collection("portfolioPositions").doc(positionDocumentId({
            investorId,
            source: PORTFOLIO_SOURCES.FUNDBAZAAR,
            isin: holding.isin,
            folioNo: holding.folioNo,
            instrumentName: holding.instrumentName
          }));
          return { holding, ref, existing: existingPosition || null };
        });
        const currentPositionIds = new Set(holdingEntries.map((item) => item.ref.id));
        // Only the Client Wise Valuation report is authoritative for the complete
        // current holding set. A Ledger may be generated for a date range, so a
        // holding missing from a Ledger must never be marked exited automatically.
        const exitedPositions = file.reportType === PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION
          ? previousFundbazaarPositions.filter((item) => !currentPositionIds.has(item.id))
          : [];
        const newPositionCount = holdingEntries.filter((item) => !item.existing).length;
        const isLedger = file.reportType === PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_LEDGER;

        const transactionSnapshot = await adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get();
        const transactionRefByKey = new Map();
        transactionSnapshot.docs.forEach((item) => {
          const data = item.data();
          if (data.source !== PORTFOLIO_SOURCES.FUNDBAZAAR) return;
          transactionRefByKey.set(canonicalTransactionKey(data), { ref: item.ref, data });
        });
        const transactionEntries = (file.transactions || []).map((transaction) => {
          const identityKey = canonicalTransactionKey(transaction);
          const existingTransaction = transactionRefByKey.get(identityKey) || null;
          let transactionRef = existingTransaction?.ref || null;
          if (!transactionRef) {
            const transactionId = transactionDocumentId({
              investorId,
              source: PORTFOLIO_SOURCES.FUNDBAZAAR,
              isin: transaction.isin || "",
              folioNo: transaction.folioNo || "",
              transactionDate: transaction.transactionDate || "",
              transactionType: transactionKind(transaction.transactionType || transaction.sourceTransactionType),
              purchaseAmount: Number(transaction.purchaseAmount ?? transaction.investedAmount ?? 0),
              purchaseNav: Number(transaction.purchaseNav ?? transaction.navRate ?? 0),
              units: Math.abs(Number(transaction.units || 0))
            });
            transactionRef = adminDb.collection("investmentTransactions").doc(transactionId);
            transactionRefByKey.set(identityKey, { ref: transactionRef, data: {} });
          }
          return {
            transaction,
            identityKey,
            ref: transactionRef,
            existingData: existingTransaction?.data || null
          };
        });

        const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(file.fileFingerprint);
        const fingerprintSnapshot = await fingerprintRef.get();
        recoveryRef = await createRecoveryJournal({
          batchId,
          file,
          actor,
          investorId,
          mappingRef,
          mappingSnapshot,
          panMappingRef,
          panMappingSnapshot,
          fingerprintRef,
          fingerprintSnapshot,
          holdingEntries,
          exitedPositions,
          transactionEntries
        });

        writer.set(mappingRef, {
          ...mappingPayload,
          identityType: "client_name",
          coverageEnabled: mappingSnapshot.exists ? mappingSnapshot.data()?.coverageEnabled !== false : true,
          verifiedAt: mappingSnapshot.exists ? mappingSnapshot.data()?.verifiedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
        }, { merge: true });
        if (panMappingRef) {
          writer.set(panMappingRef, {
            ...mappingPayload,
            identityType: "pan",
            coverageEnabled: panMappingSnapshot?.exists ? panMappingSnapshot.data()?.coverageEnabled !== false : true,
            verifiedAt: panMappingSnapshot?.exists ? panMappingSnapshot.data()?.verifiedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
          }, { merge: true });
        }

        exitedPositions.forEach((item) => {
          writer.update(item.ref, {
            status: "exited",
            exitDetectedByImportId: batchId,
            exitDetectedByFileId: file.id,
            exitedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByName: actor.fullName || actor.email || "GrowVest User"
          });
        });

        holdingEntries.forEach(({ holding, ref: positionRef, existing: existingPosition }) => {
          const existing = existingPosition || {};
          const recoveredGoal = recoveredGoalAllocation(file, holding);
          const preservedGoalAllocations = recoveredGoal
            ? (Array.isArray(recoveredGoal.goalAllocations) ? recoveredGoal.goalAllocations : [])
            : (Array.isArray(existing.goalAllocations) ? existing.goalAllocations : []);
          const parsedNavDate = holding.navDate || file.summary?.navDate || file.reportPeriodEnd || "";
          const parsedNav = Number(holding.currentNav || 0);
          const parsedCurrentValue = Number(holding.currentValue || 0);
          const existingNavDate = existing.navDate || existing.valuationDate || "";
          const preservePreciseValuation = isLedger
            && Boolean(Number(existing.currentValue || 0))
            && Boolean(existingNavDate)
            && (!parsedNavDate || String(existingNavDate) >= String(parsedNavDate));
          const nextNav = preservePreciseValuation ? Number(existing.currentNav || 0) : parsedNav;
          const nextNavDate = preservePreciseValuation ? existingNavDate : parsedNavDate;
          const nextCurrentValue = preservePreciseValuation ? Number(existing.currentValue || 0) : parsedCurrentValue;
          const ledgerBasisIsCurrent = Boolean(existing.ledgerReportPeriodEnd)
            && Boolean(nextNavDate)
            && String(existing.ledgerReportPeriodEnd) >= String(nextNavDate);
          const totalInvested = !isLedger && ledgerBasisIsCurrent
            ? Number(existing.ledgerTotalInvested ?? existing.ledgerNetInvestment ?? existing.totalInvested ?? holding.totalInvested ?? 0)
            : Number(holding.totalInvested || 0);
          const totalUnits = !isLedger && ledgerBasisIsCurrent
            ? Number(existing.ledgerTotalUnits ?? existing.totalUnits ?? holding.totalUnits ?? 0)
            : Number(holding.totalUnits || 0);
          const averagePurchaseNav = totalUnits > 0 && totalInvested > 0
            ? totalInvested / totalUnits
            : Number(holding.averagePurchaseNav || existing.averagePurchaseNav || 0);
          const computedGainLoss = nextCurrentValue - totalInvested + Number(isLedger ? holding.dividendPayout || 0 : 0);
          const nextGainLoss = isLedger || ledgerBasisIsCurrent ? computedGainLoss : Number(holding.gainLoss || computedGainLoss);
          const nextReturnPercentage = totalInvested > 0
            ? (nextGainLoss / totalInvested) * 100
            : Number(holding.returnPercentage || 0);
          const hadPreviousValuation = Boolean(existing.navDate || existing.valuationDate || existing.currentNav || existing.currentValue);
          const valuationChanged = hadPreviousValuation && !preservePreciseValuation && (
            String(nextNavDate || "") !== String(existingNavDate || "")
            || nextNav !== Number(existing.currentNav || 0)
            || nextCurrentValue !== Number(existing.currentValue || 0)
          );
          const previousValuation = valuationChanged ? {
            previousNav: Number(existing.currentNav || 0),
            previousNavDate: existingNavDate,
            previousCurrentValue: Number(existing.currentValue || 0),
            previousValuationDate: existing.valuationDate || existing.navDate || "",
            valuationChangedAt: FieldValue.serverTimestamp()
          } : {
            previousNav: Number(existing.previousNav || 0),
            previousNavDate: existing.previousNavDate || "",
            previousCurrentValue: Number(existing.previousCurrentValue || 0),
            previousValuationDate: existing.previousValuationDate || ""
          };

          const ledgerFields = isLedger ? {
            ledgerNetInvestment: Number(holding.netInvestment ?? holding.totalInvested ?? 0),
            ledgerTotalInvested: Number(holding.totalInvested || 0),
            ledgerGrossPurchaseAmount: Number(holding.grossPurchaseAmount || 0),
            ledgerSwitchInAmount: Number(holding.switchInAmount || 0),
            ledgerRedemptionAmount: Number(holding.redemptionAmount || 0),
            ledgerSwitchOutAmount: Number(holding.switchOutAmount || 0),
            ledgerDividendPayout: Number(holding.dividendPayout || 0),
            ledgerTotalUnits: Number(holding.totalUnits || 0),
            ledgerReportPeriodStart: file.reportPeriodStart || "",
            ledgerReportPeriodEnd: file.reportPeriodEnd || parsedNavDate || "",
            ledgerReconciledAt: FieldValue.serverTimestamp(),
            ledgerSourceImportId: batchId,
            ledgerSourceImportFileId: file.id
          } : {};

          writer.set(positionRef, {
            investorId,
            investorName: investor.fullName || "",
            clientCode: investor.clientCode || "",
            advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
            assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
            investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
            source: PORTFOLIO_SOURCES.FUNDBAZAAR,
            provider: "Fundbazaar",
            productType: holding.productType,
            assetClass: holding.assetClass || existing.assetClass || "Other",
            instrumentName: holding.instrumentName || existing.instrumentName || "",
            schemeName: holding.schemeName || existing.schemeName || "",
            isin: holding.isin || existing.isin || "",
            folioNo: holding.folioNo || existing.folioNo || "",
            nature: holding.nature || existing.nature || "",
            investmentMode: holding.investmentMode || existing.investmentMode || "Lump Sum",
            totalInvested: Number(totalInvested.toFixed(2)),
            totalUnits: Number(totalUnits.toFixed(6)),
            averagePurchaseNav: Number(averagePurchaseNav.toFixed(6)),
            ...previousValuation,
            currentNav: Number(nextNav.toFixed(6)),
            navDate: nextNavDate,
            valuationDate: nextNavDate,
            currentValue: Number(nextCurrentValue.toFixed(2)),
            gainLoss: Number(nextGainLoss.toFixed(2)),
            returnPercentage: Number(nextReturnPercentage.toFixed(2)),
            weightedCagr: Number(holding.weightedCagr || existing.weightedCagr || 0),
            monthlySip: Number(holding.monthlySip || existing.monthlySip || 0),
            transactionCount: Math.max(Number(holding.transactionCount || 0), Number(existing.transactionCount || 0)),
            goalAllocations: preservedGoalAllocations,
            allocationStatus: preservedGoalAllocations.length ? (recoveredGoal?.allocationStatus || existing.allocationStatus || "allocated") : "general_wealth",
            status: "active",
            valuationSourceReportType: preservePreciseValuation ? (existing.valuationSourceReportType || "") : file.reportType || "",
            sourceImportId: batchId,
            sourceImportFileId: file.id,
            sourceFileName: file.fileName,
            ...ledgerFields,
            createdAt: existing.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByName: actor.fullName || actor.email || "GrowVest User"
          }, { merge: true });
        });

        transactionEntries.forEach(({ transaction, identityKey, ref: transactionRef, existingData }) => {
          const existingTxn = existingData || {};
          const amount = Number(transaction.purchaseAmount ?? transaction.investedAmount ?? existingTxn.amount ?? 0);
          const purchaseNav = Number(transaction.purchaseNav ?? transaction.navRate ?? existingTxn.purchaseNav ?? 0);
          writer.set(transactionRef, {
            investorId,
            investorName: investor.fullName || "",
            clientCode: investor.clientCode || "",
            advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
            investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
            source: PORTFOLIO_SOURCES.FUNDBAZAAR,
            provider: "Fundbazaar",
            productType: "mutual_fund",
            schemeName: transaction.schemeName || existingTxn.schemeName || "",
            instrumentName: transaction.schemeName || existingTxn.instrumentName || existingTxn.schemeName || "",
            isin: transaction.isin || existingTxn.isin || "",
            folioNo: transaction.folioNo || existingTxn.folioNo || "",
            transactionDate: transaction.transactionDate || "",
            transactionType: transaction.transactionType || transaction.sourceTransactionType || "",
            sourceTransactionType: transaction.sourceTransactionType || transaction.transactionType || "",
            transactionKind: transactionKind(transaction.transactionType || transaction.sourceTransactionType),
            transactionIdentityKey: identityKey,
            investmentMode: transaction.investmentMode || "Other",
            cashFlowType: cashFlowType(transaction.transactionType || transaction.sourceTransactionType),
            amount,
            purchaseNav,
            units: Number(transaction.units || 0),
            signedUnits: Number(transaction.signedUnits ?? transaction.units ?? 0),
            balanceUnits: Number(transaction.balanceUnits || 0),
            currentNav: Number(transaction.currentNav || 0),
            navDate: transaction.navDate || "",
            currentValue: Number(transaction.currentAmount || 0),
            gainLoss: Number(transaction.gainLoss ?? transaction.profitLoss ?? 0),
            sourceImportId: batchId,
            sourceImportFileId: file.id,
            sourceReportType: file.reportType || "",
            sourceRow: transaction.sourceRow || null,
            createdAt: existingTxn.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        });

        writer.set(fingerprintRef, {

          source: PORTFOLIO_SOURCES.FUNDBAZAAR,
          batchId,
          fileId: file.id,
          investorId,
          importedAt: FieldValue.serverTimestamp(),
          importedByUid: actor.uid
        }, { merge: true });
        writer.update(fileRef, {
          matchedInvestorId: investorId,
          matchedInvestorName: investor.fullName || "",
          matchedClientCode: investor.clientCode || "",
          matchStatus: PORTFOLIO_MATCH_STATUS.VERIFIED,
          status: "imported",
          importedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Flush each file so a second Fundbazaar report for the same investor in
        // the same batch can reconcile against the holdings/transactions just written.
        await writer.flush();
        if (recoveryRef) {
          await recoveryRef.update({
            status: "committed",
            committedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }).catch(async (journalError) => {
            console.error("Portfolio recovery journal finalisation failed", journalError);
            await fileRef.set({ recoveryJournalError: journalError?.message || "Recovery journal could not be finalised." }, { merge: true }).catch(() => {});
          });
        }

        affectedInvestors.set(investorId, investor);
        results.push({
          fileId: file.id,
          fileName: file.fileName,
          status: "imported",
          investorId,
          investorName: investor.fullName || "",
          positionCount: Number(file.summary?.positionCount || 0),
          newPositionCount,
          exitedPositionCount: exitedPositions.length,
          transactionCount: Number(file.summary?.transactionCount || 0),
          currentValue: Number(file.summary?.currentValue || 0)
        });
      } catch (error) {
        if (recoveryRef) {
          await recoveryRef.set({
            status: "commit_failed",
            reversible: false,
            failureReason: error?.message || "Import failed",
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
        writer.update(fileRef, { status: "failed", importError: error?.message || "Import failed", updatedAt: FieldValue.serverTimestamp() });
        results.push({ fileId: file.id, fileName: file.fileName, status: "failed", error: error?.message || "Import failed" });
      }
    }

    await writer.close();

    const snapshots = [];
    for (const investorId of affectedInvestors.keys()) {
      snapshots.push(await createPortfolioSnapshot(investorId, actor, {
        snapshotDate: indiaDateKey(),
        verificationStatus: "verified",
        sourceImportId: batchId
      }));
    }

    const dailyCoverage = await buildDailyPortfolioCoverage(actor, { dateKey: indiaDateKey() });
    const missing = hasFundbazaarFiles ? dailyCoverage.rows
      .filter((item) => item.status === "missing")
      .map((item) => ({
        investorId: item.investorId,
        investorName: item.investorName || "",
        clientCode: item.clientCode || "",
        lastSuccessfulImportAt: item.lastSuccessfulImportAt || null,
        lastPortfolioDate: item.lastPortfolioDate || "",
        staleDays: item.staleDays
      })) : [];

    const importedCount = results.filter((item) => item.status === "imported").length;
    const issueCount = results.filter((item) => !["imported", "duplicate"].includes(item.status)).length;
    const status = importedCount > 0 && issueCount === 0 ? PORTFOLIO_IMPORT_STATUS.COMPLETED : importedCount > 0 ? PORTFOLIO_IMPORT_STATUS.PARTIAL : PORTFOLIO_IMPORT_STATUS.FAILED;
    const totalCurrentValue = results.filter((item) => item.status === "imported").reduce((sum, item) => sum + Number(item.currentValue || 0), 0);

    const coverageBatchFields = hasFundbazaarFiles ? {
      missingInvestorCount: dailyCoverage.missingCount,
      missingInvestors: missing.slice(0, 100),
      coverageDateKey: dailyCoverage.dateKey,
      coverageExpectedCount: dailyCoverage.expectedCount,
      coverageReceivedCount: dailyCoverage.receivedCount,
      coverageUpdatedCount: dailyCoverage.updatedCount,
      coverageAttentionCount: dailyCoverage.attentionCount,
      coverageCompletionPercentage: dailyCoverage.completionPercentage
    } : {
      missingInvestorCount: 0,
      missingInvestors: [],
      coverageDateKey: "",
      coverageExpectedCount: 0,
      coverageReceivedCount: 0,
      coverageUpdatedCount: 0,
      coverageAttentionCount: 0,
      coverageCompletionPercentage: 0
    };

    await batchRef.update({
      status,
      importedCount,
      issueCount,
      duplicateCount: results.filter((item) => item.status === "duplicate").length,
      investorCount: affectedInvestors.size,
      totalCurrentValue: Number(totalCurrentValue.toFixed(2)),
      ...coverageBatchFields,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await adminDb.collection("activityLogs").add({
      recordType: "portfolio_import",
      recordId: batchId,
      advisorUid: actor.uid,
      assignedAdvisorUid: actor.uid,
      action: "daily_portfolio_import_completed",
      title: "Daily portfolio import completed",
      description: `${importedCount} report(s) imported for ${affectedInvestors.size} investor(s).`,
      metadata: {
        batchId,
        importedCount,
        issueCount,
        sourceCoverageTracked: hasFundbazaarFiles ? PORTFOLIO_SOURCES.FUNDBAZAAR : "",
        missingInvestorCount: hasFundbazaarFiles ? dailyCoverage.missingCount : 0,
        coverageExpectedCount: hasFundbazaarFiles ? dailyCoverage.expectedCount : 0,
        coverageReceivedCount: hasFundbazaarFiles ? dailyCoverage.receivedCount : 0,
        coverageUpdatedCount: hasFundbazaarFiles ? dailyCoverage.updatedCount : 0,
        coverageAttentionCount: hasFundbazaarFiles ? dailyCoverage.attentionCount : 0,
        coverageCompletionPercentage: hasFundbazaarFiles ? dailyCoverage.completionPercentage : 0,
        totalCurrentValue: Number(totalCurrentValue.toFixed(2))
      },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: FieldValue.serverTimestamp()
    });

    return Response.json({
      batchId,
      status,
      results,
      snapshots,
      missing,
      coverage: hasFundbazaarFiles ? dailyCoverage : null,
      importedCount,
      issueCount,
      totalCurrentValue: Number(totalCurrentValue.toFixed(2))
    });
  } catch (error) {
    console.error("Portfolio commit failed", error);
    return Response.json({ error: error?.message || "Unable to process portfolio import." }, { status: appRequestErrorStatus(error, 500) });
  }
}
