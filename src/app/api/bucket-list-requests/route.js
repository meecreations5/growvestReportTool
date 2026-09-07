import { FieldValue } from "firebase-admin/firestore";
import {
  AppRequestError,
  adminDb,
  appRequestErrorStatus,
  verifyAppRequest
} from "@/lib/server/firebaseAdmin";
import { getAccessibleActionInvestor } from "@/lib/server/actionServer";

export const runtime = "nodejs";

const STAFF_ROLES = new Set(["super_admin", "admin", "advisor"]);
const REQUEST_STATUSES = new Set(["submitted", "discussion_required", "needs_information", "discussion_completed", "confirmed", "declined"]);
const CATEGORIES = new Set(["Home", "Travel", "Education", "Financial Freedom", "Vehicle", "Wedding", "Emergency Fund", "Other"]);

function clean(value, maxLength = 500) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  return value;
}

function actorName(actor = {}) {
  return actor.fullName || actor.email || (actor.role === "investor" ? "Investor" : "GrowVest User");
}

function requestStatusLabel(status) {
  if (status === "needs_information") return "Needs your input";
  if (status === "confirmed") return "Confirmed";
  if (status === "declined") return "Not proceeding";
  if (status === "discussion_completed") return "Review with GrowVest";
  return "Review with GrowVest";
}

function goalCategory(value) {
  const category = clean(value, 80);
  return CATEGORIES.has(category) ? category : "Other";
}

async function loadRequests(investorId) {
  const snapshot = await adminDb.collection("bucketListRequests").where("investorId", "==", investorId).get();
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data(), statusLabel: requestStatusLabel(item.data()?.status) }))
    .sort((a, b) => timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt));
}

async function loadRequest(requestId) {
  const snapshot = await adminDb.collection("bucketListRequests").doc(requestId).get();
  if (!snapshot.exists) throw new AppRequestError("Bucket List request was not found.", 404, "bucket_list_request_missing");
  return { id: snapshot.id, ...snapshot.data() };
}

async function adminRecipientUids() {
  const [adminSnapshot, superAdminSnapshot] = await Promise.all([
    adminDb.collection("users").where("role", "==", "admin").get(),
    adminDb.collection("users").where("role", "==", "super_admin").get()
  ]);
  return [...new Set([...adminSnapshot.docs, ...superAdminSnapshot.docs]
    .filter((item) => item.data()?.status === "active")
    .map((item) => item.id))];
}

function notifyRecipients(batch, recipients = [], payload = {}) {
  const unique = [...new Set(recipients.map((item) => clean(item, 180)).filter(Boolean))];
  unique.forEach((recipientUid) => {
    const ref = adminDb.collection("notifications").doc();
    batch.set(ref, {
      recipientUid,
      recipientType: payload.recipientType || "investor",
      title: payload.title || "Bucket List update",
      message: payload.message || "Your Bucket List has a new update.",
      eventType: payload.eventType || "bucket_list_update",
      link: payload.link || "/investor/goals",
      investorId: payload.investorId || "",
      status: "unread",
      createdByUid: payload.createdByUid || "system",
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
      metadata: payload.metadata || {}
    });
  });
}

