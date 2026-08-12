import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { PORTFOLIO_PRODUCT_TYPES } from "@/lib/constants/portfolio";
import { createPortfolioSnapshot, getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";
import { stableHash } from "@/lib/server/portfolioImportParser";

export const runtime = "nodejs";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value) {
  return String(value || "").trim();
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { positionId } = await params;
    const payload = await request.json();
    const positionRef = adminDb.collection("portfolioPositions").doc(positionId);
    const currentSnapshot = await positionRef.get();
    if (!currentSnapshot.exists) return Response.json({ error: "Delivery holding was not found." }, { status: 404 });
    const current = currentSnapshot.data();
    if (current.productType !== PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
      return Response.json({ error: "Only delivery stock holdings can use this sale action." }, { status: 400 });
    }

    const investor = await getAccessibleInvestor(actor, current.investorId);
    const quantity = number(payload.quantity);
    const sellRate = number(payload.sellRate);
    const charges = number(payload.charges);
    const sellDate = clean(payload.sellDate) || indiaDateKey();
    if (quantity <= 0 || sellRate <= 0) return Response.json({ error: "Sale quantity and sell rate are required." }, { status: 400 });

    let result;
    await adminDb.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(positionRef);
      if (!latestSnapshot.exists) throw new Error("Delivery holding was not found.");
      const position = latestSnapshot.data();
      const openingQuantity = number(position.quantity);
      if (quantity > openingQuantity) throw new Error(`Sale quantity cannot exceed the current holding of ${openingQuantity}.`);

      const averageBuyRate = number(position.averageBuyRate);
      const currentRate = number(position.currentRate);
      const remainingQuantity = Number((openingQuantity - quantity).toFixed(6));
      const realisedPnl = (sellRate - averageBuyRate) * quantity - charges;
      const saleProceeds = sellRate * quantity - charges;
      const remainingInvested = averageBuyRate * remainingQuantity;
      const remainingValue = currentRate * remainingQuantity;
      const remainingGain = remainingValue - remainingInvested;
      const returnPercentage = remainingInvested > 0 ? remainingGain / remainingInvested * 100 : 0;
      const saleId = `sale_${stableHash([positionId, sellDate, quantity, sellRate, charges, Date.now()].join("|"), 40)}`;

      transaction.update(positionRef, {
        quantity: remainingQuantity,
        totalInvested: Number(remainingInvested.toFixed(2)),
        investedAmount: Number(remainingInvested.toFixed(2)),
        currentValue: Number(remainingValue.toFixed(2)),
        gainLoss: Number(remainingGain.toFixed(2)),
        returnPercentage: Number(returnPercentage.toFixed(2)),
        status: remainingQuantity > 0 ? "active" : "exited",
        lastSaleDate: sellDate,
        lastSaleRate: sellRate,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      });

      transaction.set(adminDb.collection("investmentTransactions").doc(saleId), {
        investorId: current.investorId,
        investorName: investor.fullName || "",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: position.source || "manual",
        provider: position.provider || "Bajaj Broking",
        productType: PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY,
        positionId,
        stockName: position.stockName || position.instrumentName || "",
        instrumentName: position.instrumentName || position.stockName || "Stock",
        symbol: position.symbol || "",
        isin: position.isin || "",
        exchange: position.exchange || "",
        transactionDate: sellDate,
        transactionType: "Delivery Sale",
        investmentMode: "Delivery",
        quantity,
        averageBuyRate,
        sellRate,
        amount: Number(saleProceeds.toFixed(2)),
        charges: Number(charges.toFixed(2)),
        realisedPnl: Number(realisedPnl.toFixed(2)),
        cashFlowType: "internal_or_withdrawal_review",
        notes: clean(payload.notes),
        createdByUid: actor.uid,
        createdByName: actor.fullName || actor.email || "GrowVest User",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      result = {
        saleId,
        openingQuantity,
        soldQuantity: quantity,
        remainingQuantity,
        sellRate,
        saleProceeds: Number(saleProceeds.toFixed(2)),
        realisedPnl: Number(realisedPnl.toFixed(2))
      };
    });

    const snapshot = await createPortfolioSnapshot(current.investorId, actor, {
      snapshotDate: indiaDateKey(),
      verificationStatus: "verified",
      sourceImportId: current.sourceImportId || null
    });
    return Response.json({ ...result, snapshot });
  } catch (error) {
    console.error("Delivery stock sale failed", error);
    return Response.json({ error: error?.message || "Unable to record the stock sale." }, { status: 500 });
  }
}
