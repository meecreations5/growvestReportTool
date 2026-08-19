import { NextResponse } from "next/server";
import { adminDb, appRequestErrorStatus, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { customOccasionRow, investorBirthdayRow, mergeTouchpoint } from "@/lib/server/occasionEngine";
import { indiaDateParts, normaliseReminderOffsets, OCCASION_RELATIONSHIPS, OCCASION_TYPES, parseOccasionDate } from "@/lib/utils/occasions";

function errorResponse(error, fallback = "Birthday & occasion request failed.") {
  const message = error?.message || fallback;
  return NextResponse.json({ error: message }, { status: appRequestErrorStatus(error, 400) });
}

async function accessibleInvestors(actor) {
  const snapshot = await adminDb.collection("investors").where("isDeleted", "==", false).get();
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status !== "inactive")
    .filter((item) => actor.role !== "advisor" || canStaffAccessRecord(actor, item));
}

async function rowsWithTouchpoints(actor, days) {
  const today = indiaDateParts();
  const investors = await accessibleInvestors(actor);
  const investorMap = new Map(investors.map((item) => [item.id, item]));
  const rows = investors.map((investor) => investorBirthdayRow(investor, today)).filter(Boolean);

  const customSnapshot = await adminDb.collection("investorOccasions").where("active", "==", true).get();
  customSnapshot.docs.forEach((item) => {
    const record = { id: item.id, ...item.data() };
    const investor = investorMap.get(record.investorId);
    if (!investor) return;
    const row = customOccasionRow(record, investor, today);
    if (row) rows.push(row);
  });

  const withinRange = rows.filter((item) => item.daysUntil >= 0 && item.daysUntil <= days);
  const refs = withinRange.map((item) => adminDb.collection("occasionTouchpoints").doc(item.touchpointId));
  const snapshots = refs.length ? await adminDb.getAll(...refs) : [];
  return withinRange
    .map((item, index) => mergeTouchpoint(item, snapshots[index]?.exists ? snapshots[index].data() : null))
    .sort((a, b) => a.daysUntil - b.daysUntil || String(a.personName).localeCompare(String(b.personName)));
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const daysParam = Number(new URL(request.url).searchParams.get("days") || 365);
    const days = Math.min(366, Math.max(0, Number.isFinite(daysParam) ? daysParam : 365));
    const items = await rowsWithTouchpoints(actor, days);
    return NextResponse.json({
      success: true,
      timezone: "Asia/Kolkata",
      items,
      summary: {
        total: items.length,
        today: items.filter((item) => item.daysUntil === 0).length,
        next7: items.filter((item) => item.daysUntil <= 7).length,
        next30: items.filter((item) => item.daysUntil <= 30).length,
        completed: items.filter((item) => item.touchpointStatus === "Completed").length,
        pending: items.filter((item) => item.touchpointStatus === "Pending").length
      }
    });
  } catch (error) {
    console.error("Occasion list failed", error);
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const payload = await request.json();
    const investorId = String(payload.investorId || "").trim();
    if (!investorId) throw new Error("Select an investor.");
    const investorSnapshot = await adminDb.collection("investors").doc(investorId).get();
    if (!investorSnapshot.exists) throw new Error("Investor was not found.");
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (!canStaffAccessRecord(actor, investor)) throw new Error("You are not authorised to manage occasions for this investor.");

    const personName = String(payload.personName || "").trim();
    const relationship = String(payload.relationship || "Other");
    const occasionType = String(payload.occasionType || "Birthday");
    const occasionDate = String(payload.occasionDate || "").trim();
    if (!personName) throw new Error("Person name is required.");
    if (!OCCASION_RELATIONSHIPS.includes(relationship)) throw new Error("Select a valid relationship.");
    if (!OCCASION_TYPES.includes(occasionType)) throw new Error("Select a valid occasion type.");
    if (!parseOccasionDate(occasionDate)) throw new Error("Enter a valid occasion date.");

    const ref = adminDb.collection("investorOccasions").doc();
    const now = new Date();
    const data = {
      investorId,
      investorName: investor.fullName || "",
      clientCode: investor.clientCode || "",
      personName,
      relationship,
      occasionType,
      occasionDate,
      reminderEnabled: payload.reminderEnabled !== false,
      reminderOffsets: normaliseReminderOffsets(payload.reminderOffsets, 7),
      notes: String(payload.notes || "").trim(),
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
      advisorName: investor.assignedAdvisorName || investor.advisorName || "",
      active: true,
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest staff",
      createdAt: now,
      updatedAt: now
    };
    const activityRef = adminDb.collection("activityLogs").doc();
    await adminDb.runTransaction(async (transaction) => {
      transaction.set(ref, data);
      transaction.set(activityRef, {
        recordType: "occasion",
        recordId: ref.id,
        investorId,
        clientCode: investor.clientCode || "",
        leadName: investor.fullName || "",
        advisorUid: data.advisorUid,
        assignedAdvisorUid: data.advisorUid,
        action: "occasion_created",
        title: `${occasionType} occasion added`,
        description: `${personName} (${relationship}) was added to Birthday & Occasion Management.`,
        metadata: { occasionType, relationship },
        createdByUid: actor.uid,
        createdByName: data.createdByName,
        createdAt: now
      });
    });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("Occasion creation failed", error);
    return errorResponse(error);
  }
}
