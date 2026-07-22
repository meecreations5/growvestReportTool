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
import { addNotificationToBatch } from "@/services/notificationService";

function cleanText(value) {
  return String(value || "").trim();
}

function sanitize(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

function dateTimeTimestamp(date, time) {
  const parsed = combineLocalDateTime(date, time);
  return parsed ? Timestamp.fromDate(parsed) : null;
}

async function nextMeetingCode() {
  const counterRef = doc(db, "counters", "meetings");
  const value = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const current = snapshot.exists() ? Number(snapshot.data().value || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
  return `GV-MTG-${new Date().getFullYear()}-${String(value).padStart(4, "0")}`;
}

function meetingActivity({ meeting, meetingId, currentUser, action, title, description }) {
  return {
    recordType: "meeting",
    recordId: meetingId,
    meetingId,
    meetingCode: meeting.meetingCode,
    investorId: meeting.investorId || null,
    leadId: meeting.leadId || null,
    advisorUid: meeting.advisorUid,
    assignedAdvisorUid: meeting.advisorUid,
    action,
    title,
    description,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  };
}

async function resolveAdvisor(linkedRecord, currentUser) {
  if (currentUser.role === USER_ROLES.ADVISOR) {
    return { uid: currentUser.id, name: currentUser.fullName, email: currentUser.email || "" };
  }

  const uid = linkedRecord?.assignedAdvisorUid || linkedRecord?.advisorUid || currentUser.id;
  let advisorProfile = null;
  if (uid) {
    const snapshot = await getDoc(doc(db, "users", uid));
    advisorProfile = snapshot.exists() ? snapshot.data() : null;
  }

  return {
    uid,
    name: advisorProfile?.fullName || linkedRecord?.assignedAdvisorName || linkedRecord?.advisorName || currentUser.fullName,
    email: advisorProfile?.email || linkedRecord?.assignedAdvisorEmail || linkedRecord?.advisorEmail || currentUser.email || ""
  };
}

export async function getMeetingLinkedOptions(currentUser) {
  const isAdmin = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser.role);
  const investorConstraints = isAdmin
    ? [where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(200)]
    : [where("assignedAdvisorUid", "==", currentUser.id), where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(200)];
  const leadConstraints = isAdmin
    ? [where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(200)]
    : [where("assignedAdvisorUid", "==", currentUser.id), where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(200)];

  const [investorSnapshot, leadSnapshot] = await Promise.all([
    getDocs(query(collection(db, "investors"), ...investorConstraints)),
    getDocs(query(collection(db, "leads"), ...leadConstraints))
  ]);

  return {
    investors: investorSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    leads: leadSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  };
}

export async function createMeeting(payload, currentUser, linkedRecord = null) {
  const meetingCode = await nextMeetingCode();
  const meetingRef = doc(collection(db, "meetings"));
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const advisor = await resolveAdvisor(linkedRecord, currentUser);
  const startAt = dateTimeTimestamp(payload.meetingDate, payload.startTime);
  const endAt = dateTimeTimestamp(payload.meetingDate, payload.endTime);

  const meeting = sanitize({
    meetingCode,
    linkedType: payload.linkedType,
    investorId: payload.linkedType === "investor" ? payload.investorId : null,
    investorName: payload.linkedType === "investor" ? linkedRecord?.fullName || "" : "",
    investorEmail: payload.linkedType === "investor" ? linkedRecord?.email || "" : "",
    investorMobile: payload.linkedType === "investor" ? linkedRecord?.contactNo || linkedRecord?.mobile || "" : "",
    investorPortalUid: payload.linkedType === "investor" ? linkedRecord?.portalUid || linkedRecord?.investorPortalUid || null : null,
    clientCode: payload.linkedType === "investor" ? linkedRecord?.clientCode || "" : "",
    leadId: payload.linkedType === "lead" ? payload.leadId : null,
    leadName: payload.linkedType === "lead" ? linkedRecord?.fullName || "" : "",
    leadEmail: payload.linkedType === "lead" ? linkedRecord?.email || "" : "",
    leadMobile: payload.linkedType === "lead" ? linkedRecord?.contactNo || linkedRecord?.mobile || "" : "",
    leadCode: payload.linkedType === "lead" ? linkedRecord?.leadCode || "" : "",
    title: cleanText(payload.title),
    meetingType: payload.meetingType,
    meetingProvider: payload.meetingProvider,
    meetingDate: payload.meetingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    startAt,
    endAt,
    timeZone: payload.timeZone,
    meetingLink: cleanText(payload.meetingLink),
    location: cleanText(payload.location),
    instructions: cleanText(payload.instructions),
    agenda: (payload.agenda || []).map(cleanText).filter(Boolean),
    attendees: payload.attendees || [],
    advisorUid: advisor.uid,
    assignedAdvisorUid: advisor.uid,
    advisorName: advisor.name,
    advisorEmail: advisor.email,
    status: "scheduled",
    investorVisible: Boolean(payload.investorVisible),
    communicationSettings: {
      sendInvestorEmail: Boolean(payload.sendInvestorEmail),
      sendAdvisorEmail: Boolean(payload.sendAdvisorEmail),
      createInAppNotifications: Boolean(payload.createInAppNotifications),
      reminder24Hours: Boolean(payload.reminder24Hours),
      reminder1Hour: Boolean(payload.reminder1Hour)
    },
    momId: null,
    cancellationReason: "",
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.set(meetingRef, meeting);
  batch.set(activityRef, meetingActivity({
    meeting,
    meetingId: meetingRef.id,
    currentUser,
    action: "meeting_scheduled",
    title: "Meeting scheduled",
    description: `${meeting.title} is scheduled for ${meeting.meetingDate} at ${meeting.startTime}.`
  }));

  if (payload.createInAppNotifications) {
    addNotificationToBatch(batch, {
      recipientUid: advisor.uid,
      recipientType: "advisor",
      title: "Meeting scheduled",
      message: `${meeting.title} with ${meeting.investorName || meeting.leadName || "the client"} is scheduled for ${meeting.meetingDate} at ${meeting.startTime}.`,
      eventType: "meeting_scheduled",
      link: `/meetings/${meetingRef.id}`,
      investorId: meeting.investorId,
      leadId: meeting.leadId,
      meetingId: meetingRef.id,
      createdByUid: currentUser.id
    });

    if (meeting.investorPortalUid && meeting.investorVisible) {
      addNotificationToBatch(batch, {
        recipientUid: meeting.investorPortalUid,
        recipientType: "investor",
        title: "GrowVest meeting scheduled",
        message: `Your ${meeting.title} is scheduled for ${meeting.meetingDate} at ${meeting.startTime}.`,
        eventType: "meeting_scheduled",
        link: "/investor/meetings",
        investorId: meeting.investorId,
        meetingId: meetingRef.id,
        createdByUid: currentUser.id
      });
    }
  }

  await batch.commit();
  return { id: meetingRef.id, ...meeting };
}

export async function getMeeting(meetingId) {
  const snapshot = await getDoc(doc(db, "meetings", meetingId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeMeeting(meetingId, callback, onError) {
  return onSnapshot(
    doc(db, "meetings", meetingId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export function subscribeMeetings(currentUser, callback, onError) {
  const isAdmin = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser.role);
  const constraints = isAdmin
    ? [orderBy("startAt", "desc"), limit(200)]
    : [where("advisorUid", "==", currentUser.id), orderBy("startAt", "desc"), limit(200)];
  return onSnapshot(
    query(collection(db, "meetings"), ...constraints),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeInvestorMeetings(investorId, callback, onError) {
  return onSnapshot(
    query(collection(db, "meetings"), where("investorId", "==", investorId), orderBy("startAt", "desc"), limit(50)),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function updateMeeting(meeting, payload, currentUser, linkedRecord = null) {
  const meetingRef = doc(db, "meetings", meeting.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const advisor = await resolveAdvisor(linkedRecord || meeting, currentUser);
  const startAt = dateTimeTimestamp(payload.meetingDate, payload.startTime);
  const endAt = dateTimeTimestamp(payload.meetingDate, payload.endTime);
  const scheduleChanged = meeting.meetingDate !== payload.meetingDate
    || meeting.startTime !== payload.startTime
    || meeting.endTime !== payload.endTime;

  const updates = sanitize({
    linkedType: payload.linkedType,
    investorId: payload.linkedType === "investor" ? payload.investorId : null,
    investorName: payload.linkedType === "investor" ? linkedRecord?.fullName || meeting.investorName || "" : "",
    investorEmail: payload.linkedType === "investor" ? linkedRecord?.email || meeting.investorEmail || "" : "",
    investorMobile: payload.linkedType === "investor" ? linkedRecord?.contactNo || linkedRecord?.mobile || meeting.investorMobile || "" : "",
    investorPortalUid: payload.linkedType === "investor" ? linkedRecord?.portalUid || linkedRecord?.investorPortalUid || meeting.investorPortalUid || null : null,
    clientCode: payload.linkedType === "investor" ? linkedRecord?.clientCode || meeting.clientCode || "" : "",
    leadId: payload.linkedType === "lead" ? payload.leadId : null,
    leadName: payload.linkedType === "lead" ? linkedRecord?.fullName || meeting.leadName || "" : "",
    leadEmail: payload.linkedType === "lead" ? linkedRecord?.email || meeting.leadEmail || "" : "",
    leadMobile: payload.linkedType === "lead" ? linkedRecord?.contactNo || linkedRecord?.mobile || meeting.leadMobile || "" : "",
    leadCode: payload.linkedType === "lead" ? linkedRecord?.leadCode || meeting.leadCode || "" : "",
    title: cleanText(payload.title),
    meetingType: payload.meetingType,
    meetingProvider: payload.meetingProvider,
    meetingDate: payload.meetingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    startAt,
    endAt,
    timeZone: payload.timeZone,
    meetingLink: cleanText(payload.meetingLink),
    location: cleanText(payload.location),
    instructions: cleanText(payload.instructions),
    agenda: (payload.agenda || []).map(cleanText).filter(Boolean),
    attendees: payload.attendees || [],
    advisorUid: advisor.uid,
    assignedAdvisorUid: advisor.uid,
    advisorName: advisor.name,
    advisorEmail: advisor.email,
    investorVisible: Boolean(payload.investorVisible),
    communicationSettings: {
      sendInvestorEmail: Boolean(payload.sendInvestorEmail),
      sendAdvisorEmail: Boolean(payload.sendAdvisorEmail),
      createInAppNotifications: Boolean(payload.createInAppNotifications),
      reminder24Hours: Boolean(payload.reminder24Hours),
      reminder1Hour: Boolean(payload.reminder1Hour)
    },
    status: scheduleChanged && meeting.status !== "cancelled" ? "rescheduled" : meeting.status,
    updatedAt: serverTimestamp()
  });

  batch.update(meetingRef, updates);
  batch.set(activityRef, meetingActivity({
    meeting: { ...meeting, ...updates },
    meetingId: meeting.id,
    currentUser,
    action: scheduleChanged ? "meeting_rescheduled" : "meeting_updated",
    title: scheduleChanged ? "Meeting rescheduled" : "Meeting updated",
    description: scheduleChanged
      ? `${updates.title} was rescheduled to ${updates.meetingDate} at ${updates.startTime}.`
      : `${updates.title} details were updated.`
  }));

  if (scheduleChanged && payload.createInAppNotifications) {
    addNotificationToBatch(batch, {
      recipientUid: advisor.uid,
      recipientType: "advisor",
      title: "Meeting rescheduled",
      message: `${updates.title} is now scheduled for ${updates.meetingDate} at ${updates.startTime}.`,
      eventType: "meeting_rescheduled",
      link: `/meetings/${meeting.id}`,
      investorId: updates.investorId,
      leadId: updates.leadId,
      meetingId: meeting.id,
      createdByUid: currentUser.id
    });
    if (updates.investorPortalUid && updates.investorVisible) {
      addNotificationToBatch(batch, {
        recipientUid: updates.investorPortalUid,
        recipientType: "investor",
        title: "Meeting rescheduled",
        message: `Your GrowVest meeting is now scheduled for ${updates.meetingDate} at ${updates.startTime}.`,
        eventType: "meeting_rescheduled",
        link: "/investor/meetings",
        investorId: updates.investorId,
        meetingId: meeting.id,
        createdByUid: currentUser.id
      });
    }
  }

  await batch.commit();
  return { ...meeting, ...updates };
}

export async function changeMeetingStatus(meeting, status, currentUser, cancellationReason = "") {
  const meetingRef = doc(db, "meetings", meeting.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const updates = {
    status,
    cancellationReason: status === "cancelled" ? cleanText(cancellationReason) : meeting.cancellationReason || "",
    completedAt: status === "completed" ? serverTimestamp() : meeting.completedAt || null,
    updatedAt: serverTimestamp()
  };

  batch.update(meetingRef, updates);
  batch.set(activityRef, meetingActivity({
    meeting,
    meetingId: meeting.id,
    currentUser,
    action: `meeting_${status}`,
    title: `Meeting ${status}`,
    description: status === "cancelled" ? updates.cancellationReason || "Meeting was cancelled." : `${meeting.title} was marked ${status}.`
  }));

  if (status === "cancelled") {
    addNotificationToBatch(batch, {
      recipientUid: meeting.advisorUid,
      recipientType: "advisor",
      title: "Meeting cancelled",
      message: `${meeting.title} has been cancelled.`,
      eventType: "meeting_cancelled",
      link: `/meetings/${meeting.id}`,
      investorId: meeting.investorId,
      leadId: meeting.leadId,
      meetingId: meeting.id,
      createdByUid: currentUser.id
    });
    if (meeting.investorPortalUid && meeting.investorVisible) {
      addNotificationToBatch(batch, {
        recipientUid: meeting.investorPortalUid,
        recipientType: "investor",
        title: "GrowVest meeting cancelled",
        message: `Your meeting scheduled for ${meeting.meetingDate} has been cancelled.`,
        eventType: "meeting_cancelled",
        link: "/investor/meetings",
        investorId: meeting.investorId,
        meetingId: meeting.id,
        createdByUid: currentUser.id
      });
    }
  }

  await batch.commit();
}

export async function recordMeetingWhatsAppOpened(meeting, currentUser) {
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  batch.set(activityRef, meetingActivity({
    meeting,
    meetingId: meeting.id,
    currentUser,
    action: "meeting_whatsapp_opened",
    title: "WhatsApp message prepared",
    description: `WhatsApp was opened for ${meeting.investorName || meeting.leadName || "the client"}. The Advisor must press Send in WhatsApp.`
  }));
  await batch.commit();
}
