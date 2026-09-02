import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  adminDb,
  appRequestErrorStatus,
  verifyAppRequest,
  verifyStaffRequest,
  AppRequestError
} from "@/lib/server/firebaseAdmin";
import {
  buildInsurancePortfolioOverview,
  buildInsuranceProtectionSnapshot,
  getAccessibleInsuranceInvestor,
  insuranceEventPayload,
  insuranceNotification,
  loadInsurancePoliciesForInvestor,
  normaliseInsurancePayload,
  serialiseInsuranceRecord
} from "@/lib/server/insuranceServer";

export const runtime = "nodejs";

function staffOnly(actor) {
  if (!["super_admin", "admin", "advisor"].includes(actor.role)) {
    throw new AppRequestError("This action is available to GrowVest staff only.", 403, "staff_role_required");
  }
}

async function policyForActor(actor, policyId) {
  const snapshot = await adminDb.collection("insurancePolicies").doc(policyId).get();
  if (!snapshot.exists) throw new AppRequestError("Insurance policy was not found.", 404, "insurance_policy_missing");
  const policy = { id: snapshot.id, ...snapshot.data() };
  await getAccessibleInsuranceInvestor(actor, policy.investorId);
  return policy;
}

function activityPayload({ actor, investor, policyId, action, title, description, metadata = {} }) {
  return {
    recordType: "investor",
    recordId: investor.id,
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    insurancePolicyId: policyId,
    action,
    title,
    description,
    metadata,
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "GrowVest",
    createdAt: FieldValue.serverTimestamp()
  };
}

