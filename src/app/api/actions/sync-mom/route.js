import { FieldValue } from "firebase-admin/firestore";
import { adminDb, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { actionActorName, actionCode, actionEventPayload, cleanActionText } from "@/lib/server/actionServer";

export const runtime = "nodejs";

function safeId(value = "") {
  return String(value || "action").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120) || "action";
}

function mapStatus(value) {
  const status = String(value || "").toLowerCase();
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "in_progress") return "In Progress";
  return "Recommended";
}

function mapPriority(value) {
  const priority = String(value || "").toLowerCase();
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  if (priority === "low") return "Low";
  return "Planned";
}

function mapOwner(value) {
  if (value === "investor") return "Investor";
  if (value === "advisor") return "Advisor";
  if (value === "admin") return "GrowVest";
  return "Joint";
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const body = await request.json().catch(() => ({}));
    const momId = cleanActionText(body.momId, 180);
    if (!momId) return Response.json({ error: "MOM is required." }, { status: 400 });
    const momSnapshot = await adminDb.collection("meetingMinutes").doc(momId).get();
    if (!momSnapshot.exists) return Response.json({ error: "MOM was not found." }, { status: 404 });
    const mom = { id: momSnapshot.id, ...momSnapshot.data() };
    if (!canStaffAccessRecord(actor, mom)) return Response.json({ error: "You are not authorised to sync this MOM." }, { status: 403 });
    if (!mom.investorId) return Response.json({ success: true, synced: 0 });

    const items = Array.isArray(mom.actionItems) ? mom.actionItems : [];
    const batch = adminDb.batch();
    let synced = 0;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] || {};
      const description = cleanActionText(item.description, 3000);
      if (!description) continue;
      const ref = adminDb.collection("investorActions").doc(`${safeId(momId)}_${safeId(item.id || index)}`);
      const existingSnapshot = await ref.get();
      const existing = existingSnapshot.exists ? existingSnapshot.data() : null;
      const mappedStatus = mapStatus(item.status);
      const advisorUid = mom.assignedAdvisorUid || mom.advisorUid || actor.uid;
      const investorVisible = Boolean(mom.investorVisible && item.clientVisible);
      const base = {
        investorId: mom.investorId,
        investorName: mom.investorName || "Investor",
        clientCode: mom.clientCode || "",
        investorPortalUid: mom.investorPortalUid || null,
        advisorUid,
        assignedAdvisorUid: advisorUid,
        requestType: "Meeting Action",
        recommendationType: "Portfolio Review",
        title: description.slice(0, 240),
        description,
        status: existing ? existing.status || mappedStatus : mappedStatus,
        priority: mapPriority(item.priority),
        owner: mapOwner(item.ownerType),
        investorDecision: existing?.investorDecision || "Pending Discussion",
        dueDate: cleanActionText(item.dueDate, 20),
        completionDate: mappedStatus === "Completed" ? (existing?.completionDate || cleanActionText(item.dueDate, 20)) : (existing?.completionDate || ""),
        sourceType: "meeting",
        sourceMeetingId: mom.meetingId || "",
        sourceMomId: momId,
        investorVisible: existing ? (existing.investorVisible || investorVisible) : investorVisible,
        lastMeetingId: mom.meetingId || "",
        updatedByUid: actor.uid,
        updatedByName: actionActorName(actor),
        updatedAt: FieldValue.serverTimestamp()
      };
      if (existing) {
        if (["Completed", "Cancelled"].includes(mappedStatus)) base.status = mappedStatus;
        batch.set(ref, base, { merge: true });
      } else {
        batch.set(ref, {
          ...base,
          actionCode: actionCode(ref.id),
          requestedByUid: actor.uid,
          requestedByRole: actor.role,
          requestedByName: actionActorName(actor),
          requestedAt: FieldValue.serverTimestamp(),
          createdByUid: actor.uid,
          createdByName: actionActorName(actor),
          createdAt: FieldValue.serverTimestamp()
        });
        batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
          actionId: ref.id,
          action: base,
          actor,
          eventType: "meeting_action_created",
          note: description,
          toStatus: base.status,
          investorVisible
        }));
      }
      synced += 1;
    }
    await batch.commit();
    return Response.json({ success: true, synced });
  } catch (error) {
    console.error("MOM action sync failed", error);
    return Response.json({ error: error?.message || "Unable to sync MOM actions." }, { status: 500 });
  }
}
