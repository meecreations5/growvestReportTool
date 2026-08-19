import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";
import { stableHash } from "@/lib/server/portfolioImportParser";

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
    const investor = await getAccessibleInvestor(actor, investorId);
    const stockName = clean(payload.stockName || payload.instrumentName);
    const tradeDate = clean(payload.tradeDate) || indiaDateKey();
    const quantity = number(payload.quantity);
    const buyRate = number(payload.buyRate);
    const sellRate = number(payload.sellRate);
    if (!stockName || quantity <= 0 || buyRate <= 0 || sellRate <= 0) {
      return Response.json({ error: "Stock, quantity, buy rate and sell rate are required for a closed intraday trade." }, { status: 400 });
    }

    const grossPnl = (sellRate - buyRate) * quantity;
    const brokerage = number(payload.brokerage);
    const stt = number(payload.stt);
    const exchangeCharges = number(payload.exchangeCharges);
    const gst = number(payload.gst);
    const stampDuty = number(payload.stampDuty);
    const otherCharges = number(payload.otherCharges);
    const totalCharges = brokerage + stt + exchangeCharges + gst + stampDuty + otherCharges;
    const netPnl = grossPnl - totalCharges;
    const tradeId = `trade_${stableHash([investorId, tradeDate, stockName, payload.symbol, quantity, buyRate, sellRate, Date.now()].join("|"), 40)}`;

    await adminDb.collection("tradingTransactions").doc(tradeId).set({
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      source: "bajaj_broking",
      provider: clean(payload.provider) || "Bajaj Broking",
      tradeType: "intraday",
      tradeDate,
      stockName,
      instrumentName: stockName,
      symbol: clean(payload.symbol),
      exchange: clean(payload.exchange) || "NSE",
      quantity,
      buyRate,
      sellRate,
      grossPnl: Number(grossPnl.toFixed(2)),
      brokerage,
      stt,
      exchangeCharges,
      gst,
      stampDuty,
      otherCharges,
      totalCharges: Number(totalCharges.toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      result: netPnl > 0 ? "profit" : netPnl < 0 ? "loss" : "breakeven",
      status: "closed",
      notes: clean(payload.notes),
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const monthKey = tradeDate.slice(0, 7);
    const monthSnapshot = await adminDb.collection("tradingTransactions").where("investorId", "==", investorId).get();
    const monthTrades = monthSnapshot.docs.map((item) => item.data()).filter((item) => String(item.tradeDate || "").startsWith(monthKey));
    const summary = monthTrades.reduce((total, trade) => {
      total.totalTrades += 1;
      total.grossPnl += Number(trade.grossPnl || 0);
      total.totalCharges += Number(trade.totalCharges || 0);
      total.netPnl += Number(trade.netPnl || 0);
      total.turnover += (Number(trade.buyRate || 0) + Number(trade.sellRate || 0)) * Number(trade.quantity || 0);
      if (Number(trade.netPnl || 0) > 0) total.winningTrades += 1;
      if (Number(trade.netPnl || 0) < 0) total.losingTrades += 1;
      total.tradingDays.add(trade.tradeDate);
      return total;
    }, { totalTrades: 0, winningTrades: 0, losingTrades: 0, grossPnl: 0, totalCharges: 0, netPnl: 0, turnover: 0, tradingDays: new Set() });

    await adminDb.collection("tradingMonthlySummaries").doc(`${investorId}_${monthKey}`).set({
      investorId,
      investorName: investor.fullName || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      monthKey,
      source: "bajaj_broking",
      provider: "Bajaj Broking",
      tradingDays: summary.tradingDays.size,
      totalTrades: summary.totalTrades,
      winningTrades: summary.winningTrades,
      losingTrades: summary.losingTrades,
      grossPnl: Number(summary.grossPnl.toFixed(2)),
      totalCharges: Number(summary.totalCharges.toFixed(2)),
      netPnl: Number(summary.netPnl.toFixed(2)),
      turnover: Number(summary.turnover.toFixed(2)),
      sourceImportId: "",
      sourceImportFileId: "",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return Response.json({
      tradeId,
      trade: {
        tradeDate,
        stockName,
        quantity,
        buyRate,
        sellRate,
        grossPnl: Number(grossPnl.toFixed(2)),
        totalCharges: Number(totalCharges.toFixed(2)),
        netPnl: Number(netPnl.toFixed(2))
      }
    });
  } catch (error) {
    console.error("Manual intraday trade failed", error);
    return Response.json({ error: error?.message || "Unable to save intraday trade." }, { status: appRequestErrorStatus(error, 500) });
  }
}
