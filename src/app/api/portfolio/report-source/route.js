import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  canStaffAccessRecord,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";
import { dedupeActionWithdrawalTransactions } from "@/lib/portfolioCashFlow";
import { normalisePortfolioGoalAllocations, portfolioAllocationStatus } from "@/lib/portfolioGoalAllocation";

export const runtime = "nodejs";

const REPORT_SNAPSHOT_CAPTURE_GRACE_DAYS = 5;

function safeDateKey(value = "") {
  const dateKey = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : "";
}

function addDaysToDateKey(dateKey, days) {
  const parsed = Date.parse(`${String(dateKey || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed + Number(days || 0) * 86400000).toISOString().slice(0, 10);
}

function portfolioValueDate(position = {}) {
  return String(position.navDate || position.valuationDate || position.priceDate || "").slice(0, 10);
}

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function latestVerifiedSnapshot(snapshots = [], predicate = () => true) {
  return snapshots
    .filter((item) => item.verificationStatus === "verified" && predicate(item))
    .sort((a, b) => String(b.snapshotDate || "").localeCompare(String(a.snapshotDate || "")))[0] || null;
}

async function loadSnapshotPositions(snapshotId) {
  if (!snapshotId) return [];
  const result = await adminDb.collection("portfolioSnapshotPositions")
    .where("snapshotId", "==", snapshotId)
    .get();
  return rows(result);
}

async function findPostCutoffCaptureSnapshot(snapshots, cutoffDate) {
  const graceEnd = addDaysToDateKey(cutoffDate, REPORT_SNAPSHOT_CAPTURE_GRACE_DAYS);
  if (!cutoffDate || !graceEnd) return null;

  const candidates = snapshots
    .filter((item) => item.verificationStatus === "verified")
    .filter((item) => String(item.snapshotDate || "") > cutoffDate && String(item.snapshotDate || "") <= graceEnd)
    .sort((a, b) => String(a.snapshotDate || "").localeCompare(String(b.snapshotDate || "")));

  const compatible = [];
  for (const candidate of candidates) {
    const positions = await loadSnapshotPositions(candidate.id);
    const datedValues = [
      ...(candidate.sourceFreshness || []).map((item) => String(item.valuationDate || "").slice(0, 10)),
      ...positions.map(portfolioValueDate)
    ].filter(Boolean);

    // A later capture is usable only when every dated underlying value belongs
    // to the report cutoff or earlier. This prevents September market values
    // from being pulled backwards into an August report.
    if (!datedValues.length || datedValues.some((value) => value > cutoffDate)) continue;
    const effectiveDate = [...datedValues].sort().at(-1) || cutoffDate;
    compatible.push({ candidate, positions, effectiveDate });
  }

  if (!compatible.length) return null;
  compatible.sort((a, b) => {
    const effectiveCompare = String(b.effectiveDate).localeCompare(String(a.effectiveDate));
    if (effectiveCompare) return effectiveCompare;
    return String(a.candidate.snapshotDate || "").localeCompare(String(b.candidate.snapshotDate || ""));
  });

  const selected = compatible[0];
  return {
    snapshot: {
      ...selected.candidate,
      capturedSnapshotDate: selected.candidate.snapshotDate || "",
      snapshotDate: selected.effectiveDate,
      reportSnapshotMode: "post_cutoff_capture",
      reportCutoffDate: cutoffDate
    },
    positions: selected.positions
  };
}

function dateSortValue(value) {
  const parsed = Date.parse(String(value || ""));
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

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { searchParams } = new URL(request.url);
    const investorId = String(searchParams.get("investorId") || "").trim();
    const asOfDate = safeDateKey(searchParams.get("asOfDate"));

    if (!investorId) throw new AppRequestError("Investor is required.", 400, "investor_required");
    if (!asOfDate) throw new AppRequestError("A valid portfolio cutoff date is required.", 400, "portfolio_cutoff_required");

    const investorSnapshot = await adminDb.collection("investors").doc(investorId).get();
    if (!investorSnapshot.exists) throw new AppRequestError("Investor profile was not found.", 404, "investor_not_found");
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (investor.isDeleted === true || investor.lifecycleStatus === "deleted") {
      throw new AppRequestError("This Investor has been deleted from active GrowVest records.", 410, "investor_deleted");
    }
    if (!canStaffAccessRecord(actor, investor)) {
      throw new AppRequestError("You are not authorised to access this investor portfolio.", 403, "portfolio_access_denied");
    }

    // Report creation is a privileged server workflow. Load all source records
    // by investor on the server and apply reporting-date rules here instead of
    // querying protected Portfolio Master collections from the browser.
    const snapshotsResult = await adminDb.collection("portfolioSnapshots")
      .where("investorId", "==", investorId)
      .get();
    const snapshots = rows(snapshotsResult);

    let snapshot = latestVerifiedSnapshot(
      snapshots,
      (item) => String(item.snapshotDate || "") <= asOfDate
    );
    let closingPositions = null;

    if (!snapshot) {
      const graceSnapshot = await findPostCutoffCaptureSnapshot(snapshots, asOfDate);
      snapshot = graceSnapshot?.snapshot || null;
      closingPositions = graceSnapshot?.positions || null;
    }

    if (!snapshot) {
      return Response.json({
        asOfDate,
        snapshot: null,
        openingSnapshot: null,
        positions: [],
        openingPositions: [],
        transactions: [],
        tradingSummary: null
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (!closingPositions) closingPositions = await loadSnapshotPositions(snapshot.id);

    const monthKey = asOfDate.slice(0, 7);
    const monthStart = `${monthKey}-01`;
    let openingSnapshot = latestVerifiedSnapshot(
      snapshots,
      (item) => String(item.snapshotDate || "") < monthStart
    );
    let openingPositions = null;

    if (!openingSnapshot) {
      const openingCutoff = addDaysToDateKey(monthStart, -1);
      const graceOpening = await findPostCutoffCaptureSnapshot(snapshots, openingCutoff);
      openingSnapshot = graceOpening?.snapshot || null;
      openingPositions = graceOpening?.positions || null;
    }
    if (openingSnapshot?.id && !openingPositions) openingPositions = await loadSnapshotPositions(openingSnapshot.id);
    if (!openingPositions) openingPositions = [];

    const transactionResult = await adminDb.collection("investmentTransactions")
      .where("investorId", "==", investorId)
      .get();
    let transactions = rows(transactionResult)
      .filter((item) => String(item.transactionDate || "") >= monthStart && String(item.transactionDate || "") <= asOfDate)
      .sort((a, b) => dateSortValue(a.transactionDate) - dateSortValue(b.transactionDate));
    transactions = dedupeActionWithdrawalTransactions(transactions);

    const cashResult = await adminDb.collection("manualPortfolioCashLedger")
      .where("investorId", "==", investorId)
      .get();
    const manualCashFlows = rows(cashResult)
      .filter((item) => String(item.entryDate || "") >= monthStart && String(item.entryDate || "") <= asOfDate)
      .sort((a, b) => dateSortValue(a.entryDate) - dateSortValue(b.entryDate))
      .flatMap((item) => {
        const type = String(item.entryType || "").trim().toLowerCase();
        const amount = Math.abs(Number(item.amount || item.signedAmount || 0));
        if (!amount) return [];
        let cashFlowType = "";
        if (type.includes("opening cash") || type.includes("contribution") || type.includes("investor deposit")) cashFlowType = "new_money";
        else if (type.includes("withdrawal") || type.includes("investor withdrawal")) cashFlowType = "withdrawal";
        else if (type.includes("transfer in") || type.includes("transfer out")) cashFlowType = "internal";
        else return [];
        return [{
          id: `manual_cash_${item.id}`,
          investorId,
          source: "manual",
          manualPortfolioCashFlow: true,
          transactionDate: item.entryDate,
          transactionType: `Manual cash - ${item.entryType || cashFlowType}`,
          cashFlowType,
          amount,
          notes: item.notes || item.reference || ""
        }];
      });

    const actionResult = await adminDb.collection("investorActions")
      .where("investorId", "==", investorId)
      .get();
    const confirmedActionCashFlows = rows(actionResult).flatMap((item) => {
      if (item.financialImpactStatus !== "confirmed" || item.financialConfirmationMode !== "manual_cash_movement") return [];
      const transactionDate = String(item.actualFinancialDate || "");
      if (!transactionDate || transactionDate < monthStart || transactionDate > asOfDate) return [];
      const amount = Math.abs(Number(item.actualFinancialAmount || 0));
      if (!amount) return [];
      const cashFlowType = item.financialImpactType === "external_inflow"
        ? "new_money"
        : item.financialImpactType === "external_outflow"
          ? "withdrawal"
          : "";
      if (!cashFlowType) return [];
      return [{
        id: `action_cash_${item.id}`,
        investorId,
        source: "investor_action_confirmation",
        sourceActionId: item.id,
        transactionDate,
        transactionType: item.requestType || item.recommendationType || (cashFlowType === "withdrawal" ? "Confirmed Withdrawal" : "Confirmed Investment"),
        instrumentName: item.relatedInvestmentName || item.requestedAccountReference || "Portfolio",
        cashFlowType,
        financialImpactStatus: "confirmed",
        amount,
        notes: [item.requestedAccountReference, item.actualFinancialReference, item.portfolioConfirmationNote].filter(Boolean).join(" · ")
      }];
    });

    transactions = [...transactions, ...manualCashFlows, ...confirmedActionCashFlows]
      .sort((a, b) => dateSortValue(a.transactionDate) - dateSortValue(b.transactionDate));

    const tradingId = `${investorId}_${monthKey}`;
    const tradingDoc = await adminDb.collection("tradingMonthlySummaries").doc(tradingId).get();
    const tradingSummary = tradingDoc.exists ? { id: tradingDoc.id, ...tradingDoc.data() } : null;

    const payload = {
      asOfDate,
      snapshot,
      openingSnapshot,
      positions: closingPositions.map((item) => ({
        ...item,
        goalAllocations: normalisePortfolioGoalAllocations(item.goalAllocations),
        allocationStatus: portfolioAllocationStatus(item.goalAllocations)
      })),
      openingPositions: openingPositions.map((item) => ({
        ...item,
        goalAllocations: normalisePortfolioGoalAllocations(item.goalAllocations),
        allocationStatus: portfolioAllocationStatus(item.goalAllocations)
      })),
      transactions,
      tradingSummary
    };

    return Response.json(serialise(payload), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Portfolio report source load failed", error);
    return Response.json(
      { error: error?.message || "Unable to load Portfolio Master for this report." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
