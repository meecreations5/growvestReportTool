import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { createPortfolioSnapshot, getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { positionId } = await params;
    const payload = await request.json();
    const positionRef = adminDb.collection("portfolioPositions").doc(positionId);
    const positionSnapshot = await positionRef.get();
    if (!positionSnapshot.exists) return Response.json({ error: "Portfolio position was not found." }, { status: 404 });
    const position = positionSnapshot.data();
    const investor = await getAccessibleInvestor(actor, position.investorId);

    const goalId = String(payload?.goalId || "").trim();
    let goalAllocations = [];
    if (goalId) {
      const goals = Array.isArray(investor.bucketList) && investor.bucketList.length ? investor.bucketList : (investor.goals || []);
      const goal = goals.find((item) => String(item.id || item.goalId) === goalId);
      if (!goal) return Response.json({ error: "The selected Goal / Bucket List no longer exists." }, { status: 400 });
      goalAllocations = [{
        goalId,
        goalName: goal.name || goal.goalName || "Goal",
        percentage: 100
      }];
    }

    const previousGoal = Array.isArray(position.goalAllocations)
      ? position.goalAllocations.find((item) => item?.goalId)
      : null;
    const nextGoal = goalAllocations[0] || null;

    await positionRef.update({
      goalAllocations,
      allocationStatus: goalAllocations.length ? "allocated" : "general_wealth",
      goalAllocationSource: "staff",
      goalAllocationUpdatedAt: FieldValue.serverTimestamp(),
      goalAllocationUpdatedByUid: actor.uid,
      goalAllocationUpdatedByName: actor.fullName || actor.email || "GrowVest User",
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: actor.fullName || actor.email || "GrowVest User"
    });

    if (String(previousGoal?.goalId || "") !== String(nextGoal?.goalId || "")) {
      await adminDb.collection("activityLogs").add({
        recordType: "portfolio_goal_allocation",
        recordId: positionId,
        investorId: position.investorId,
        clientCode: investor.clientCode || position.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        action: "portfolio_goal_allocation_changed",
        title: "Portfolio goal allocation updated",
        description: `${position.instrumentName || position.schemeName || position.stockName || "Investment"} was moved from ${previousGoal?.goalName || "General Wealth"} to ${nextGoal?.goalName || "General Wealth"}.`,
        metadata: {
          positionId,
          productType: position.productType || "",
          previousGoalId: previousGoal?.goalId || "",
          previousGoalName: previousGoal?.goalName || "General Wealth",
          nextGoalId: nextGoal?.goalId || "",
          nextGoalName: nextGoal?.goalName || "General Wealth"
        },
        createdByUid: actor.uid,
        createdByName: actor.fullName || actor.email || "GrowVest User",
        createdAt: FieldValue.serverTimestamp()
      });
    }

    const snapshot = await createPortfolioSnapshot(position.investorId, actor, {
      snapshotDate: indiaDateKey(),
      verificationStatus: "verified",
      sourceImportId: position.sourceImportId || null
    });

    return Response.json({ positionId, goalAllocations, snapshot });
  } catch (error) {
    console.error("Portfolio goal allocation failed", error);
    return Response.json({ error: error?.message || "Unable to update goal allocation." }, { status: appRequestErrorStatus(error, 500) });
  }
}
