import { NextResponse } from "next/server";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { createMeetingIcs } from "@/lib/server/ics";
import { meetingEmailContent } from "@/lib/server/emailTemplates";
import { getAdvisorEmailProfile, getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";

function authorised(request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return false;

  const header = String(
    request.headers.get("x-cron-secret")
      || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      || ""
  ).trim();

  return secureSecretMatch(header, configured);
}

function primaryClientRecipient(meeting) {
  const email = String(meeting.investorEmail || meeting.leadEmail || "").trim();
  if (email) {
    return {
      name: meeting.investorName || meeting.leadName || "",
      email,
      type: meeting.investorId ? "investor" : "lead"
    };
  }

  const attendee = (meeting.attendees || []).find((item) => {
    const type = String(item?.type || "").toLowerCase();
    return item?.email && ["investor", "lead", "primary_client"].includes(type);
  });

  return attendee
    ? { name: attendee.name || "", email: attendee.email, type: meeting.investorId ? "investor" : "lead" }
    : null;
}

async function logCommunication(payload) {
  await adminDb.collection("communicationLogs").add({
    ...payload,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

async function sendReminderEmail(meeting, recipient, recipientType, reminderKey) {
  if (!recipient?.email) return { status: "skipped", reason: "Recipient email is missing" };

  const branding = await getServerBranding();
  const communicationSettings = await getServerCommunicationSettings();
  const advisor = await getAdvisorEmailProfile(meeting.advisorUid, { fullName: meeting.advisorName, email: meeting.advisorEmail, designation: meeting.advisorDesignation || "" });
  advisor.companyName = branding.companyName;
  advisor.defaultSenderName = communicationSettings.senderName;
  advisor.defaultSenderEmail = communicationSettings.senderEmail;
  advisor.replyToEmail = communicationSettings.replyToEmail;
  const content = meetingEmailContent(meeting, recipientType, "meeting_reminder", { branding, advisor });

  try {
    const result = await sendTransactionalEmail({
      to: [{ name: recipient.name || "", address: recipient.email }],
      subject: content.subject,
      html: content.html,
      text: content.text,
      advisor,
      attachments: [{
        filename: `${meeting.meetingCode || "growvest-meeting"}.ics`,
        content: createMeetingIcs(meeting, "meeting_reminder"),
        contentType: "text/calendar; charset=utf-8; method=REQUEST"
      }]
    });

    await logCommunication({
      eventType: "meeting_reminder",
      reminderKey,
      channel: "email",
      provider: "brevo_smtp",
      recipientType,
      recipientName: recipient.name || "",
      recipientEmail: recipient.email,
      meetingId: meeting.id,
      investorId: meeting.investorId || null,
      leadId: meeting.leadId || null,
      advisorUid: meeting.advisorUid || null,
      status: result.skipped ? "skipped" : "sent",
      providerMessageId: result.messageId || null,
      failureReason: result.reason || null,
      sentByUid: "system",
      sentAt: result.skipped ? null : new Date()
    });

    return { status: result.skipped ? "skipped" : "sent", email: recipient.email };
  } catch (error) {
    await logCommunication({
      eventType: "meeting_reminder",
      reminderKey,
      channel: "email",
      provider: "brevo_smtp",
      recipientType,
      recipientName: recipient.name || "",
      recipientEmail: recipient.email,
      meetingId: meeting.id,
      investorId: meeting.investorId || null,
      leadId: meeting.leadId || null,
      advisorUid: meeting.advisorUid || null,
      status: "failed",
      providerMessageId: null,
      failureReason: error.message,
      sentByUid: "system",
      sentAt: null
    });

    return { status: "failed", email: recipient.email, error: error.message };
  }
}

async function createReminderNotifications(meeting, reminderLabel) {
  const batch = adminDb.batch();
  let count = 0;

  if (meeting.advisorUid) {
    const advisorRef = adminDb.collection("notifications").doc();
    batch.set(advisorRef, {
      recipientUid: meeting.advisorUid,
      recipientType: "advisor",
      title: `Meeting ${reminderLabel}`,
      message: `${meeting.title} with ${meeting.investorName || meeting.leadName || "the client"} starts at ${meeting.startTime}.`,
      eventType: "meeting_reminder",
      link: `/meetings/${meeting.id}`,
      investorId: meeting.investorId || null,
      leadId: meeting.leadId || null,
      meetingId: meeting.id,
      status: "unread",
      createdByUid: "system",
      createdAt: new Date(),
      readAt: null
    });
    count += 1;
  }

  if (meeting.investorPortalUid && meeting.investorVisible) {
    const investorRef = adminDb.collection("notifications").doc();
    batch.set(investorRef, {
      recipientUid: meeting.investorPortalUid,
      recipientType: "investor",
      title: `GrowVest meeting ${reminderLabel}`,
      message: `Your ${meeting.title} starts at ${meeting.startTime}.`,
      eventType: "meeting_reminder",
      link: "/investor/meetings",
      investorId: meeting.investorId || null,
      meetingId: meeting.id,
      status: "unread",
      createdByUid: "system",
      createdAt: new Date(),
      readAt: null
    });
    count += 1;
  }

  if (count) await batch.commit();
  return count;
}

function resolveReminder(meeting, minutes, forcedReminder) {
  if (forcedReminder === "24_hours") {
    return { reminderKey: "24_hours", reminderLabel: "tomorrow", field: "sent24HoursAt" };
  }
  if (forcedReminder === "1_hour") {
    return { reminderKey: "1_hour", reminderLabel: "starts in 1 hour", field: "sent1HourAt" };
  }

  if (
    meeting.communicationSettings?.reminder1Hour !== false
    && minutes > 0
    && minutes <= 75
    && !meeting.reminders?.sent1HourAt
  ) {
    return { reminderKey: "1_hour", reminderLabel: "starts in 1 hour", field: "sent1HourAt" };
  }

  if (
    meeting.communicationSettings?.reminder24Hours !== false
    && minutes > 75
    && minutes <= 1500
    && !meeting.reminders?.sent24HoursAt
  ) {
    return { reminderKey: "24_hours", reminderLabel: "tomorrow", field: "sent24HoursAt" };
  }

  return null;
}

async function processMeeting(snapshot, now, forcedReminder = "") {
  const meeting = { id: snapshot.id, ...snapshot.data() };
  if (!["scheduled", "rescheduled"].includes(meeting.status)) {
    return { meetingId: meeting.id, status: "skipped", reason: `Meeting status is ${meeting.status}.` };
  }

  const start = meeting.startAt?.toDate?.() || (meeting.startAt ? new Date(meeting.startAt) : null);
  if (!start || Number.isNaN(start.getTime())) {
    return { meetingId: meeting.id, status: "skipped", reason: "Meeting startAt is missing or invalid." };
  }

  const minutes = (start.getTime() - now.getTime()) / 60000;
  const reminder = resolveReminder(meeting, minutes, forcedReminder);
  if (!reminder) {
    return {
      meetingId: meeting.id,
      status: "not_due",
      minutesUntilMeeting: Math.round(minutes)
    };
  }

  const results = [];
  const clientRecipient = primaryClientRecipient(meeting);

  if (meeting.communicationSettings?.sendInvestorEmail !== false && clientRecipient) {
    results.push(await sendReminderEmail(
      meeting,
      clientRecipient,
      clientRecipient.type,
      reminder.reminderKey
    ));
  }

  if (meeting.communicationSettings?.sendAdvisorEmail !== false && meeting.advisorEmail) {
    results.push(await sendReminderEmail(
      meeting,
      { name: meeting.advisorName, email: meeting.advisorEmail },
      "advisor",
      reminder.reminderKey
    ));
  }

  const failed = results.filter((item) => item.status === "failed");
  const notificationCount = await createReminderNotifications(meeting, reminder.reminderLabel);

  const update = {
    [`reminders.${reminder.field}`]: new Date(),
    lastReminderAttemptAt: new Date(),
    lastReminderStatus: failed.length ? "partial_or_failed" : "sent",
    lastReminderError: failed.map((item) => item.error).filter(Boolean).join(" | ") || null,
    updatedAt: new Date()
  };
  await snapshot.ref.update(update);

  return {
    meetingId: meeting.id,
    status: failed.length ? "partial_or_failed" : "sent",
    reminderKey: reminder.reminderKey,
    minutesUntilMeeting: Math.round(minutes),
    notificationCount,
    results
  };
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({
      error: "Unauthorised. The x-cron-secret header must match CRON_SECRET."
    }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const meetingId = url.searchParams.get("meetingId") || "";
    const forcedReminder = url.searchParams.get("force") || "";
    const validForce = ["", "24_hours", "1_hour"].includes(forcedReminder);

    if (!validForce) {
      return NextResponse.json({ error: "force must be 24_hours or 1_hour." }, { status: 400 });
    }

    const now = new Date();

    if (meetingId) {
      const item = await adminDb.collection("meetings").doc(meetingId).get();
      if (!item.exists) {
        return NextResponse.json({ error: "Meeting was not found." }, { status: 404 });
      }

      const result = await processMeeting(item, now, forcedReminder);
      return NextResponse.json({
        success: true,
        mode: forcedReminder ? "forced_test" : "single_meeting",
        now: now.toISOString(),
        processed: 1,
        results: [result]
      });
    }

    const max = new Date(now.getTime() + 26 * 60 * 60 * 1000);
    const snapshot = await adminDb.collection("meetings")
      .where("startAt", ">=", now)
      .where("startAt", "<=", max)
      .orderBy("startAt", "asc")
      .get();

    const results = [];
    for (const item of snapshot.docs) {
      try {
        results.push(await processMeeting(item, now));
      } catch (error) {
        results.push({ meetingId: item.id, status: "failed", error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      mode: "scheduled_scan",
      now: now.toISOString(),
      matchedMeetings: snapshot.size,
      processed: results.filter((item) => item.status === "sent" || item.status === "partial_or_failed").length,
      results
    });
  } catch (error) {
    console.error("Meeting reminder job failed", error);
    return NextResponse.json({ error: error.message || "Reminder job failed." }, { status: 500 });
  }
}