function confirmedGoalFromRequest(request, updates, existingGoals) {
  const targetDate = clean(updates.targetDate ?? request.targetDate, 20);
  const targetYear = targetDate ? Number(targetDate.slice(0, 4)) || "" : clean(updates.targetYear ?? request.targetYear, 8);
  const goalId = clean(request.confirmedGoalId, 180) || `goal_${request.id}`;
  return {
    id: goalId,
    goalId,
    name: clean(updates.goalName ?? request.goalName, 180),
    goalName: clean(updates.goalName ?? request.goalName, 180),
    category: goalCategory(updates.category ?? request.category),
    type: goalCategory(updates.category ?? request.category),
    targetAmount: number(updates.targetAmount ?? request.targetAmount),
    targetDate,
    targetYear,
    timeline: clean(updates.timeline ?? request.timeline, 120) || (targetDate ? `By ${targetDate}` : ""),
    monthlyContribution: number(updates.monthlyContribution ?? request.monthlyContribution),
    currentAmount: 0,
    priority: clean(updates.priority ?? request.priority, 40) || "Medium",
    notes: clean(updates.advisorNote ?? request.advisorNote ?? request.investorNote, 2000),
    status: "Active",
    isPrimary: existingGoals.length === 0,
    sourceType: "investor_request",
    approvalStatus: "confirmed",
    bucketListRequestId: request.id,
    confirmedAt: new Date().toISOString()
  };
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const { searchParams } = new URL(request.url);
    const requestedInvestorId = clean(searchParams.get("investorId"), 180);
    const investor = await getAccessibleActionInvestor(actor, requestedInvestorId);
    const items = await loadRequests(investor.id);
    return Response.json(serialise({ items }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Bucket List request read failed", error);
    return Response.json({ error: error?.message || "Unable to load Bucket List requests." }, { status: appRequestErrorStatus(error, 500) });
  }
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 60) || "create";

    if (action === "create") {
      if (actor.role !== "investor") throw new AppRequestError("Investor App access is required to submit a Bucket List request.", 403, "bucket_list_investor_required");
      const investor = await getAccessibleActionInvestor(actor, "");
      const goalName = clean(body.goalName, 180);
      if (goalName.length < 2) throw new AppRequestError("Tell us what you would like to add to your Bucket List.", 400, "bucket_list_goal_name_required");
      const category = goalCategory(body.category);
      const targetAmount = number(body.targetAmount);
      const targetDate = clean(body.targetDate, 20);
      const timeline = clean(body.timeline, 120);
      const investorNote = clean(body.investorNote, 2000);
      const requestRef = adminDb.collection("bucketListRequests").doc();
      const advisorUid = clean(investor.assignedAdvisorUid || investor.advisorUid, 180);
      const requestRecord = {
        investorId: investor.id,
        investorName: investor.fullName || investor.name || "Investor",
        clientCode: investor.clientCode || "",
        investorPortalUid: investor.investorPortalUid || investor.portalUid || actor.uid,
        advisorUid,
        assignedAdvisorUid: advisorUid,
        goalName,
        category,
        targetAmount,
        targetDate,
        timeline,
        investorNote,
        status: "submitted",
        statusLabel: requestStatusLabel("submitted"),
        investorVisible: true,
        submittedByUid: actor.uid,
        submittedByName: actorName(actor),
        submittedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      const staffRecipients = advisorUid ? [advisorUid] : await adminRecipientUids();
      const batch = adminDb.batch();
      batch.set(requestRef, requestRecord);
      if (staffRecipients.length) {
        notifyRecipients(batch, staffRecipients, {
          recipientType: advisorUid ? "advisor" : "admin",
          title: "New Bucket List request",
          message: `${requestRecord.investorName} would like to add: ${goalName}`,
          eventType: "bucket_list_request_submitted",
          link: `/investors/${investor.id}?tab=goals`,
          investorId: investor.id,
          createdByUid: actor.uid,
          metadata: { bucketListRequestId: requestRef.id }
        });
      }
      batch.set(adminDb.collection("activityLogs").doc(), {
        recordType: "bucket_list_request",
        recordId: requestRef.id,
        investorId: investor.id,
        advisorUid,
        action: "bucket_list_request_submitted",
        title: goalName,
        description: "Investor submitted a new Bucket List item for GrowVest review.",
        metadata: { category, targetAmount, targetDate },
        createdByUid: actor.uid,
        createdByName: actorName(actor),
        createdAt: FieldValue.serverTimestamp()
      });
      await batch.commit();
      return Response.json(serialise({ success: true, request: { id: requestRef.id, ...requestRecord } }));
    }

    if (action === "review") {
      if (!STAFF_ROLES.has(actor.role)) throw new AppRequestError("GrowVest staff access is required.", 403, "bucket_list_staff_required");
      const requestId = clean(body.requestId, 180);
      if (!requestId) throw new AppRequestError("Bucket List request is required.", 400, "bucket_list_request_required");
      const current = await loadRequest(requestId);
      const investor = await getAccessibleActionInvestor(actor, current.investorId);
      const nextStatus = clean(body.status, 60);
      if (!REQUEST_STATUSES.has(nextStatus) || nextStatus === "submitted") throw new AppRequestError("Select a valid review status.", 400, "bucket_list_status_invalid");

      const updates = body.updates && typeof body.updates === "object" ? body.updates : {};
      const refinedGoalName = clean(updates.goalName ?? current.goalName, 180);
      const refinedTargetAmount = number(updates.targetAmount ?? current.targetAmount);
      const refinedTargetDate = clean(updates.targetDate ?? current.targetDate, 20);
      if (nextStatus === "confirmed" && String(current.status || "") !== "discussion_completed") {
        throw new AppRequestError("Mark the investor discussion complete before confirming this goal.", 400, "bucket_list_discussion_required_before_confirm");
      }
      if (nextStatus === "confirmed") {
        if (!refinedGoalName) throw new AppRequestError("Goal name is required before confirmation.", 400, "bucket_list_confirm_name_required");
        if (!(refinedTargetAmount > 0)) throw new AppRequestError("Confirm the target amount after discussing the goal with the investor.", 400, "bucket_list_confirm_amount_required");
        if (!refinedTargetDate) throw new AppRequestError("Confirm the target date after discussing the goal with the investor.", 400, "bucket_list_confirm_date_required");
      }

      const currentGoals = Array.isArray(investor.bucketList) && investor.bucketList.length
        ? investor.bucketList
        : (Array.isArray(investor.goals) ? investor.goals : []);
      const goal = nextStatus === "confirmed" ? confirmedGoalFromRequest(current, updates, currentGoals) : null;
      const requestUpdates = {
        goalName: refinedGoalName,
        category: goalCategory(updates.category ?? current.category),
        targetAmount: refinedTargetAmount,
        targetDate: refinedTargetDate,
        timeline: clean(updates.timeline ?? current.timeline, 120),
        monthlyContribution: number(updates.monthlyContribution ?? current.monthlyContribution),
        priority: clean(updates.priority ?? current.priority, 40),
        advisorNote: clean(updates.advisorNote ?? current.advisorNote, 2000),
        status: nextStatus,
        statusLabel: requestStatusLabel(nextStatus),
        reviewedByUid: actor.uid,
        reviewedByName: actorName(actor),
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(goal ? { confirmedGoalId: goal.id, confirmedAt: FieldValue.serverTimestamp() } : {})
      };

      const batch = adminDb.batch();
      batch.set(adminDb.collection("bucketListRequests").doc(requestId), requestUpdates, { merge: true });
      if (goal) {
        const exists = currentGoals.some((item) => String(item.id || item.goalId || "") === String(goal.id));
        const nextGoals = exists
          ? currentGoals.map((item) => String(item.id || item.goalId || "") === String(goal.id) ? { ...item, ...goal } : item)
          : [...currentGoals, goal];
        batch.set(adminDb.collection("investors").doc(investor.id), {
          bucketList: nextGoals,
          goals: nextGoals,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const investorPortalUid = clean(investor.investorPortalUid || investor.portalUid || current.investorPortalUid, 180);
      if (investorPortalUid) {
        const title = nextStatus === "confirmed"
          ? "Your Bucket List has been updated"
          : nextStatus === "needs_information"
            ? "A little more information is needed"
            : nextStatus === "declined"
              ? "Bucket List request updated"
              : "GrowVest is reviewing your Bucket List";
        const message = nextStatus === "confirmed"
          ? `${refinedGoalName} is now part of your GrowVest plan.`
          : nextStatus === "needs_information"
            ? `GrowVest would like to discuss ${refinedGoalName} with you.`
            : nextStatus === "declined"
              ? `${refinedGoalName} is not being added to your active plan at this time.`
              : `${refinedGoalName} is ready for discussion with your GrowVest Partner.`;
        notifyRecipients(batch, [investorPortalUid], {
          recipientType: "investor",
          title,
          message,
          eventType: `bucket_list_request_${nextStatus}`,
          link: "/investor/goals",
          investorId: investor.id,
          createdByUid: actor.uid,
          metadata: { bucketListRequestId: requestId, confirmedGoalId: goal?.id || "" }
        });
      }

      batch.set(adminDb.collection("activityLogs").doc(), {
        recordType: "bucket_list_request",
        recordId: requestId,
        investorId: investor.id,
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        action: `bucket_list_request_${nextStatus}`,
        title: refinedGoalName,
        description: `${actorName(actor)} changed the Bucket List request to ${requestStatusLabel(nextStatus)}.`,
        metadata: { status: nextStatus, confirmedGoalId: goal?.id || "" },
        createdByUid: actor.uid,
        createdByName: actorName(actor),
        createdAt: FieldValue.serverTimestamp()
      });
      await batch.commit();
      return Response.json(serialise({ success: true, status: nextStatus, goal }));
    }

    throw new AppRequestError("Unsupported Bucket List request action.", 400, "bucket_list_action_invalid");
  } catch (error) {
    console.error("Bucket List request update failed", error);
    return Response.json({ error: error?.message || "Unable to update Bucket List request." }, { status: appRequestErrorStatus(error, 500) });
  }
}
