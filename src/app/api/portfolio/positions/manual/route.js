import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_SOURCES,
  portfolioAssetClass
} from "@/lib/constants/portfolio";
import { createPortfolioSnapshot, getAccessibleInvestor, indiaDateKey, positionDocumentId } from "@/lib/server/portfolioServer";
import { stableHash } from "@/lib/server/portfolioImportParser";
import { generalWealthAllocation, normalisePortfolioGoalAllocations, portfolioAllocationStatus } from "@/lib/portfolioGoalAllocation";

export const runtime = "nodejs";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value) {
  return String(value || "").trim();
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const payload = await request.json();
    const investorId = clean(payload.investorId);
    const productType = clean(payload.productType);
    if (!investorId) return Response.json({ error: "Investor is required." }, { status: 400 });
    if (!Object.values(PORTFOLIO_PRODUCT_TYPES).includes(productType)) return Response.json({ error: "Select a valid investment type." }, { status: 400 });
    const investor = await getAccessibleInvestor(actor, investorId);

    const instrumentName = clean(payload.instrumentName || payload.schemeName || payload.stockName || payload.fundName);
    if (!instrumentName) return Response.json({ error: "Investment / instrument name is required." }, { status: 400 });

    let source = clean(payload.source) || PORTFOLIO_SOURCES.MANUAL;
    let provider = clean(payload.provider);
    if (productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY && !provider) provider = "Bajaj Broking";
    if (productType === PORTFOLIO_PRODUCT_TYPES.ULIP && source === PORTFOLIO_SOURCES.MANUAL) source = PORTFOLIO_SOURCES.ULIP;

    const quantity = number(payload.quantity);
    const averageBuyRate = number(payload.averageBuyRate || payload.buyRate);
    const currentRate = number(payload.currentRate);
    const totalUnits = number(payload.totalUnits || payload.units);
    const currentNav = number(payload.currentNav || payload.nav);
    let totalInvested = number(payload.totalInvested || payload.investedAmount);
    let currentValue = number(payload.currentValue);

    if (productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
      if (!totalInvested) totalInvested = averageBuyRate * quantity;
      if (!currentValue) currentValue = currentRate * quantity;
    } else if ([PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(productType)) {
      if (!currentValue && totalUnits && currentNav) currentValue = totalUnits * currentNav;
    }
    const gainLoss = currentValue - totalInvested;
    const returnPercentage = totalInvested > 0 ? gainLoss / totalInvested * 100 : 0;

    let goalAllocations = [generalWealthAllocation()];
    const goalId = clean(payload.goalId);
    if (goalId) {
      const goals = Array.isArray(investor.bucketList) && investor.bucketList.length ? investor.bucketList : (investor.goals || []);
      const goal = goals.find((item) => String(item.id || item.goalId) === goalId);
      if (!goal) return Response.json({ error: "The selected Goal / Bucket List does not exist." }, { status: 400 });
      goalAllocations = normalisePortfolioGoalAllocations([{ goalId, goalName: goal.name || goal.goalName || "Goal", percentage: 100 }]);
    }

    const positionId = positionDocumentId({
      investorId,
      source,
      isin: clean(payload.isin),
      folioNo: clean(payload.folioNo || payload.policyNumber),
      symbol: clean(payload.symbol),
      instrumentName
    });
    const positionRef = adminDb.collection("portfolioPositions").doc(positionId);
    const existing = await positionRef.get();

    await positionRef.set({
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      source,
      provider,
      productType,
      assetClass: clean(payload.assetClass) || portfolioAssetClass(productType, payload.nature),
      instrumentName,
      schemeName: clean(payload.schemeName),
      stockName: clean(payload.stockName),
      fundName: clean(payload.fundName),
      planName: clean(payload.planName),
      symbol: clean(payload.symbol),
      isin: clean(payload.isin),
      exchange: clean(payload.exchange),
      folioNo: clean(payload.folioNo),
      policyNumber: clean(payload.policyNumber),
      investmentMode: clean(payload.investmentMode),
      purchaseDate: clean(payload.purchaseDate),
      totalInvested: Number(totalInvested.toFixed(2)),
      investedAmount: Number(totalInvested.toFixed(2)),
      quantity,
      averageBuyRate,
      currentRate,
      totalUnits,
      currentNav,
      navDate: clean(payload.navDate),
      valuationDate: clean(payload.valuationDate || payload.navDate || payload.priceDate) || indiaDateKey(),
      priceDate: clean(payload.priceDate),
      currentValue: Number(currentValue.toFixed(2)),
      gainLoss: Number(gainLoss.toFixed(2)),
      returnPercentage: Number(returnPercentage.toFixed(2)),
      monthlySip: number(payload.monthlySip),
      premiumAmount: number(payload.premiumAmount),
      premiumFrequency: clean(payload.premiumFrequency),
      policyTotalPremiumPaid: number(payload.policyTotalPremiumPaid || payload.totalPremiumPaid || (productType === PORTFOLIO_PRODUCT_TYPES.ULIP ? payload.totalInvested : 0)),
      policyStartDate: clean(payload.policyStartDate || payload.purchaseDate),
      fundCode: clean(payload.fundCode),
      insurer: clean(payload.insurer || provider),
      sumAssured: number(payload.sumAssured),
      policyStatus: clean(payload.policyStatus) || (productType === PORTFOLIO_PRODUCT_TYPES.ULIP ? "Active" : ""),
      maturityDate: clean(payload.maturityDate),
      goalAllocations,
      allocationStatus: portfolioAllocationStatus(goalAllocations),
      defaultBucketApplied: goalAllocations.some((item) => !item.goalId),
      notes: clean(payload.notes),
      status: "active",
      createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: actor.fullName || actor.email || "GrowVest User"
    }, { merge: true });

    if (productType === PORTFOLIO_PRODUCT_TYPES.ULIP && clean(payload.policyNumber)) {
      const policyNumber = clean(payload.policyNumber);
      const allPositionsSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
      const policyFunds = allPositionsSnapshot.docs
        .map((item) => item.data())
        .filter((item) => item.source === PORTFOLIO_SOURCES.ULIP && String(item.policyNumber || "").trim() === policyNumber && !["inactive", "exited"].includes(item.status));
      const currentFundValue = policyFunds.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
      const latestNavDate = policyFunds.map((item) => item.navDate || item.valuationDate || "").filter(Boolean).sort().at(-1) || clean(payload.navDate);
      const policyId = `ulip_${stableHash([investorId, policyNumber.toUpperCase()].join("|"), 40)}`;
      const policyRef = adminDb.collection("ulipPolicies").doc(policyId);
      const existingPolicy = await policyRef.get();
      await policyRef.set({
        investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.ULIP,
        provider: provider || clean(payload.insurer) || "ULIP Provider",
        insurer: clean(payload.insurer || provider) || "ULIP Provider",
        policyNumber,
        planName: clean(payload.planName),
        policyStartDate: clean(payload.policyStartDate || payload.purchaseDate),
        premiumAmount: number(payload.premiumAmount),
        premiumFrequency: clean(payload.premiumFrequency),
        totalPremiumPaid: number(payload.policyTotalPremiumPaid || payload.totalPremiumPaid || payload.totalInvested),
        maturityDate: clean(payload.maturityDate),
        sumAssured: number(payload.sumAssured),
        currentFundValue: Number(currentFundValue.toFixed(2)),
        fundCount: policyFunds.length,
        latestNavDate,
        policyStatus: clean(payload.policyStatus) || "Active",
        status: "active",
        createdAt: existingPolicy.exists ? existingPolicy.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    }

    const snapshot = await createPortfolioSnapshot(investorId, actor, { snapshotDate: indiaDateKey(), verificationStatus: "verified" });
    return Response.json({ positionId, snapshot });
  } catch (error) {
    console.error("Manual portfolio position failed", error);
    return Response.json({ error: error?.message || "Unable to save the investment." }, { status: appRequestErrorStatus(error, 500) });
  }
}
