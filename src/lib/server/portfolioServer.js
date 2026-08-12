import { FieldValue } from "firebase-admin/firestore";
import { adminDb, canStaffAccessRecord } from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_SOURCES,
  portfolioAssetClass
} from "@/lib/constants/portfolio";
import { stableHash } from "@/lib/server/portfolioImportParser";
import { buildPortfolioIntelligence } from "@/lib/server/portfolioIntelligence";

export function indiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function positionDocumentId({ investorId, source, isin, folioNo, symbol, instrumentName }) {
  return `pos_${stableHash([investorId, source, isin || symbol || instrumentName, folioNo || ""].join("|"), 40)}`;
}

export function transactionDocumentId({ investorId, source, isin, folioNo, transactionDate, transactionType, purchaseAmount, purchaseNav, units }) {
  return `txn_${stableHash([investorId, source, isin, folioNo, transactionDate, transactionType, purchaseAmount, purchaseNav, units].join("|"), 48)}`;
}

export async function getAccessibleInvestor(actor, investorId) {
  const snapshot = await adminDb.collection("investors").doc(investorId).get();
  if (!snapshot.exists) throw new Error("Investor profile was not found.");
  const investor = { id: snapshot.id, ...snapshot.data() };
  if (!canStaffAccessRecord(actor, investor)) throw new Error("You are not authorised to update this investor portfolio.");
  return investor;
}

function sourceFreshness(positions = []) {
  const map = new Map();
  positions.forEach((position) => {
    const key = position.source || "manual";
    const current = map.get(key) || { source: key, valuationDate: "", positionCount: 0, currentValue: 0 };
    current.positionCount += 1;
    current.currentValue += Number(position.currentValue || 0);
    const date = position.navDate || position.valuationDate || position.priceDate || "";
    if (date && (!current.valuationDate || date > current.valuationDate)) current.valuationDate = date;
    map.set(key, current);
  });
  return [...map.values()].map((item) => ({ ...item, currentValue: Number(item.currentValue.toFixed(2)) }));
}

async function previousSnapshotContext(investorId, snapshotDate) {
  let previousSnapshot = null;
  try {
    const snapshot = await adminDb.collection("portfolioSnapshots")
      .where("investorId", "==", investorId)
      .where("snapshotDate", "<", snapshotDate)
      .orderBy("snapshotDate", "desc")
      .limit(1)
      .get();
    if (!snapshot.empty) previousSnapshot = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    const fallback = await adminDb.collection("portfolioSnapshots").where("investorId", "==", investorId).get();
    previousSnapshot = fallback.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => String(item.snapshotDate || "") < String(snapshotDate || ""))
      .sort((a, b) => String(b.snapshotDate || "").localeCompare(String(a.snapshotDate || "")))[0] || null;
  }

  if (!previousSnapshot?.id) return { previousSnapshot: null, previousPositions: [], transactions: [] };

  const previousPositionsResult = await adminDb.collection("portfolioSnapshotPositions")
    .where("snapshotId", "==", previousSnapshot.id)
    .get();
  const previousPositions = previousPositionsResult.docs.map((item) => ({ id: item.id, ...item.data() }));

  let transactions = [];
  try {
    const transactionResult = await adminDb.collection("investmentTransactions")
      .where("investorId", "==", investorId)
      .where("transactionDate", ">", previousSnapshot.snapshotDate)
      .where("transactionDate", "<=", snapshotDate)
      .orderBy("transactionDate", "asc")
      .get();
    transactions = transactionResult.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    const fallback = await adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get();
    transactions = fallback.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => String(item.transactionDate || "") > String(previousSnapshot.snapshotDate || "") && String(item.transactionDate || "") <= String(snapshotDate || ""))
      .sort((a, b) => String(a.transactionDate || "").localeCompare(String(b.transactionDate || "")));
  }

  return { previousSnapshot, previousPositions, transactions };
}

