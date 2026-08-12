import {
  Timestamp,
  collection,
  doc,
  getDoc,
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
import { combineLocalDateTime } from "@/lib/utils/date";
import { addNotificationToBatch } from "@/services/notificationService";
import { syncMomActions } from "@/services/actionService";

function sanitize(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

function timestampFromLocal(date, time = "09:00") {
  const parsed = combineLocalDateTime(date, time);
  return parsed ? Timestamp.fromDate(parsed) : null;
}

async function nextMomCode() {
  const counterRef = doc(db, "counters", "meetingMinutes");
  const value = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const current = snapshot.exists() ? Number(snapshot.data().value || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
  return `GV-MOM-${new Date().getFullYear()}-${String(value).padStart(4, "0")}`;
}

function normaliseRows(rows = []) {
  return rows.map((item) => ({ ...item, id: item.id || crypto.randomUUID() }));
}

function resolveActionItems(rows = [], record = {}) {
  return normaliseRows(rows).map((item) => {
    if (item.ownerType === "investor") {
      return {
        ...item,
        assignedToUid: record.investorPortalUid || "",
        assignedToName: item.assignedToName || record.investorName || "Investor"
      };
    }
    if (item.ownerType === "advisor") {
      return {
        ...item,
        assignedToUid: record.advisorUid || "",
        assignedToName: item.assignedToName || record.advisorName || "Advisor"
      };
    }
    return item;
  });
}

export async function createMom(meeting, payload, currentUser) {
  const momCode = await nextMomCode();
  const momRef = doc(collection(db, "meetingMinutes"));
  const meetingRef = doc(db, "meetings", meeting.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const decisions = normaliseRows(payload.decisions || []);
  const actionItems = resolveActionItems(payload.actionItems || [], meeting);

  const mom = sanitize({
    momCode,
    meetingId: meeting.id,
    meetingCode: meeting.meetingCode,
    meetingTitle: meeting.title,
    meetingDate: meeting.meetingDate,
    linkedType: meeting.linkedType,
    investorId: meeting.investorId || null,
    investorName: meeting.investorName || "",
    investorEmail: meeting.investorEmail || "",
    investorMobile: meeting.investorMobile || "",
    investorPortalUid: meeting.investorPortalUid || null,
    clientCode: meeting.clientCode || "",
    leadId: meeting.leadId || null,
    leadName: meeting.leadName || "",
    leadCode: meeting.leadCode || "",
    advisorUid: meeting.advisorUid,
    assignedAdvisorUid: meeting.advisorUid,
    advisorName: meeting.advisorName,
    advisorEmail: meeting.advisorEmail || "",
    attendees: meeting.attendees || [],
    agenda: meeting.agenda || [],
    discussionSummary: payload.discussionSummary,
    clientRequirements: payload.clientRequirements,
    goalsDiscussed: payload.goalsDiscussed,
    investmentsDiscussed: payload.investmentsDiscussed,
    liabilitiesDiscussed: payload.liabilitiesDiscussed,
    clientConcerns: payload.clientConcerns,
    familyInputs: payload.familyInputs,
    advisorObservations: payload.advisorObservations,
    internalNotes: payload.internalNotes,
    clientSummary: payload.clientSummary,
    decisions,
    actionItems,
    clientVisibleActionItems: actionItems.filter((item) => item.clientVisible),
    investorVisible: Boolean(payload.investorVisible),
    status: payload.status,
    followUpRequired: Boolean(payload.followUpRequired),
    followUpDate: payload.followUpDate || "",
    followUpTime: payload.followUpTime || "",
    followUpPurpose: payload.followUpPurpose || "",
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: payload.status === "completed" ? serverTimestamp() : null
  });

  batch.set(momRef, mom);
  batch.update(meetingRef, {
    momId: momRef.id,
    status: payload.status === "completed" ? "completed" : meeting.status,
    completedAt: payload.status === "completed" ? serverTimestamp() : meeting.completedAt || null,
    updatedAt: serverTimestamp()
  });
  batch.set(activityRef, {
    recordType: "meeting",
    recordId: meeting.id,
    meetingId: meeting.id,
    momId: momRef.id,
    momCode,
    investorId: meeting.investorId || null,
    leadId: meeting.leadId || null,
    advisorUid: meeting.advisorUid,
    assignedAdvisorUid: meeting.advisorUid,
    action: payload.status === "completed" ? "mom_completed" : "mom_draft_created",
    title: payload.status === "completed" ? "MOM completed" : "MOM draft created",
    description: payload.clientSummary || payload.discussionSummary,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  });

  if (payload.followUpRequired) {
    const followUpRef = doc(collection(db, "followUps"));
    batch.set(followUpRef, {
      linkedType: meeting.linkedType,
      investorId: meeting.investorId || null,
      investorName: meeting.investorName || "",
      leadId: meeting.leadId || null,
      leadName: meeting.leadName || "",
      meetingId: meeting.id,
      momId: momRef.id,
      advisorUid: meeting.advisorUid,
      assignedAdvisorUid: meeting.advisorUid,
      advisorName: meeting.advisorName,
      followUpDate: payload.followUpDate,
      followUpTime: payload.followUpTime || "",
      followUpAt: timestampFromLocal(payload.followUpDate, payload.followUpTime || "09:00"),
      purpose: payload.followUpPurpose,
      status: "pending",
      createdByUid: currentUser.id,
      createdByName: currentUser.fullName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    addNotificationToBatch(batch, {
      recipientUid: meeting.advisorUid,
      recipientType: "advisor",
      title: "Follow-up created",
      message: `${payload.followUpPurpose} is due on ${payload.followUpDate}.`,
      eventType: "follow_up_created",
      link: `/meetings/${meeting.id}`,
      investorId: meeting.investorId,
      leadId: meeting.leadId,
      meetingId: meeting.id,
      momId: momRef.id,
      createdByUid: currentUser.id
    });
  }

  actionItems.forEach((item) => {
    if (item.assignedToUid) {
      addNotificationToBatch(batch, {
        recipientUid: item.assignedToUid,
        recipientType: item.ownerType,
        title: "Action item assigned",
        message: `${item.description}${item.dueDate ? ` · Due ${item.dueDate}` : ""}`,
        eventType: "action_assigned",
        link: item.ownerType === "investor" ? "/investor/meetings" : `/mom/${momRef.id}`,
        investorId: meeting.investorId,
        leadId: meeting.leadId,
        meetingId: meeting.id,
        momId: momRef.id,
        createdByUid: currentUser.id
      });
    }
  });

  if (payload.status === "completed" && payload.investorVisible && meeting.investorPortalUid) {
    addNotificationToBatch(batch, {
      recipientUid: meeting.investorPortalUid,
      recipientType: "investor",
      title: "Meeting summary available",
      message: "The summary and agreed next steps from your recent GrowVest meeting are available.",
      eventType: "mom_published",
      link: "/investor/meetings",
      investorId: meeting.investorId,
      meetingId: meeting.id,
      momId: momRef.id,
      createdByUid: currentUser.id
    });
  }

  await batch.commit();
  try {
    await syncMomActions(momRef.id);
  } catch (syncError) {
    console.warn("MOM saved but action workflow sync could not complete", syncError);
  }
  return { id: momRef.id, ...mom };
}

export async function getMom(momId) {
  const snapshot = await getDoc(doc(db, "meetingMinutes", momId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeMom(momId, callback, onError) {
  return onSnapshot(
    doc(db, "meetingMinutes", momId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export function subscribeMoms(currentUser, callback, onError) {
  const admin = ["super_admin", "admin"].includes(currentUser.role);
  const constraints = admin
    ? [orderBy("createdAt", "desc"), limit(200)]
    : [where("advisorUid", "==", currentUser.id), orderBy("createdAt", "desc"), limit(200)];
  return onSnapshot(
    query(collection(db, "meetingMinutes"), ...constraints),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function updateMom(mom, payload, currentUser) {
  const momRef = doc(db, "meetingMinutes", mom.id);
  const meetingRef = doc(db, "meetings", mom.meetingId);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const decisions = normaliseRows(payload.decisions || []);
  const actionItems = resolveActionItems(payload.actionItems || [], mom);
  const updates = sanitize({
    discussionSummary: payload.discussionSummary,
    clientRequirements: payload.clientRequirements,
    goalsDiscussed: payload.goalsDiscussed,
    investmentsDiscussed: payload.investmentsDiscussed,
    liabilitiesDiscussed: payload.liabilitiesDiscussed,
    clientConcerns: payload.clientConcerns,
    familyInputs: payload.familyInputs,
    advisorObservations: payload.advisorObservations,
    internalNotes: payload.internalNotes,
    clientSummary: payload.clientSummary,
    decisions,
    actionItems,
    clientVisibleActionItems: actionItems.filter((item) => item.clientVisible),
    investorVisible: Boolean(payload.investorVisible),
    status: payload.status,
    followUpRequired: Boolean(payload.followUpRequired),
    followUpDate: payload.followUpDate || "",
    followUpTime: payload.followUpTime || "",
    followUpPurpose: payload.followUpPurpose || "",
    updatedAt: serverTimestamp(),
    completedAt: payload.status === "completed" ? mom.completedAt || serverTimestamp() : null
  });

  batch.update(momRef, updates);
  batch.update(meetingRef, {
    status: payload.status === "completed" ? "completed" : "scheduled",
    completedAt: payload.status === "completed" ? serverTimestamp() : null,
    updatedAt: serverTimestamp()
  });
  batch.set(activityRef, {
    recordType: "meeting",
    recordId: mom.meetingId,
    meetingId: mom.meetingId,
    momId: mom.id,
    investorId: mom.investorId || null,
    leadId: mom.leadId || null,
    advisorUid: mom.advisorUid,
    assignedAdvisorUid: mom.advisorUid,
    action: payload.status === "completed" ? "mom_completed" : "mom_updated",
    title: payload.status === "completed" ? "MOM completed" : "MOM updated",
    description: payload.clientSummary || payload.discussionSummary,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  });

  if (payload.status === "completed" && payload.investorVisible && mom.investorPortalUid && mom.status !== "completed") {
    addNotificationToBatch(batch, {
      recipientUid: mom.investorPortalUid,
      recipientType: "investor",
      title: "Meeting summary available",
      message: "The summary and agreed next steps from your recent GrowVest meeting are available.",
      eventType: "mom_published",
      link: "/investor/meetings",
      investorId: mom.investorId,
      meetingId: mom.meetingId,
      momId: mom.id,
      createdByUid: currentUser.id
    });
  }

  await batch.commit();
  try {
    await syncMomActions(mom.id);
  } catch (syncError) {
    console.warn("MOM updated but action workflow sync could not complete", syncError);
  }
  return { ...mom, ...updates };
}

export async function recordMomWhatsAppOpened(mom, currentUser) {
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  batch.set(activityRef, {
    recordType: "meeting",
    recordId: mom.meetingId,
    meetingId: mom.meetingId,
    momId: mom.id,
    investorId: mom.investorId || null,
    leadId: mom.leadId || null,
    advisorUid: mom.advisorUid,
    assignedAdvisorUid: mom.advisorUid,
    action: "mom_whatsapp_opened",
    title: "MOM WhatsApp message prepared",
    description: `WhatsApp was opened for ${mom.investorName || mom.leadName || "the client"}. The Advisor must press Send in WhatsApp.`,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}
