import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  verifyAppRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  actionCode,
  actionEventPayload,
  getAccessibleActionInvestor,
  normaliseCreateAction
} from "@/lib/server/actionServer";
import {
  nextSipDebitDate,
  scheduleView,
  sipCycleId
} from "@/lib/server/sipFundingServer";
import { PORTFOLIO_PRODUCT_TYPES } from "@/lib/constants/portfolio";
import { SIP_REMINDER_DAY_OPTIONS } from "@/lib/constants/sipFunding";

export const runtime = "nodejs";

function clean(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actorName(actor = {}) {
  return actor.fullName || actor.email || (actor.role === "investor" ? "Investor" : "GrowVest User");
}

function safeReminderDays(value) {
  const allowed = new Set(SIP_REMINDER_DAY_OPTIONS);
  const rows = Array.isArray(value) ? value : [5];
  const result = [...new Set(rows.map(Number).filter((item) => allowed.has(item)))].sort((a, b) => b - a);
  return result.length ? result : [5];
}

async function loadSchedules(actor, requestedInvestorId = "") {
  let snapshot;
  if (actor.role === "investor") {
    const investorId = clean(actor.investorId);
    if (!investorId) return [];
    snapshot = await adminDb.collection("sipFundingSchedules").where("investorId", "==", investorId).get();
  } else if (requestedInvestorId) {
    const investor = await getAccessibleActionInvestor(actor, requestedInvestorId);
    snapshot = await adminDb.collection("sipFundingSchedules").where("investorId", "==", investor.id).get();
  } else if (actor.role === "advisor") {
    snapshot = await adminDb.collection("sipFundingSchedules").where("advisorUid", "==", actor.uid).get();
  } else {
    snapshot = await adminDb.collection("sipFundingSchedules").limit(500).get();
  }

  const schedules = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const active = schedules.filter((item) => item.active !== false);
  if (!active.length) return [];

  const now = new Date();
  const cycleRefs = active.map((schedule) => {
    const debitDate = nextSipDebitDate(schedule.debitDay, now);
    return adminDb.collection("sipFundingCycles").doc(sipCycleId(schedule.id, debitDate));
  });
  const cycleSnapshots = await adminDb.getAll(...cycleRefs);
  const cycles = new Map(cycleSnapshots.filter((item) => item.exists).map((item) => [item.id, { id: item.id, ...item.data() }]));

  return active.map((schedule) => {
    const debitDate = nextSipDebitDate(schedule.debitDay, now);
    return scheduleView(schedule, cycles.get(sipCycleId(schedule.id, debitDate)) || null, now);
  }).sort((a, b) => String(a.nextDebitDate).localeCompare(String(b.nextDebitDate)) || String(a.investorName).localeCompare(String(b.investorName)));
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    const { searchParams } = new URL(request.url);
    const investorId = clean(searchParams.get("investorId"));
    const items = await loadSchedules(actor, investorId);
    return Response.json({ items });
  } catch (error) {
    console.error("SIP funding overview failed", error);
    return Response.json({ error: error?.message || "Unable to load SIP funding reminders." }, { status: appRequestErrorStatus(error, 500) });
  }
}

async function upsertSchedule(actor, payload) {
  if (!["super_admin", "admin", "advisor"].includes(actor.role)) throw new Error("Staff access is required.");
  const investorId = clean(payload.investorId);
  const positionId = clean(payload.positionId);
  if (!investorId || !positionId) return Response.json({ error: "Investor and SIP holding are required." }, { status: 400 });
  const investor = await getAccessibleActionInvestor(actor, investorId);
  const positionSnapshot = await adminDb.collection("portfolioPositions").doc(positionId).get();
  if (!positionSnapshot.exists) return Response.json({ error: "SIP holding was not found." }, { status: 404 });
  const position = { id: positionSnapshot.id, ...positionSnapshot.data() };
  if (String(position.investorId || "") !== investor.id) return Response.json({ error: "This holding belongs to another investor." }, { status: 409 });
  if (position.productType !== PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND) return Response.json({ error: "SIP reminders are available for Mutual Fund holdings." }, { status: 400 });

  const debitDay = Math.max(1, Math.min(31, Math.trunc(number(payload.debitDay))));
  if (!debitDay) return Response.json({ error: "Select the SIP debit day." }, { status: 400 });
  const sipAmount = number(payload.sipAmount || position.monthlySip);
  if (sipAmount <= 0) return Response.json({ error: "Enter the SIP amount." }, { status: 400 });

  const scheduleId = `sip_${positionId}`;
  const ref = adminDb.collection("sipFundingSchedules").doc(scheduleId);
  const existing = await ref.get();
  const advisorUid = investor.assignedAdvisorUid || investor.advisorUid || position.advisorUid || actor.uid;
  const next = {
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    clientCode: investor.clientCode || "",
    investorPortalUid: investor.investorPortalUid || investor.portalUid || null,
    advisorUid,
    assignedAdvisorUid: advisorUid,
    positionId,
    instrumentName: position.instrumentName || position.schemeName || "Mutual Fund SIP",
    folioNo: position.folioNo || "",
    isin: position.isin || "",
    source: position.source || "manual",
    provider: position.provider || "",
    sipAmount: Number(sipAmount.toFixed(2)),
    debitDay,
    bankName: clean(payload.bankName),
    accountLast4: clean(payload.accountLast4).replace(/\D/g, "").slice(-4),
    reminderDays: safeReminderDays(payload.reminderDays),
    active: payload.active !== false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actorName(actor)
  };
  if (!existing.exists) {
    next.createdAt = FieldValue.serverTimestamp();
    next.createdByUid = actor.uid;
    next.createdByName = actorName(actor);
  }
  await ref.set(next, { merge: true });
  return Response.json({ success: true, scheduleId, schedule: { id: scheduleId, ...next, nextDebitDate: nextSipDebitDate(debitDay) } });
}

