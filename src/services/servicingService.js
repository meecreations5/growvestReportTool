import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ADMIN_ROLES } from "@/lib/constants/roles";
import { QUERY_TYPES, SERVICING_COLLECTIONS } from "@/lib/constants/servicing";

function isAdmin(profile) {
  return ADMIN_ROLES.includes(profile?.role);
}

function clean(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function differenceHours(later, earlier) {
  const laterDate = parseDate(later);
  const earlierDate = parseDate(earlier);
  if (!laterDate || !earlierDate) return null;
  return (laterDate.getTime() - earlierDate.getTime()) / 3600000;
}

function differenceDays(later, earlier) {
  const hours = differenceHours(later, earlier);
  return hours == null ? null : hours / 24;
}

function addHours(value, hours) {
  const date = parseDate(value);
  return date ? new Date(date.getTime() + Number(hours || 0) * 3600000).toISOString() : null;
}

function addDays(value, days) {
  return addHours(value, Number(days || 0) * 24);
}

export function queryLimitHours(type) {
  return QUERY_TYPES.find((item) => item.value === type)?.limitHours || 8;
}

export function enrichQueryRecord(payload) {
  const limitHours = queryLimitHours(payload.queryType);
  const actualHours = differenceHours(payload.resolvedAt || new Date(), payload.receivedAt);
  const resolved = ["Resolved", "Closed"].includes(payload.status);
  return {
    ...payload,
    tatLimitHours: limitHours,
    requiredBy: addHours(payload.receivedAt, limitHours),
    actualHours: resolved ? actualHours : null,
    tatBreached: actualHours != null ? actualHours > limitHours : false
  };
}

export function enrichMonthlyUpdate(payload) {
  const whatsappDay = differenceDays(payload.whatsappSentDate, payload.activationDate);
  const emailDay = differenceDays(payload.emailSentDate, payload.activationDate);
  return {
    ...payload,
    whatsappDay: whatsappDay == null ? null : Math.ceil(whatsappDay),
    emailDay: emailDay == null ? null : Math.ceil(emailDay),
    whatsappTatBreached: whatsappDay != null ? whatsappDay > 3 : false,
    emailTatBreached: emailDay != null ? emailDay > 5 : false
  };
}

export function enrichQuarterlyReview(payload) {
  const recapHours = differenceHours(payload.recapSentAt, payload.reviewDate);
  const rebalancingDays = differenceDays(payload.rebalancingDoneAt, payload.rebalancingRequestedAt);
  return {
    ...payload,
    recapHours,
    recapTatBreached: recapHours != null ? recapHours > 24 : false,
    rebalancingDays,
    rebalancingTatBreached: rebalancingDays != null ? rebalancingDays > 2 : false,
    nextReviewDue: addDays(payload.reviewDate, 90)
  };
}

export function enrichRenewal(payload) {
  const contractEnd = parseDate(payload.contractEnd);
  const today = new Date();
  return {
    ...payload,
    flagDate: addDays(payload.contractEnd, -60),
    conversationDate: addDays(payload.contractEnd, -45),
    daysToRenewal: contractEnd ? Math.ceil((contractEnd.getTime() - today.getTime()) / 86400000) : null,
    atRisk: Boolean(payload.followUp2Date && !["Renewed", "Closed"].includes(payload.status))
  };
}

export function enrichDeadlineMiss(payload) {
  const start = parseDate(payload.breachDate || payload.originalDeadline);
  const end = payload.status === "Resolved" ? parseDate(payload.resolvedAt) : new Date();
  const daysOpen = start && end ? Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : 0;
  let escalationAlert = "Monitoring";
  if (payload.status === "Resolved") escalationAlert = "Resolved";
  else if (payload.followUp2Date && differenceDays(new Date(), payload.followUp2Date) > 2) escalationAlert = "CALL NOW";
  else if (payload.followUp1Date && differenceDays(new Date(), payload.followUp1Date) > 2) escalationAlert = "FINAL MESSAGE DUE";
  return { ...payload, daysOpen, escalationAlert };
}

export function checklistCompletion(payload) {
  const keys = [
    "whatsappSent", "emailSent", "clientAcknowledged", "delayLogged",
    "queryLogged", "queryResolved", "queryTatMet", "addendumLogged",
    "inviteSent", "reviewHeld", "recapSent", "rebalancingDone",
    "flagRaised", "conversationHeld", "documentsReceived", "signed"
  ];
  const applicable = keys.filter((key) => payload[key] !== "na");
  const complete = applicable.filter((key) => payload[key] === true || payload[key] === "done").length;
  return applicable.length ? Math.round((complete / applicable.length) * 100) : 0;
}

export function subscribeServicingRecords(type, profile, callback, onError) {
  const collectionName = SERVICING_COLLECTIONS[type];
  if (!collectionName) throw new Error("Unsupported servicing record type.");
  const reference = collection(db, collectionName);
  const sourceQuery = isAdmin(profile) ? reference : query(reference, where("advisorUid", "==", profile.id));
  return onSnapshot(sourceQuery, (snapshot) => {
    const rows = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const left = parseDate(a.createdAt)?.getTime() || 0;
        const right = parseDate(b.createdAt)?.getTime() || 0;
        return right - left;
      });
    callback(rows);
  }, onError);
}

export async function createServicingRecord(type, payload, profile) {
  const collectionName = SERVICING_COLLECTIONS[type];
  if (!collectionName) throw new Error("Unsupported servicing record type.");
  let derived = payload;
  if (type === "queries") derived = enrichQueryRecord(payload);
  if (type === "monthly") derived = enrichMonthlyUpdate(payload);
  if (type === "quarterly") derived = enrichQuarterlyReview(payload);
  if (type === "renewals") derived = enrichRenewal(payload);
  if (type === "addendum") derived = enrichDeadlineMiss(payload);
  if (type === "checklist") derived = { ...payload, completionPercentage: checklistCompletion(payload) };
  return addDoc(collection(db, collectionName), clean({
    ...derived,
    createdByUid: profile.id,
    createdByName: profile.fullName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
}

export async function updateServicingRecord(type, id, payload) {
  const collectionName = SERVICING_COLLECTIONS[type];
  if (!collectionName) throw new Error("Unsupported servicing record type.");
  let derived = payload;
  if (type === "queries") derived = enrichQueryRecord(payload);
  if (type === "monthly") derived = enrichMonthlyUpdate(payload);
  if (type === "quarterly") derived = enrichQuarterlyReview(payload);
  if (type === "renewals") derived = enrichRenewal(payload);
  if (type === "addendum") derived = enrichDeadlineMiss(payload);
  if (type === "checklist") derived = { ...payload, completionPercentage: checklistCompletion(payload) };
  return updateDoc(doc(db, collectionName, id), clean({ ...derived, updatedAt: serverTimestamp() }));
}