async function addPolicyUpdateNotification(batch, actor, investor, policyId, policy, actionLabel) {
  const investorUid = investor.investorPortalUid || investor.portalUid || null;
  const note = insuranceNotification({
    recipientUid: investorUid,
    recipientType: "investor",
    title: `Insurance ${actionLabel}`,
    message: `${policy.productName || "Insurance policy"} (${policy.policyNumber}) was ${actionLabel}.`,
    investorId: investor.id,
    policyId,
    actorUid: actor.uid
  });
  if (note) batch.set(adminDb.collection("notifications").doc(), note);
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get("asOfDate") || new Date().toISOString().slice(0, 10);

    if (searchParams.get("scope") === "portfolio") {
      staffOnly(actor);
      const overview = await buildInsurancePortfolioOverview(actor, asOfDate);
      return NextResponse.json({ success: true, ...overview });
    }

    const investor = await getAccessibleInsuranceInvestor(actor, searchParams.get("investorId") || "");
    const policies = await loadInsurancePoliciesForInvestor(investor.id);
    return NextResponse.json({
      success: true,
      investor: { id: investor.id, fullName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "" },
      policies: policies.map(serialiseInsuranceRecord),
      protectionSnapshot: buildInsuranceProtectionSnapshot(policies, asOfDate)
    });
  } catch (error) {
    console.error("Insurance load failed", error);
    return NextResponse.json({ error: error.message || "Unable to load insurance policies." }, { status: appRequestErrorStatus(error, 500) });
  }
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    staffOnly(actor);
    const body = await request.json();
    const action = String(body.action || "create");

    if (action === "create") {
      const investor = await getAccessibleInsuranceInvestor(actor, body.investorId);
      const record = normaliseInsurancePayload(body.policy || {}, { actor, investor, source: "manual" });
      const policyRef = adminDb.collection("insurancePolicies").doc();
      const batch = adminDb.batch();
      batch.set(policyRef, record);
      batch.set(adminDb.collection("insurancePolicyEvents").doc(), insuranceEventPayload({ policyId: policyRef.id, policy: record, actor, eventType: "policy_created", note: "Insurance policy added to GrowVest Protection." }));
      batch.set(adminDb.collection("activityLogs").doc(), activityPayload({ actor, investor, policyId: policyRef.id, action: "insurance_policy_created", title: "Insurance policy added", description: `${record.productName} · ${record.policyNumber}`, metadata: { insuranceType: record.insuranceType } }));
      await addPolicyUpdateNotification(batch, actor, investor, policyRef.id, record, "added");
      await batch.commit();
      return NextResponse.json({ success: true, policyId: policyRef.id });
    }

    const existing = await policyForActor(actor, body.policyId);
    const investor = await getAccessibleInsuranceInvestor(actor, existing.investorId);

    if (action === "update") {
      const record = normaliseInsurancePayload({ ...existing, ...(body.policy || {}) }, { actor, investor, existing, source: existing.source || "manual" });
      const batch = adminDb.batch();
      batch.set(adminDb.collection("insurancePolicies").doc(existing.id), record, { merge: true });
      batch.set(adminDb.collection("insurancePolicyEvents").doc(), insuranceEventPayload({ policyId: existing.id, policy: { ...existing, ...record }, actor, eventType: "policy_updated", note: body.note || "Insurance policy details updated." }));
      batch.set(adminDb.collection("activityLogs").doc(), activityPayload({ actor, investor, policyId: existing.id, action: "insurance_policy_updated", title: "Insurance policy updated", description: `${record.productName} · ${record.policyNumber}` }));
      await addPolicyUpdateNotification(batch, actor, investor, existing.id, record, "updated");
      await batch.commit();
      return NextResponse.json({ success: true, policyId: existing.id });
    }

    if (action === "status") {
      const nextStatus = String(body.status || "").trim();
      if (!nextStatus) throw new AppRequestError("Policy status is required.", 400, "insurance_status_required");
      const batch = adminDb.batch();
      batch.update(adminDb.collection("insurancePolicies").doc(existing.id), {
        policyStatus: nextStatus,
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest",
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.set(adminDb.collection("insurancePolicyEvents").doc(), insuranceEventPayload({ policyId: existing.id, policy: existing, actor, eventType: "status_changed", note: body.note || `Policy status changed to ${nextStatus}.`, fromStatus: existing.policyStatus || "", toStatus: nextStatus }));
      batch.set(adminDb.collection("activityLogs").doc(), activityPayload({ actor, investor, policyId: existing.id, action: "insurance_policy_status_changed", title: "Insurance status updated", description: `${existing.productName} · ${existing.policyNumber} · ${nextStatus}`, metadata: { fromStatus: existing.policyStatus || "", toStatus: nextStatus } }));
      await batch.commit();
      return NextResponse.json({ success: true, policyId: existing.id });
    }

    if (action === "renew") {
      const newPolicyInput = body.policy || {};
      const newRef = adminDb.collection("insurancePolicies").doc();
      const renewalRecord = normaliseInsurancePayload({
        ...existing,
        ...newPolicyInput,
        policyStatus: newPolicyInput.policyStatus || "Active",
        renewalSequence: Number(existing.renewalSequence || 1) + 1,
        renewedFromPolicyId: existing.id,
        previousPolicyId: existing.id,
        renewedToPolicyId: ""
      }, { actor, investor, source: "renewal" });
      const batch = adminDb.batch();
      batch.set(newRef, renewalRecord);
      batch.update(adminDb.collection("insurancePolicies").doc(existing.id), {
        policyStatus: "Renewed",
        renewedToPolicyId: newRef.id,
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest",
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.set(adminDb.collection("insurancePolicyEvents").doc(), insuranceEventPayload({ policyId: existing.id, policy: existing, actor, eventType: "policy_renewed", note: `Renewed into policy ${renewalRecord.policyNumber}.`, fromStatus: existing.policyStatus || "Active", toStatus: "Renewed", metadata: { renewedToPolicyId: newRef.id } }));
      batch.set(adminDb.collection("insurancePolicyEvents").doc(), insuranceEventPayload({ policyId: newRef.id, policy: renewalRecord, actor, eventType: "renewal_created", note: `Renewal created from policy ${existing.policyNumber}.`, metadata: { renewedFromPolicyId: existing.id } }));
      batch.set(adminDb.collection("activityLogs").doc(), activityPayload({ actor, investor, policyId: newRef.id, action: "insurance_policy_renewed", title: "Insurance policy renewed", description: `${renewalRecord.productName} · ${existing.policyNumber} → ${renewalRecord.policyNumber}`, metadata: { oldPolicyId: existing.id, newPolicyId: newRef.id } }));
      await addPolicyUpdateNotification(batch, actor, investor, newRef.id, renewalRecord, "renewed");
      await batch.commit();
      return NextResponse.json({ success: true, policyId: newRef.id, renewedFromPolicyId: existing.id });
    }

    throw new AppRequestError("Unsupported insurance action.", 400, "insurance_action_invalid");
  } catch (error) {
    console.error("Insurance mutation failed", error);
    return NextResponse.json({ error: error.message || "Unable to update insurance." }, { status: appRequestErrorStatus(error, 500) });
  }
}