export async function createPortfolioSnapshot(investorId, actor, { snapshotDate = indiaDateKey(), verificationStatus = "verified", sourceImportId = null } = {}) {
  const investor = await getAccessibleInvestor(actor, investorId);
  const positionsSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
  const positions = positionsSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status !== "inactive" && item.status !== "exited");

  const seenUlipPolicies = new Set();
  const summary = positions.reduce((total, item) => {
    const currentValue = Number(item.currentValue || 0);
    const productType = item.productType || PORTFOLIO_PRODUCT_TYPES.OTHER;
    let invested = Number(item.totalInvested ?? item.investedAmount ?? 0);
    if (productType === PORTFOLIO_PRODUCT_TYPES.ULIP && item.policyNumber && Number(item.policyTotalPremiumPaid || 0) > 0) {
      const policyKey = String(item.policyNumber).trim().toUpperCase();
      if (seenUlipPolicies.has(policyKey)) invested = 0;
      else {
        seenUlipPolicies.add(policyKey);
        invested = Number(item.policyTotalPremiumPaid || 0);
      }
    }
    const monthlySip = Number(item.monthlySip || 0);
    total.currentValue += currentValue;
    total.totalInvested += invested;
    total.gainLoss += productType === PORTFOLIO_PRODUCT_TYPES.ULIP
      ? (item.gainLossAvailable === false ? 0 : Number(item.gainLoss || 0))
      : Number(item.gainLoss ?? (currentValue - invested) ?? 0);
    total.monthlySip += monthlySip;
    total.positionCount += 1;
    const assetClass = item.assetClass || portfolioAssetClass(item.productType, item.nature);
    total.assetClasses[assetClass] = (total.assetClasses[assetClass] || 0) + currentValue;
    total.productTypes[productType] = (total.productTypes[productType] || 0) + currentValue;
    return total;
  }, { currentValue: 0, totalInvested: 0, gainLoss: 0, monthlySip: 0, positionCount: 0, assetClasses: {}, productTypes: {} });

  const goalTotals = {};
  positions.forEach((position) => {
    (position.goalAllocations || []).forEach((allocation) => {
      if (!allocation?.goalId || Number(allocation.percentage || 0) <= 0) return;
      const allocatedValue = Number(position.currentValue || 0) * Number(allocation.percentage || 0) / 100;
      const allocatedMonthly = Number(position.monthlySip || 0) * Number(allocation.percentage || 0) / 100;
      const current = goalTotals[allocation.goalId] || { goalId: allocation.goalId, goalName: allocation.goalName || "", currentValue: 0, monthlyContribution: 0 };
      current.currentValue += allocatedValue;
      current.monthlyContribution += allocatedMonthly;
      goalTotals[allocation.goalId] = current;
    });
  });

  const roundedSummary = {
    ...summary,
    currentValue: Number(summary.currentValue.toFixed(2)),
    totalInvested: Number(summary.totalInvested.toFixed(2)),
    gainLoss: Number(summary.gainLoss.toFixed(2)),
    monthlySip: Number(summary.monthlySip.toFixed(2)),
    assetClasses: Object.fromEntries(Object.entries(summary.assetClasses).map(([key, value]) => [key, Number(value.toFixed(2))])),
    productTypes: Object.fromEntries(Object.entries(summary.productTypes).map(([key, value]) => [key, Number(value.toFixed(2))]))
  };
  const { previousSnapshot, previousPositions, transactions } = await previousSnapshotContext(investorId, snapshotDate);
  const intelligence = buildPortfolioIntelligence({
    currentPositions: positions,
    previousPositions,
    transactions,
    currentSummary: roundedSummary,
    previousSummary: previousSnapshot?.summary || {},
    snapshotDate,
    previousSnapshotDate: previousSnapshot?.snapshotDate || ""
  });
  const snapshotId = `${investorId}_${snapshotDate}`;
  const snapshotRef = adminDb.collection("portfolioSnapshots").doc(snapshotId);
  const existing = await snapshotRef.get();
  const snapshotVersion = existing.exists ? Number(existing.data()?.snapshotVersion || 1) + 1 : 1;
  const writer = adminDb.bulkWriter();
  const existingSnapshotPositions = await adminDb.collection("portfolioSnapshotPositions").where("snapshotId", "==", snapshotId).get();
  const currentSnapshotPositionIds = new Set(positions.map((position) => `${snapshotId}_${position.id}`));
  existingSnapshotPositions.docs.forEach((item) => {
    if (!currentSnapshotPositionIds.has(item.id)) writer.delete(item.ref);
  });

  writer.set(snapshotRef, {
    investorId,
    investorName: investor.fullName || "",
    clientCode: investor.clientCode || "",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
    snapshotDate,
    snapshotVersion,
    verificationStatus,
    sourceImportId,
    summary: roundedSummary,
    goalTotals: Object.values(goalTotals).map((item) => ({
      ...item,
      currentValue: Number(item.currentValue.toFixed(2)),
      monthlyContribution: Number(item.monthlyContribution.toFixed(2))
    })),
    sourceFreshness: intelligence.sourceFreshness?.length ? intelligence.sourceFreshness : sourceFreshness(positions),
    reconciliationStatus: intelligence.status,
    intelligence,
    createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.fullName || actor.email || "GrowVest User"
  }, { merge: true });

  positions.forEach((position) => {
    const snapshotPositionId = `${snapshotId}_${position.id}`;
    writer.set(adminDb.collection("portfolioSnapshotPositions").doc(snapshotPositionId), {
      snapshotId,
      snapshotDate,
      investorId,
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      positionId: position.id,
      productType: position.productType || PORTFOLIO_PRODUCT_TYPES.OTHER,
      source: position.source || PORTFOLIO_SOURCES.MANUAL,
      provider: position.provider || "",
      instrumentName: position.instrumentName || position.schemeName || position.stockName || position.fundName || "",
      schemeName: position.schemeName || "",
      stockName: position.stockName || "",
      symbol: position.symbol || "",
      isin: position.isin || "",
      folioNo: position.folioNo || "",
      policyNumber: position.policyNumber || "",
      planName: position.planName || "",
      fundName: position.fundName || "",
      fundCode: position.fundCode || "",
      insurer: position.insurer || "",
      policyStartDate: position.policyStartDate || "",
      premiumAmount: Number(position.premiumAmount || 0),
      premiumFrequency: position.premiumFrequency || "",
      policyTotalPremiumPaid: Number(position.policyTotalPremiumPaid || 0),
      maturityDate: position.maturityDate || "",
      sumAssured: Number(position.sumAssured || 0),
      policyStatus: position.policyStatus || "",
      gainLossAvailable: position.gainLossAvailable !== false,
      assetClass: position.assetClass || "Other",
      investmentMode: position.investmentMode || "",
      totalInvested: Number(position.totalInvested ?? position.investedAmount ?? 0),
      investedAmount: Number(position.investedAmount ?? position.totalInvested ?? 0),
      quantity: Number(position.quantity || 0),
      totalUnits: Number(position.totalUnits || 0),
      averageBuyRate: Number(position.averageBuyRate || 0),
      currentRate: Number(position.currentRate || 0),
      currentNav: Number(position.currentNav || 0),
      navDate: position.navDate || "",
      valuationDate: position.valuationDate || position.navDate || position.priceDate || "",
      previousNav: Number(position.previousNav || 0),
      previousNavDate: position.previousNavDate || "",
      previousCurrentValue: Number(position.previousCurrentValue || 0),
      previousValuationDate: position.previousValuationDate || "",
      currentValue: Number(position.currentValue || 0),
      gainLoss: Number(position.gainLoss || 0),
      returnPercentage: Number(position.returnPercentage || 0),
      monthlySip: Number(position.monthlySip || 0),
      goalAllocations: position.goalAllocations || [],
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  writer.update(adminDb.collection("investors").doc(investorId), {
    latestPortfolioSnapshotId: snapshotId,
    latestPortfolioSnapshotDate: snapshotDate,
    latestPortfolioValue: roundedSummary.currentValue,
    latestPortfolioInvested: roundedSummary.totalInvested,
    latestPortfolioGainLoss: roundedSummary.gainLoss,
    latestPortfolioMonthlySip: roundedSummary.monthlySip,
    latestPortfolioReconciliationStatus: intelligence.status,
    latestPortfolioIssueCount: Number(intelligence.issues?.filter((item) => item.severity !== "info").length || 0),
    latestPortfolioNewHoldingCount: Number(intelligence.counts?.newHoldings || 0),
    latestPortfolioExitedHoldingCount: Number(intelligence.counts?.exitedHoldings || 0),
    latestPortfolioUnassignedCount: Number(intelligence.counts?.unassignedHoldings || 0),
    latestPortfolioUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await writer.close();
  return { id: snapshotId, snapshotDate, summary: roundedSummary, goalTotals: Object.values(goalTotals), positionCount: positions.length, reconciliationStatus: intelligence.status, intelligence };
}