async function disableSchedule(actor, payload) {
  if (!["super_admin", "admin", "advisor"].includes(actor.role)) throw new Error("Staff access is required.");
  const scheduleId = clean(payload.scheduleId);
  const ref = adminDb.collection("sipFundingSchedules").doc(scheduleId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return Response.json({ error: "SIP reminder schedule was not found." }, { status: 404 });
  const schedule = snapshot.data();
  await getAccessibleActionInvestor(actor, schedule.investorId);
  await ref.set({ active: false, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actor.uid, updatedByName: actorName(actor) }, { merge: true });
  return Response.json({ success: true });
}

async function createAdvisorFollowUp({ actor, investor, schedule, cycleId, requestType, description }) {
  const actionRef = adminDb.collection("investorActions").doc(`sip_${cycleId}_advisor`);
  const existing = await actionRef.get();
  if (existing.exists && !["Completed", "Rejected", "Cancelled"].includes(existing.data()?.status)) return actionRef.id;
  const action = normaliseCreateAction({
    investorId: investor.id,
    requestType,
    title: `${requestType} — ${schedule.instrumentName}`,
    description,
    relatedInvestmentId: schedule.positionId,
    relatedInvestmentName: schedule.instrumentName,
    sourceType: "sip_funding",
    priority: "High"
  }, actor, investor);
  const batch = adminDb.batch();
  batch.set(actionRef, { ...action, sourceType: "sip_funding", actionCode: actionCode(actionRef.id), sourceSipScheduleId: schedule.id, sourceSipCycleId: cycleId });
  batch.set(adminDb.collection("investorActionEvents").doc(), actionEventPayload({
    actionId: actionRef.id,
    action,
    actor,
    eventType: "sip_funding_followup_created",
    note: description,
    toStatus: action.status,
    investorVisible: true
  }));
  await batch.commit();
  return actionRef.id;
}

async function createServiceRequest({ actor, investor, schedule, cycleId, note }) {
  const requestRef = adminDb.collection("clientQueries").doc(`sip_${cycleId}_service`);
  const now = new Date();
  await requestRef.set({
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    clientCode: investor.clientCode || "",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || schedule.advisorUid || "",
    assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || schedule.advisorUid || "",
    receivedAt: now.toISOString(),
    queryType: "action_required",
    status: "Open",
    tatLimitHours: 4,
    requiredBy: new Date(now.getTime() + 4 * 3600000).toISOString(),
    actualHours: null,
    tatBreached: false,
    sourceType: "sip_funding",
    sourceSipScheduleId: schedule.id,
    sourceSipCycleId: cycleId,
    subject: `SIP bank / mandate issue — ${schedule.instrumentName}`,
    notes: clean(note) || `Investor reported a bank / mandate issue before the SIP debit on ${nextSipDebitDate(schedule.debitDay)}.`,
    createdByUid: actor.uid,
    createdByName: actorName(actor),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return requestRef.id;
}

async function respondToSchedule(actor, payload) {
  const scheduleId = clean(payload.scheduleId);
  const response = clean(payload.response);
  const allowed = ["funds_available", "will_add_funds", "funds_added", "withdrawal_transfer", "discuss_advisor", "bank_mandate_issue"];
  if (!allowed.includes(response)) return Response.json({ error: "Select a valid SIP funding response." }, { status: 400 });
  const scheduleRef = adminDb.collection("sipFundingSchedules").doc(scheduleId);
  const scheduleSnapshot = await scheduleRef.get();
  if (!scheduleSnapshot.exists) return Response.json({ error: "SIP reminder schedule was not found." }, { status: 404 });
  const schedule = { id: scheduleSnapshot.id, ...scheduleSnapshot.data() };
  const investor = await getAccessibleActionInvestor(actor, schedule.investorId);
  const debitDate = nextSipDebitDate(schedule.debitDay);
  const cycleId = sipCycleId(schedule.id, debitDate);
  const cycleRef = adminDb.collection("sipFundingCycles").doc(cycleId);
  const existingCycleSnapshot = await cycleRef.get();
  const existingCycle = existingCycleSnapshot.exists ? existingCycleSnapshot.data() : {};
  const note = clean(payload.note).slice(0, 2000);
  let status = "pending";
  let followUpType = "";
  let followUpId = "";

  if (response === "funds_available" || response === "funds_added") status = "ready";
  if (response === "will_add_funds") status = "awaiting_funds";
  if (["withdrawal_transfer", "discuss_advisor"].includes(response)) status = "needs_advisor";
  if (response === "bank_mandate_issue") status = "service_request";

  if (["withdrawal_transfer", "discuss_advisor"].includes(response)) {
    const requestType = response === "withdrawal_transfer" ? "SIP Funding / Withdrawal" : "SIP Funding Discussion";
    const description = note || (response === "withdrawal_transfer"
      ? `Investor needs to discuss withdrawal / transfer of funds before the ${schedule.instrumentName} SIP debit of ₹${Number(schedule.sipAmount || 0).toLocaleString("en-IN")} on ${debitDate}.`
      : `Investor requested an Advisor discussion before the ${schedule.instrumentName} SIP debit on ${debitDate}.`);
    followUpId = await createAdvisorFollowUp({ actor, investor, schedule, cycleId, requestType, description });
    followUpType = "advisor_follow_up";
  }

  if (response === "bank_mandate_issue") {
    followUpId = await createServiceRequest({ actor, investor, schedule, cycleId, note });
    followUpType = "service_request";
  }

  const batch = adminDb.batch();
  batch.set(cycleRef, {
    scheduleId: schedule.id,
    investorId: schedule.investorId,
    investorName: schedule.investorName,
    advisorUid: schedule.advisorUid || "",
    investorPortalUid: schedule.investorPortalUid || null,
    positionId: schedule.positionId,
    instrumentName: schedule.instrumentName,
    sipAmount: Number(schedule.sipAmount || 0),
    debitDate,
    response,
    responseNote: note,
    status,
    followUpType,
    followUpId,
    respondedByUid: actor.uid,
    respondedByRole: actor.role,
    respondedByName: actorName(actor),
    respondedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: existingCycle.createdAt || FieldValue.serverTimestamp()
  }, { merge: true });

  if (schedule.advisorUid && actor.uid !== schedule.advisorUid) {
    const notificationRef = adminDb.collection("notifications").doc();
    batch.set(notificationRef, {
      recipientUid: schedule.advisorUid,
      recipientType: "advisor",
      title: "SIP funding response received",
      message: `${schedule.investorName || "Investor"} responded for ${schedule.instrumentName}: ${response.replaceAll("_", " ")}.`,
      eventType: "sip_funding_response",
      link: "/sip-funding",
      investorId: schedule.investorId,
      status: "unread",
      createdByUid: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null
    });
  }

  batch.set(adminDb.collection("activityLogs").doc(), {
    recordType: "sip_funding",
    recordId: cycleId,
    investorId: schedule.investorId,
    advisorUid: schedule.advisorUid || "",
    assignedAdvisorUid: schedule.advisorUid || "",
    action: "sip_funding_response",
    title: `SIP funding response · ${schedule.instrumentName}`,
    description: `${actorName(actor)} selected ${response.replaceAll("_", " ")} for the SIP due on ${debitDate}.`,
    metadata: { scheduleId: schedule.id, cycleId, response, status, followUpType, followUpId },
    createdByUid: actor.uid,
    createdByName: actorName(actor),
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
  return Response.json({ success: true, cycleId, status, followUpType, followUpId });
}

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    const payload = await request.json().catch(() => ({}));
    const action = clean(payload.action);
    if (action === "respond") return respondToSchedule(actor, payload);
    if (action === "upsert_schedule") {
      if (!['super_admin','admin','advisor'].includes(actor.role)) return Response.json({ error: "Staff access is required." }, { status: 403 });
      return upsertSchedule(actor, payload);
    }
    if (action === "disable_schedule") return disableSchedule(actor, payload);
    return Response.json({ error: "Unsupported SIP funding action." }, { status: 400 });
  } catch (error) {
    console.error("SIP funding action failed", error);
    return Response.json({ error: error?.message || "Unable to update SIP funding workflow." }, { status: appRequestErrorStatus(error, 500) });
  }
}
