import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { customOccasionRow, investorBirthdayRow, reminderMessage, reminderTitle } from "@/lib/server/occasionEngine";
import { indiaDateParts } from "@/lib/utils/occasions";

function authorised(request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return false;
  const header = String(request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "").trim();
  return secureSecretMatch(header, configured);
}

async function createReminder(row) {
  if (!row?.reminderEnabled || !row?.advisorUid) {
    return { id: row?.id, status: "skipped", reason: !row?.advisorUid ? "Assigned advisor is missing" : "Reminder disabled" };
  }
  if (!row.reminderOffsets.includes(row.daysUntil)) return { id: row.id, status: "not_due", daysUntil: row.daysUntil };

  const notificationId = `occasion_reminder_${row.occasionKey}_${row.eventYear}_${row.daysUntil}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const notificationRef = adminDb.collection("notifications").doc(notificationId);
  const touchpointRef = adminDb.collection("occasionTouchpoints").doc(row.touchpointId);
  const now = new Date();

  const result = await adminDb.runTransaction(async (transaction) => {
    const [existingNotification, touchpoint] = await Promise.all([transaction.get(notificationRef), transaction.get(touchpointRef)]);
    if (existingNotification.exists) return "already_created";
    if (touchpoint.exists && ["Completed", "Skipped"].includes(touchpoint.data()?.status)) return "already_closed";

    transaction.set(notificationRef, {
      recipientUid: row.advisorUid,
      recipientType: "advisor",
      title: reminderTitle(row),
      message: reminderMessage(row),
      eventType: "occasion_reminder",
      link: `/occasions?investorId=${encodeURIComponent(row.investorId)}`,
      investorId: row.investorId,
      metadata: {
        occasionId: row.id,
        occasionKey: row.occasionKey,
        occasionType: row.occasionType,
        relationship: row.relationship,
        personName: row.personName,
        eventDate: row.eventDate,
        eventYear: row.eventYear,
        daysUntil: row.daysUntil
      },
      status: "unread",
      createdByUid: "system",
      createdAt: now,
      readAt: null
    });

    transaction.set(touchpointRef, {
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
      status: "Pending",
      lastReminderAt: now,
      lastReminderDaysBefore: row.daysUntil,
      updatedAt: now,
      createdAt: touchpoint.exists ? (touchpoint.data()?.createdAt || now) : now
    }, { merge: true });
    return "created";
  });

  return { id: row.id, investorId: row.investorId, status: result, daysUntil: row.daysUntil, advisorUid: row.advisorUid };
}

export async function GET(request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised cron request." }, { status: 401 });

  try {
    const today = indiaDateParts();
    const investorSnapshot = await adminDb.collection("investors").where("isDeleted", "==", false).get();
    const investors = investorSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "inactive");
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

    const due = rows.filter((row) => row.reminderEnabled && row.reminderOffsets.includes(row.daysUntil));
    const results = [];
    for (const row of due) {
      try { results.push(await createReminder(row)); }
      catch (error) { results.push({ id: row.id, investorId: row.investorId, status: "failed", error: error.message }); }
    }

    return NextResponse.json({
      success: true,
      date: `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
      timezone: "Asia/Kolkata",
      investorsScanned: investors.length,
      occasionsScanned: rows.length,
      due: due.length,
      remindersCreated: results.filter((item) => item.status === "created").length,
      results
    });
  } catch (error) {
    console.error("Birthday & occasion reminder job failed", error);
    return NextResponse.json({ error: error.message || "Birthday & occasion reminder job failed." }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
