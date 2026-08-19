import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { daysUntilDate, nextSipDebitDate, sipCycleId } from "@/lib/server/sipFundingServer";

export const runtime = "nodejs";

function authorised(request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return false;
  const supplied = String(
    request.headers.get("x-cron-secret")
      || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      || ""
  ).trim();
  return secureSecretMatch(supplied, configured);
}

async function processSchedule(scheduleDoc, now) {
  const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() };
  if (schedule.active === false) return { scheduleId: schedule.id, status: "inactive" };
  const debitDate = nextSipDebitDate(schedule.debitDay, now);
  const daysUntil = daysUntilDate(debitDate, now);
  const configuredDays = new Set((schedule.reminderDays || [5]).map(Number));
  const cycleId = sipCycleId(schedule.id, debitDate);
  const cycleRef = adminDb.collection("sipFundingCycles").doc(cycleId);
  const cycleSnapshot = await cycleRef.get();
  const cycle = cycleSnapshot.exists ? cycleSnapshot.data() : {};
  const followUpDayBefore = cycle.response === "will_add_funds" && daysUntil === 1 && cycle.status !== "ready";
  if (!configuredDays.has(daysUntil) && !followUpDayBefore) return { scheduleId: schedule.id, status: "not_due", daysUntil };
  if (["ready", "completed"].includes(cycle.status)) return { scheduleId: schedule.id, status: "already_ready", daysUntil };

  const reminderKey = `${daysUntil}_${debitDate}`;
  if (cycle.reminders?.[reminderKey]) return { scheduleId: schedule.id, status: "already_sent", daysUntil };

  const batch = adminDb.batch();
  batch.set(cycleRef, {
    scheduleId: schedule.id,
    investorId: schedule.investorId,
    investorName: schedule.investorName || "Investor",
    advisorUid: schedule.advisorUid || "",
    investorPortalUid: schedule.investorPortalUid || null,
    positionId: schedule.positionId,
    instrumentName: schedule.instrumentName || "Mutual Fund SIP",
    sipAmount: Number(schedule.sipAmount || 0),
    debitDate,
    status: cycle.status || "pending",
    response: cycle.response || "",
    reminders: { ...(cycle.reminders || {}), [reminderKey]: new Date() },
    lastReminderDaysBefore: daysUntil,
    lastReminderAt: FieldValue.serverTimestamp(),
    createdAt: cycle.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (schedule.investorPortalUid) {
    const investorNotification = adminDb.collection("notifications").doc(`sip_${schedule.id}_${debitDate}_${daysUntil}_investor`);
    batch.set(investorNotification, {
      recipientUid: schedule.investorPortalUid,
      recipientType: "investor",
      title: daysUntil === 0 ? "SIP debit due today" : `SIP debit in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      message: `${schedule.instrumentName || "Your SIP"} · ₹${Number(schedule.sipAmount || 0).toLocaleString("en-IN")} · Debit date ${debitDate}. Review funding status.`,
      eventType: "sip_funding_reminder",
      link: "/investor/sip-reminders",
      investorId: schedule.investorId,
      sipScheduleId: schedule.id,
      sipCycleId: cycleId,
      status: "unread",
      createdByUid: "system",
      createdAt: FieldValue.serverTimestamp(),
      readAt: null
    }, { merge: true });
  }

  if (schedule.advisorUid && (daysUntil <= 5 || followUpDayBefore)) {
    const advisorNotification = adminDb.collection("notifications").doc(`sip_${schedule.id}_${debitDate}_${daysUntil}_advisor`);
    batch.set(advisorNotification, {
      recipientUid: schedule.advisorUid,
      recipientType: "advisor",
      title: "Upcoming SIP funding",
      message: `${schedule.investorName || "Investor"} · ${schedule.instrumentName || "SIP"} · ₹${Number(schedule.sipAmount || 0).toLocaleString("en-IN")} due ${debitDate}.`,
      eventType: "sip_funding_reminder",
      link: "/sip-funding",
      investorId: schedule.investorId,
      sipScheduleId: schedule.id,
      sipCycleId: cycleId,
      status: "unread",
      createdByUid: "system",
      createdAt: FieldValue.serverTimestamp(),
      readAt: null
    }, { merge: true });
  }

  await batch.commit();
  return { scheduleId: schedule.id, status: "sent", daysUntil, debitDate };
}

async function run(request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const snapshot = await adminDb.collection("sipFundingSchedules").where("active", "==", true).limit(1000).get();
  const now = new Date();
  const results = [];
  for (const item of snapshot.docs) {
    try {
      results.push(await processSchedule(item, now));
    } catch (error) {
      results.push({ scheduleId: item.id, status: "failed", error: error.message });
    }
  }
  return NextResponse.json({ success: true, checked: snapshot.size, sent: results.filter((item) => item.status === "sent").length, results });
}

export async function GET(request) {
  try { return await run(request); }
  catch (error) {
    console.error("SIP funding reminder cron failed", error);
    return NextResponse.json({ error: error.message || "SIP funding reminder processing failed." }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
