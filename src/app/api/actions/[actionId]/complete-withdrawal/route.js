import { FieldValue } from "firebase-admin/firestore";
import { adminDb, appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { ACTION_FINANCIAL_IMPACT_STATUSES, STRUCTURED_WITHDRAWAL_REQUEST_TYPE } from "@/lib/constants/actions";
import { actionActorName, actionEventPayload, actionNotification, cleanActionText } from "@/lib/server/actionServer";
import { createPortfolioSnapshot, indiaDateKey } from "@/lib/server/portfolioServer";
import { stableHash } from "@/lib/server/portfolioImportParser";
import { GENERAL_WEALTH_BUCKET_ID, isGeneralWealthAllocation, normalisePortfolioGoalAllocations } from "@/lib/portfolioGoalAllocation";

export const runtime = "nodejs";

function canManage(actor, action = {}) {
  if (["super_admin", "admin"].includes(actor.role)) return true;
  return actor.role === "advisor" && [action.advisorUid, action.assignedAdvisorUid].includes(actor.uid);
}

function validDate(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function positive(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function roundUnits(value) {
  return Number(Number(value || 0).toFixed(6));
}

function transactionId(actionId, positionId) {
  return `txn_${stableHash(`withdrawal|${actionId}|${positionId}`, 48)}`;
}

function matchesWithdrawalBucket(allocation = {}, bucketId = "") {
  return bucketId === GENERAL_WEALTH_BUCKET_ID
    ? isGeneralWealthAllocation(allocation)
    : String(allocation.goalId || "") === String(bucketId || "");
}

function allocationsAfterBucketWithdrawal(allocations = [], bucketId = "", beforeValue = 0, afterValue = 0) {
  const normalised = normalisePortfolioGoalAllocations(allocations);
  if (!(beforeValue > 0) || !(afterValue > 0)) return normalised;
  const valueReduction = Math.max(0, beforeValue - afterValue);
  const values = normalised.map((allocation) => ({
    allocation,
    value: Math.max(0, beforeValue * Number(allocation.percentage || 0) / 100)
  }));
  const target = values.find((row) => matchesWithdrawalBucket(row.allocation, bucketId));
  if (!target || valueReduction > target.value + Math.max(1, target.value * 0.02)) {
    throw new Error("The completed withdrawal exceeds the current value mapped to the selected Bucket List. Refresh the request before completing it.");
  }
  target.value = Math.max(0, target.value - valueReduction);
  const raw = values
    .filter((row) => row.value > 0.005)
    .map((row) => ({
      ...row.allocation,
      percentage: Number((row.value / afterValue * 100).toFixed(4))
    }));
  return normalisePortfolioGoalAllocations(raw);
}

function completionInputMap(items = []) {
  return new Map((Array.isArray(items) ? items : []).map((item) => [String(item.positionId || ""), item]));
}

async function finaliseAppliedWithdrawal({ actionRef, action, actor, executionDate, reference, note }) {
  const snapshot = await createPortfolioSnapshot(action.investorId, actor, {
    snapshotDate: indiaDateKey(),
    verificationStatus: "verified",
    sourceImportId: `investor_action:${action.id}`
  });
  const snapshotRef = adminDb.collection("portfolioSnapshots").doc(snapshot.snapshotId || snapshot.id || `${action.investorId}_${indiaDateKey()}`);
  const snapshotDoc = await snapshotRef.get();
  const afterCorpus = Number(snapshotDoc.exists ? snapshotDoc.data()?.summary?.currentValue || 0 : 0);
  const completion = action.withdrawalCompletionDraft || action.withdrawalCompletion || {};
  const totalAmount = Number((completion.items || []).reduce((sum, item) => sum + Number(item.actualAmount || 0), 0).toFixed(2));
  const finalCompletion = {
    ...completion,
    executionDate,
    reference,
    note,
    beforePortfolioValue: Number(completion.beforePortfolioValue || 0),
    afterPortfolioValue: roundMoney(afterCorpus),
    totalActualAmount: totalAmount,
    portfolioSnapshotId: snapshot.snapshotId || snapshotRef.id,
    completedAt: new Date().toISOString()
  };

  const batch = adminDb.batch();
  batch.set(actionRef, {
    status: "Completed",
    completionDate: executionDate,
    financialImpactType: "external_outflow",
    financialImpactStatus: ACTION_FINANCIAL_IMPACT_STATUSES.CONFIRMED,
    financialConfirmationMode: "workflow_portfolio_adjustment",
    actualFinancialAmount: totalAmount,
    actualFinancialDate: executionDate,
    actualFinancialReference: reference,
    portfolioConfirmedAt: FieldValue.serverTimestamp(),
    portfolioConfirmedSnapshotId: finalCompletion.portfolioSnapshotId,
    portfolioConfirmationNote: note || "Withdrawal completed and Portfolio Master updated.",
    withdrawalCompletion: finalCompletion,
    withdrawalCompletionDraft: FieldValue.delete(),
    updatedByUid: actor.uid,
    updatedByName: actionActorName(actor),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
    actionId: action.id,
    action: { ...action, status: "Completed" },
    actor,
    eventType: "withdrawal_portfolio_completed",
    note: note || `Withdrawal of ${totalAmount.toLocaleString("en-IN")} completed and reflected in Portfolio Master.`,
    fromStatus: action.status || "In Progress",
    toStatus: "Completed",
    investorVisible: action.investorVisible !== false
  }));
  if (action.investorPortalUid && action.investorVisible !== false) {
    const notification = actionNotification({
      recipientUid: action.investorPortalUid,
      recipientType: "investor",
      title: "Withdrawal completed",
      message: `${action.title || "Your withdrawal"} has been completed and your portfolio has been updated.`,
      actionId: action.id,
      action,
      actor
    });
    if (notification) batch.set(adminDb.collection("notifications").doc(), notification);
  }
  batch.set(adminDb.collection("activityLogs").doc(), {
    recordType: "investor_action",
    recordId: action.id,
    investorId: action.investorId,
    advisorUid: action.advisorUid || actor.uid,
    action: "withdrawal_completed_portfolio_updated",
    title: action.title || "Withdrawal completed",
    description: `${actionActorName(actor)} completed the withdrawal and updated Portfolio Master.`,
    metadata: { actualAmount: totalAmount, executionDate, portfolioSnapshotId: finalCompletion.portfolioSnapshotId },
    createdByUid: actor.uid,
    createdByName: actionActorName(actor),
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
  return { totalAmount, snapshotId: finalCompletion.portfolioSnapshotId, completion: finalCompletion };
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { actionId } = await params;
    const payload = await request.json().catch(() => ({}));
    const executionDate = cleanActionText(payload.executionDate, 20);
    const reference = cleanActionText(payload.reference, 240);
    const note = cleanActionText(payload.note, 1200);
    if (!validDate(executionDate)) return Response.json({ error: "Enter the actual execution date." }, { status: 422 });
    if (executionDate > indiaDateKey()) return Response.json({ error: "A withdrawal cannot be completed before its actual execution date." }, { status: 422 });

    const actionRef = adminDb.collection("investorActions").doc(actionId);
    let snapshot = await actionRef.get();
    if (!snapshot.exists) return Response.json({ error: "Withdrawal request was not found." }, { status: 404 });
    let action = { id: snapshot.id, ...snapshot.data() };
    if (!canManage(actor, action)) return Response.json({ error: "You are not authorised to complete this withdrawal." }, { status: 403 });
    if (String(action.requestType || "") !== STRUCTURED_WITHDRAWAL_REQUEST_TYPE) return Response.json({ error: "This action is not a structured portfolio withdrawal." }, { status: 422 });
    if (["Rejected", "Cancelled"].includes(action.status)) return Response.json({ error: `A ${action.status.toLowerCase()} withdrawal cannot be completed.` }, { status: 422 });
    if (action.status === "Completed" && action.financialImpactStatus === ACTION_FINANCIAL_IMPACT_STATUSES.CONFIRMED) {
      return Response.json({ success: true, alreadyCompleted: true, actionId, completion: action.withdrawalCompletion || null });
    }

    // A retry after the atomic portfolio mutation must only rebuild/finalise the
    // snapshot. It must never subtract the same redemption a second time.
    if (!action.withdrawalPortfolioApplied) {
      const inputs = completionInputMap(payload.items);
      const plannedItems = Array.isArray(action.withdrawalItems) ? action.withdrawalItems : [];
      if (!plannedItems.length) return Response.json({ error: "No withdrawal funds are stored on this request." }, { status: 422 });

      await adminDb.runTransaction(async (transaction) => {
        const actionSnapshot = await transaction.get(actionRef);
        if (!actionSnapshot.exists) throw new Error("Withdrawal request was not found.");
        const currentAction = { id: actionSnapshot.id, ...actionSnapshot.data() };
        if (currentAction.withdrawalPortfolioApplied) return;

        const positionRefs = plannedItems.map((item) => adminDb.collection("portfolioPositions").doc(String(item.positionId || "")));
        const txnRefs = plannedItems.map((item) => adminDb.collection("investmentTransactions").doc(transactionId(actionId, String(item.positionId || ""))));
        const investorRef = adminDb.collection("investors").doc(currentAction.investorId);
        const positionSnapshots = await Promise.all(positionRefs.map((ref) => transaction.get(ref)));
        const txnSnapshots = await Promise.all(txnRefs.map((ref) => transaction.get(ref)));
        const investorSnapshot = await transaction.get(investorRef);
        if (txnSnapshots.some((item) => item.exists)) throw new Error("This withdrawal already has a portfolio transaction. Refresh and try again.");

        const completionItems = [];
        const beforePortfolioValue = Number(investorSnapshot.exists ? investorSnapshot.data()?.latestPortfolioValue || 0 : 0);

        plannedItems.forEach((planned, index) => {
          const positionSnapshot = positionSnapshots[index];
          if (!positionSnapshot.exists) throw new Error(`${planned.instrumentName || "A selected fund"} is no longer available in Portfolio Master.`);
          const position = { id: positionSnapshot.id, ...positionSnapshot.data() };
          if (position.investorId !== currentAction.investorId) throw new Error("A selected fund does not belong to this investor.");
          if (String(position.productType || "") !== "mutual_fund") throw new Error("Automatic withdrawal completion is supported only for Mutual Fund positions.");
          if (["inactive", "exited"].includes(String(position.status || "").toLowerCase())) throw new Error(`${planned.instrumentName || "A selected fund"} is already exited.`);

          const input = inputs.get(position.id) || {};
          const mode = String(planned.withdrawalMode || "partial") === "full" ? "full" : "partial";
          const sipInstruction = ["continue", "pause", "stop"].includes(String(planned.sipInstruction || "")) ? String(planned.sipInstruction) : "continue";
          const currentUnits = Math.max(0, Number(position.totalUnits ?? position.quantity ?? position.units ?? 0));
          const currentValue = Math.max(0, Number(position.currentValue || 0));
          const currentInvested = Math.max(0, Number(position.totalInvested ?? position.investedAmount ?? 0));
          const nav = positive(position.currentNav || position.currentRate) || (currentUnits > 0 ? currentValue / currentUnits : 0);
          const currentAllocations = normalisePortfolioGoalAllocations(position.goalAllocations);
          const withdrawalBucketId = currentAction.withdrawalBucketId || currentAction.relatedGoalId || GENERAL_WEALTH_BUCKET_ID;
          const bucketAllocation = currentAllocations.find((allocation) => matchesWithdrawalBucket(allocation, withdrawalBucketId));
          if (!bucketAllocation) throw new Error(`${planned.instrumentName || "A selected fund"} is no longer mapped to the withdrawal Bucket List.`);
          const bucketPercentage = Math.max(0, Number(bucketAllocation.percentage || 0));
          if (mode === "full" && bucketPercentage < 99.999) throw new Error(`Complete withdrawal of ${planned.instrumentName || "the selected fund"} requires the holding to be 100% mapped to the selected Bucket List.`);
          let actualUnits = mode === "full" ? currentUnits : positive(input.actualUnits || planned.requestedUnits);
          let actualAmount = mode === "full" ? positive(input.actualAmount) || currentValue : positive(input.actualAmount || planned.requestedAmount);
          if (mode === "partial" && !(actualAmount > 0 || actualUnits > 0)) throw new Error(`Enter the actual amount or units for ${planned.instrumentName || "the selected fund"}.`);
          if (!(actualUnits > 0) && nav > 0 && actualAmount > 0) actualUnits = actualAmount / nav;
          if (!(actualAmount > 0) && nav > 0 && actualUnits > 0) actualAmount = actualUnits * nav;
          if (mode === "full") actualUnits = currentUnits;
          if (currentUnits > 0 && actualUnits > currentUnits + 0.0001) throw new Error(`Actual units for ${planned.instrumentName || "the selected fund"} exceed the available units.`);
          if (currentValue > 0 && actualAmount > currentValue + Math.max(1, currentValue * 0.02) && mode !== "full") throw new Error(`Actual withdrawal amount for ${planned.instrumentName || "the selected fund"} exceeds its current value.`);

          const remainingUnits = mode === "full" ? 0 : Math.max(0, currentUnits - actualUnits);
          const remainingValue = mode === "full" ? 0 : Math.max(0, nav > 0 && currentUnits > 0 ? remainingUnits * nav : currentValue - actualAmount);
          const remainingRatio = currentUnits > 0 ? remainingUnits / currentUnits : (currentValue > 0 ? remainingValue / currentValue : 0);
          const remainingInvested = Math.max(0, currentInvested * Math.max(0, Math.min(1, remainingRatio)));
          const nextGoalAllocations = mode === "full"
            ? currentAllocations
            : allocationsAfterBucketWithdrawal(currentAllocations, withdrawalBucketId, currentValue, remainingValue);
          const previousSip = Math.max(0, Number(position.monthlySip || 0));
          const nextSip = sipInstruction === "continue" ? previousSip : 0;
          const nextStatus = remainingUnits > 0 || remainingValue > 0 || nextSip > 0 ? "active" : "exited";
          const gainLoss = remainingValue - remainingInvested;
          const returnPercentage = remainingInvested > 0 ? gainLoss / remainingInvested * 100 : 0;

          transaction.set(positionRefs[index], {
            totalUnits: roundUnits(remainingUnits),
            quantity: roundUnits(remainingUnits),
            currentValue: roundMoney(remainingValue),
            totalInvested: roundMoney(remainingInvested),
            investedAmount: roundMoney(remainingInvested),
            gainLoss: roundMoney(gainLoss),
            returnPercentage: Number(returnPercentage.toFixed(4)),
            monthlySip: roundMoney(nextSip),
            goalAllocations: nextGoalAllocations,
            sipStatus: sipInstruction === "pause" ? "paused" : sipInstruction === "stop" ? "stopped" : "active",
            pausedMonthlySipAmount: sipInstruction === "pause" ? roundMoney(previousSip) : FieldValue.delete(),
            status: nextStatus,
            lastWithdrawalActionId: actionId,
            lastWithdrawalDate: executionDate,
            lastWithdrawalAmount: roundMoney(actualAmount),
            updatedByUid: actor.uid,
            updatedByName: actionActorName(actor),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          transaction.set(txnRefs[index], {
            investorId: currentAction.investorId,
            investorName: currentAction.investorName || "Investor",
            advisorUid: currentAction.advisorUid || currentAction.assignedAdvisorUid || actor.uid,
            assignedAdvisorUid: currentAction.assignedAdvisorUid || currentAction.advisorUid || actor.uid,
            investorPortalUid: currentAction.investorPortalUid || null,
            source: "investor_action_workflow",
            provider: position.provider || position.source || "",
            productType: position.productType || "mutual_fund",
            positionId: position.id,
            instrumentName: position.instrumentName || position.schemeName || planned.instrumentName || "Mutual Fund",
            schemeName: position.schemeName || position.instrumentName || "",
            isin: position.isin || "",
            folioNo: position.folioNo || "",
            transactionDate: executionDate,
            transactionType: mode === "full" ? "Full Redemption" : "Partial Redemption",
            cashFlowType: "withdrawal",
            financialImpactStatus: "confirmed",
            amount: roundMoney(actualAmount),
            units: roundUnits(actualUnits),
            quantity: roundUnits(actualUnits),
            nav: roundMoney(nav),
            sourceActionId: actionId,
            provisionalActionTransaction: true,
            withdrawalBucketId: currentAction.withdrawalBucketId || "",
            withdrawalBucketName: currentAction.withdrawalBucketName || currentAction.relatedGoalName || "",
            sipInstruction,
            reference,
            notes: note || currentAction.withdrawalPurpose || currentAction.description || "",
            createdByUid: actor.uid,
            createdByName: actionActorName(actor),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          completionItems.push({
            positionId: position.id,
            instrumentName: position.instrumentName || position.schemeName || planned.instrumentName || "Mutual Fund",
            folioNo: position.folioNo || planned.folioNo || "",
            withdrawalMode: mode,
            sipInstruction,
            beforeValue: roundMoney(currentValue),
            afterValue: roundMoney(remainingValue),
            beforeUnits: roundUnits(currentUnits),
            afterUnits: roundUnits(remainingUnits),
            previousMonthlySip: roundMoney(previousSip),
            currentMonthlySip: roundMoney(nextSip),
            goalAllocationsAfter: nextGoalAllocations,
            actualAmount: roundMoney(actualAmount),
            actualUnits: roundUnits(actualUnits),
            transactionId: txnRefs[index].id
          });
        });

        transaction.set(actionRef, {
          status: "In Progress",
          financialImpactStatus: ACTION_FINANCIAL_IMPACT_STATUSES.IN_PROGRESS,
          withdrawalPortfolioApplied: true,
          withdrawalPortfolioAppliedAt: FieldValue.serverTimestamp(),
          withdrawalCompletionDraft: {
            executionDate,
            reference,
            note,
            bucketId: currentAction.withdrawalBucketId || currentAction.relatedGoalId || "",
            bucketName: currentAction.withdrawalBucketName || currentAction.relatedGoalName || "General Wealth",
            beforePortfolioValue: roundMoney(beforePortfolioValue),
            items: completionItems
          },
          updatedByUid: actor.uid,
          updatedByName: actionActorName(actor),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      });
    }

    snapshot = await actionRef.get();
    action = { id: snapshot.id, ...snapshot.data() };
    const result = await finaliseAppliedWithdrawal({ actionRef, action, actor, executionDate, reference, note });
    return Response.json({ success: true, actionId, ...result });
  } catch (error) {
    console.error("Withdrawal completion failed", error);
    return Response.json({ error: error?.message || "Unable to complete the withdrawal." }, { status: appRequestErrorStatus(error, 500) });
  }
}
