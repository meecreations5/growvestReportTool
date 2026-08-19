import { NextResponse } from "next/server";
import { adminDb, appRequestErrorStatus, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { customOccasionRow, investorBirthdayRow } from "@/lib/server/occasionEngine";
import { indiaDateParts, normaliseReminderOffsets, OCCASION_RELATIONSHIPS, OCCASION_TYPES, parseOccasionDate } from "@/lib/utils/occasions";

function errorResponse(error) {
  const message = error?.message || "Occasion update failed.";
  return NextResponse.json({ error: message }, { status: appRequestErrorStatus(error, 400) });
}

async function resolveOccasion(occasionId) {
  if (occasionId.startsWith("birthday__")) {
    const investorId = occasionId.slice("birthday__".length);
    const snap = await adminDb.collection("investors").doc(investorId).get();
    if (!snap.exists) throw new Error("Investor was not found.");
    const investor = { id: snap.id, ...snap.data() };
    return { investor, record: null, row: investorBirthdayRow(investor, indiaDateParts()) };
  }
  const occasionSnap = await adminDb.collection("investorOccasions").doc(occasionId).get();
  if (!occasionSnap.exists) throw new Error("Occasion was not found.");
  const record = { id: occasionSnap.id, ...occasionSnap.data() };
  const investorSnap = await adminDb.collection("investors").doc(record.investorId).get();
  if (!investorSnap.exists) throw new Error("Investor was not found.");
  const investor = { id: investorSnap.id, ...investorSnap.data() };
  return { investor, record, row: customOccasionRow(record, investor, indiaDateParts()) };
}

export async function PATCH(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { occasionId } = await params;
    const payload = await request.json();
    const action = String(payload.action || "").trim();
    const { investor, record, row } = await resolveOccasion(occasionId);
    if (!row) throw new Error("Occasion is inactive or has an invalid date.");
    if (!canStaffAccessRecord(actor, investor)) throw new Error("You are not authorised to manage this investor's occasions.");

    if (action === "update") {
      if (!record) throw new Error("Investor birthday settings are edited from the Investor Profile.");
      const update = {};
      if (payload.personName !== undefined) update.personName = String(payload.personName || "").trim();
      if (payload.relationship !== undefined) {
        if (!OCCASION_RELATIONSHIPS.includes(payload.relationship)) throw new Error("Select a valid relationship.");
        update.relationship = payload.relationship;
      }
      if (payload.occasionType !== undefined) {
        if (!OCCASION_TYPES.includes(payload.occasionType)) throw new Error("Select a valid occasion type.");
        update.occasionType = payload.occasionType;
      }
      if (payload.occasionDate !== undefined) {
        if (!parseOccasionDate(payload.occasionDate)) throw new Error("Enter a valid occasion date.");
        update.occasionDate = payload.occasionDate;
      }
      if (payload.reminderEnabled !== undefined) update.reminderEnabled = Boolean(payload.reminderEnabled);
      if (payload.reminderOffsets !== undefined) update.reminderOffsets = normaliseReminderOffsets(payload.reminderOffsets, 7);
      if (payload.notes !== undefined) update.notes = String(payload.notes || "").trim();
      update.updatedAt = new Date();
      await adminDb.collection("investorOccasions").doc(occasionId).update(update);
      return NextResponse.json({ success: true });
    }

    if (action === "archive") {
      if (!record) throw new Error("Investor birthday reminders can be disabled from the Investor Profile.");
      await adminDb.collection("investorOccasions").doc(occasionId).update({ active: false, archivedAt: new Date(), archivedByUid: actor.uid, updatedAt: new Date() });
      return NextResponse.json({ success: true });
    }

    if (!["complete", "skip", "reopen"].includes(action)) throw new Error("Select a valid occasion action.");
    const now = new Date();
    const touchpointRef = adminDb.collection("occasionTouchpoints").doc(row.touchpointId);
    const status = action === "complete" ? "Completed" : action === "skip" ? "Skipped" : "Pending";
    const channel = action === "complete" ? String(payload.channel || "Call") : "";
    const note = String(payload.note || "").trim();
    const update = {
      occasionKey: row.occasionKey,
      occasionId: row.custom ? row.id : null,
      source: row.source,
      investorId: row.investorId,
      investorName: row.investorName,
      clientCode: row.clientCode || "",
      personName: row.personName,
      relationship: row.relationship,
      occasionType: row.occasionType,
      eventDate: row.eventDate,
      eventYear: row.eventYear,
      advisorUid: row.advisorUid,
      status,
      channel,
      note,
      completedAt: action === "complete" ? now : null,
      completedByUid: action === "complete" ? actor.uid : null,
      completedByName: action === "complete" ? (actor.fullName || actor.email || "GrowVest staff") : "",
      skippedAt: action === "skip" ? now : null,
      skippedByUid: action === "skip" ? actor.uid : null,
      reopenedAt: action === "reopen" ? now : null,
      updatedAt: now
    };
    const activityRef = adminDb.collection("activityLogs").doc();
    await adminDb.runTransaction(async (transaction) => {
      transaction.set(touchpointRef, update, { merge: true });
      transaction.set(activityRef, {
        recordType: "occasion",
        recordId: row.touchpointId,
        investorId: row.investorId,
        clientCode: row.clientCode || "",
        leadName: row.investorName,
        advisorUid: row.advisorUid,
        assignedAdvisorUid: row.advisorUid,
        action: action === "complete" ? "occasion_touchpoint_completed" : action === "skip" ? "occasion_touchpoint_skipped" : "occasion_touchpoint_reopened",
        title: `${row.occasionType} touchpoint ${status.toLowerCase()}`,
        description: `${row.personName} (${row.relationship}) · ${row.eventDate}${channel ? ` · ${channel}` : ""}.`,
        metadata: { occasionType: row.occasionType, relationship: row.relationship, eventYear: row.eventYear, channel, note },
        createdByUid: actor.uid,
        createdByName: actor.fullName || actor.email || "GrowVest staff",
        createdAt: now
      });
    });
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Occasion update failed", error);
    return errorResponse(error);
  }
}
