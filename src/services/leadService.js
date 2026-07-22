import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/constants/roles";
import { combineLocalDateTime } from "@/lib/utils/date";

async function nextLeadCode() {
  const counterRef = doc(db, "counters", "leads");
  const next = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const current = snapshot.exists() ? Number(snapshot.data().value || 0) : 0;
    const value = current + 1;
    transaction.set(counterRef, { value, updatedAt: serverTimestamp() }, { merge: true });
    return value;
  });

  return `GV-LD-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
}

function timestampFromLocal(date, time) {
  const value = combineLocalDateTime(date, time);
  return value ? Timestamp.fromDate(value) : null;
}

function activityPayload({ lead, leadId, currentUser, action, title, description, metadata = {} }) {
  return {
    recordType: "lead",
    recordId: leadId,
    leadId,
    leadCode: lead.leadCode,
    leadName: lead.fullName,
    advisorUid: lead.assignedAdvisorUid,
    assignedAdvisorUid: lead.assignedAdvisorUid,
    action,
    title,
    description,
    metadata,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  };
}

export async function createLead(payload, currentUser) {
  const leadCode = await nextLeadCode();
  const leadRef = doc(collection(db, "leads"));
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const receivedAt = timestampFromLocal(payload.dateReceived, payload.timeReceived);
  const lead = {
    ...payload,
    leadCode,
    receivedAt,
    statusChangedAt: serverTimestamp(),
    stageEnteredAt: serverTimestamp(),
    lastContactAt: null,
    lastContactChannel: null,
    lastContactDate: null,
    nextAction: payload.notes || "",
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    isDeleted: false,
    convertedInvestorId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  batch.set(leadRef, lead);
  batch.set(
    activityRef,
    activityPayload({
      lead: { ...lead, leadCode },
      leadId: leadRef.id,
      currentUser,
      action: "lead_created",
      title: "Lead created",
      description: `${leadCode} was created and assigned to ${payload.assignedAdvisorName}.`
    })
  );
  await batch.commit();
  return leadRef;
}

export function subscribeLeads(currentUser, callback, onError, options = {}) {
  const base = collection(db, "leads");
  const isPrivileged = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser.role);
  const archived = Boolean(options.archived);
  const constraints = isPrivileged
    ? [where("isDeleted", "==", archived), orderBy("createdAt", "desc"), limit(100)]
    : [where("assignedAdvisorUid", "==", currentUser.id), where("isDeleted", "==", archived), orderBy("createdAt", "desc"), limit(100)];

  return onSnapshot(
    query(base, ...constraints),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeLead(leadId, callback, onError) {
  return onSnapshot(
    doc(db, "leads", leadId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export function subscribeLeadFollowUps(leadId, callback, onError) {
  return onSnapshot(
    query(collection(db, "leadFollowUps"), where("leadId", "==", leadId), orderBy("contactAt", "desc"), limit(100)),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeLeadActivities(leadId, callback, onError) {
  return onSnapshot(
    query(
      collection(db, "activityLogs"),
      where("recordType", "==", "lead"),
      where("recordId", "==", leadId),
      orderBy("createdAt", "desc"),
      limit(100)
    ),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function addLeadFollowUp(lead, payload, currentUser) {
  const followUpRef = doc(collection(db, "leadFollowUps"));
  const activityRef = doc(collection(db, "activityLogs"));
  const leadRef = doc(db, "leads", lead.id);
  const batch = writeBatch(db);
  const contactAt = timestampFromLocal(payload.contactDate, payload.contactTime);
  const statusChanged = payload.statusAfter !== lead.status;

  const followUp = {
    leadId: lead.id,
    leadCode: lead.leadCode,
    leadName: lead.fullName,
    advisorUid: lead.assignedAdvisorUid,
    assignedAdvisorUid: lead.assignedAdvisorUid,
    advisorName: lead.assignedAdvisorName,
    contactAt,
    contactDate: payload.contactDate,
    contactTime: payload.contactTime,
    channel: payload.channel,
    summary: payload.summary,
    clientResponse: payload.clientResponse || "",
    statusBefore: lead.status,
    statusAfter: payload.statusAfter,
    lapseReason: payload.lapseReason || "",
    nextAction: payload.nextAction,
    followUpDue: payload.followUpDue || "",
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const leadUpdates = {
    status: payload.statusAfter,
    lastContactAt: contactAt,
    lastContactChannel: payload.channel,
    lastContactDate: payload.contactDate,
    lastContactSummary: payload.summary,
    nextAction: payload.nextAction,
    followUpDue: payload.followUpDue || "",
    lapseReason: payload.lapseReason || "",
    notes: payload.nextAction,
    updatedAt: serverTimestamp()
  };

  if (statusChanged) {
    leadUpdates.statusChangedAt = serverTimestamp();
    leadUpdates.stageEnteredAt = serverTimestamp();
  }
  if (payload.statusAfter === "IN PROPOSAL" && lead.status !== "IN PROPOSAL") {
    leadUpdates.proposalSentAt = contactAt || serverTimestamp();
  }
  if (payload.statusAfter === "CONVERTED" && lead.status !== "CONVERTED") {
    leadUpdates.convertedAt = contactAt || serverTimestamp();
  }

  batch.set(followUpRef, followUp);
  batch.update(leadRef, leadUpdates);
  batch.set(
    activityRef,
    activityPayload({
      lead,
      leadId: lead.id,
      currentUser,
      action: statusChanged ? "follow_up_and_status_changed" : "follow_up_added",
      title: statusChanged ? `Follow-up added · ${lead.status} → ${payload.statusAfter}` : "Follow-up added",
      description: payload.summary,
      metadata: {
        channel: payload.channel,
        statusBefore: lead.status,
        statusAfter: payload.statusAfter,
        nextAction: payload.nextAction,
        followUpDue: payload.followUpDue || null
      }
    })
  );

  await batch.commit();
  return followUpRef;
}

export async function changeLeadStatus(lead, payload, currentUser) {
  const leadRef = doc(db, "leads", lead.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const changed = payload.status !== lead.status;

  const updates = {
    status: payload.status,
    nextAction: payload.nextAction || lead.nextAction || "",
    followUpDue: payload.followUpDue || lead.followUpDue || "",
    lapseReason: payload.lapseReason || "",
    updatedAt: serverTimestamp()
  };

  if (changed) {
    updates.statusChangedAt = serverTimestamp();
    updates.stageEnteredAt = serverTimestamp();
  }
  if (payload.status === "IN PROPOSAL" && lead.status !== "IN PROPOSAL") updates.proposalSentAt = serverTimestamp();
  if (payload.status === "CONVERTED" && lead.status !== "CONVERTED") updates.convertedAt = serverTimestamp();

  batch.update(leadRef, updates);
  batch.set(
    activityRef,
    activityPayload({
      lead,
      leadId: lead.id,
      currentUser,
      action: "lead_status_changed",
      title: changed ? `Status changed · ${lead.status} → ${payload.status}` : "Lead action updated",
      description: payload.note || payload.nextAction || "Lead pipeline details were updated.",
      metadata: {
        statusBefore: lead.status,
        statusAfter: payload.status,
        nextAction: payload.nextAction || null,
        followUpDue: payload.followUpDue || null
      }
    })
  );

  await batch.commit();
}

export async function getActiveAdvisors() {
  const snapshot = await getDocs(query(collection(db, "users"), where("role", "==", USER_ROLES.ADVISOR), where("status", "==", "active"), orderBy("fullName")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getLead(leadId) {
  const snapshot = await getDoc(doc(db, "leads", leadId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateLeadDetails(lead, payload, currentUser) {
  const selectedAdvisorChanged = payload.assignedAdvisorUid !== lead.assignedAdvisorUid;
  const leadRef = doc(db, "leads", lead.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const receivedAt = timestampFromLocal(payload.dateReceived, payload.timeReceived);

  const updates = {
    fullName: payload.fullName,
    contactNo: payload.contactNo,
    email: payload.email,
    leadSource: payload.leadSource,
    referrer: payload.referrer || "",
    dateReceived: payload.dateReceived,
    timeReceived: payload.timeReceived,
    receivedAt,
    assignedAdvisorUid: payload.assignedAdvisorUid,
    assignedAdvisorName: payload.assignedAdvisorName,
    serviceType: payload.serviceType,
    amount: payload.amount ?? null,
    qualificationScore: payload.qualificationScore ?? null,
    purposeOfInvestment: payload.purposeOfInvestment || "",
    followUpDue: payload.followUpDue || "",
    notes: payload.notes || "",
    nextAction: payload.notes || lead.nextAction || "",
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName
  };

  if (payload.status !== lead.status) {
    updates.status = payload.status;
    updates.statusChangedAt = serverTimestamp();
    updates.stageEnteredAt = serverTimestamp();
  }

  batch.update(leadRef, updates);

  if (selectedAdvisorChanged) {
    const relatedCollections = ["leadFollowUps", "clientAssessments"];
    for (const collectionName of relatedCollections) {
      const related = await getDocs(query(collection(db, collectionName), where("leadId", "==", lead.id)));
      related.docs.forEach((item) => batch.update(item.ref, {
        assignedAdvisorUid: payload.assignedAdvisorUid,
        advisorUid: payload.assignedAdvisorUid,
        advisorName: payload.assignedAdvisorName,
        updatedAt: serverTimestamp()
      }));
    }

    const relatedActivities = await getDocs(query(
      collection(db, "activityLogs"),
      where("recordType", "==", "lead"),
      where("recordId", "==", lead.id)
    ));
    relatedActivities.docs.forEach((item) => batch.update(item.ref, {
      advisorUid: payload.assignedAdvisorUid,
      assignedAdvisorUid: payload.assignedAdvisorUid
    }));

    if (lead.convertedInvestorId) {
      batch.update(doc(db, "investors", lead.convertedInvestorId), {
        assignedAdvisorUid: payload.assignedAdvisorUid,
        assignedAdvisorName: payload.assignedAdvisorName,
        advisorUid: payload.assignedAdvisorUid,
        advisorName: payload.assignedAdvisorName,
        updatedAt: serverTimestamp()
      });
    }
  }

  batch.set(
    activityRef,
    activityPayload({
      lead: { ...lead, ...updates },
      leadId: lead.id,
      currentUser,
      action: selectedAdvisorChanged ? "lead_reassigned" : "lead_updated",
      title: selectedAdvisorChanged ? "Lead reassigned" : "Lead details updated",
      description: selectedAdvisorChanged
        ? `${lead.assignedAdvisorName || "Unassigned"} → ${payload.assignedAdvisorName}`
        : "Lead contact and opportunity details were updated.",
      metadata: {
        previousAdvisorUid: lead.assignedAdvisorUid || null,
        assignedAdvisorUid: payload.assignedAdvisorUid,
        previousStatus: lead.status,
        status: payload.status
      }
    })
  );

  await batch.commit();
}

export async function setLeadArchived(lead, archived, currentUser) {
  const leadRef = doc(db, "leads", lead.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);

  batch.update(leadRef, {
    isDeleted: archived,
    archivedAt: archived ? serverTimestamp() : null,
    archivedByUid: archived ? currentUser.id : null,
    updatedAt: serverTimestamp()
  });
  batch.set(
    activityRef,
    activityPayload({
      lead,
      leadId: lead.id,
      currentUser,
      action: archived ? "lead_archived" : "lead_restored",
      title: archived ? "Lead archived" : "Lead restored",
      description: `${lead.leadCode} was ${archived ? "archived" : "restored"}.`
    })
  );

  await batch.commit();
}
