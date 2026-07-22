import { NextResponse } from "next/server";
import { adminDb, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { createMeetingIcs } from "@/lib/server/ics";
import { meetingEmailContent } from "@/lib/server/emailTemplates";
import { getAdvisorEmailProfile, getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";

function uniqueRecipients(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const email = String(item?.email || item?.address || "").trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

function primaryClientRecipient(meeting) {
  const directEmail = String(meeting.investorEmail || meeting.leadEmail || "").trim();
  if (directEmail) {
    return {
      name: meeting.investorName || meeting.leadName || "",
      email: directEmail,
      type: meeting.investorId ? "investor" : "lead"
    };
  }

  const attendee = (meeting.attendees || []).find((item) => {
    const type = String(item?.type || "").toLowerCase();
    return item?.email && ["investor", "lead", "primary_client"].includes(type);
  });

  if (!attendee) return null;
  return {
    name: attendee.name || meeting.investorName || meeting.leadName || "",
    email: attendee.email,
    type: meeting.investorId ? "investor" : meeting.leadId ? "lead" : "attendee"
  };
}

async function logCommunication(payload) {
  await adminDb.collection("communicationLogs").add({
    ...payload,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

async function sendAndLog({ meeting, recipient, recipientType, eventType, advisor, branding, actorUid, attachment }) {
  const content = meetingEmailContent(meeting, recipientType, eventType, { branding, advisor });

  try {
    const result = await sendTransactionalEmail({
      to: [{ name: recipient.name || "", address: recipient.email }],
      subject: content.subject,
      html: content.html,
      text: content.text,
      advisor,
      attachments: attachment ? [attachment] : []
    });

    const status = result.skipped ? "skipped" : "sent";
    await logCommunication({
      eventType,
      channel: "email",
      provider: "brevo_smtp",
      recipientType,
      recipientName: recipient.name || "",
      recipientEmail: recipient.email,
      meetingId: meeting.id,
      investorId: meeting.investorId || null,
      leadId: meeting.leadId || null,
      advisorUid: meeting.advisorUid,
      status,
      providerMessageId: result.messageId || null,
      providerResponse: result.response || null,
      failureReason: result.reason || null,
      sentByUid: actorUid,
      sentAt: result.skipped ? null : new Date()
    });

    return {
      email: recipient.email,
      recipientType,
      status,
      messageId: result.messageId || null,
      accepted: result.accepted || [],
      rejected: result.rejected || []
    };
  } catch (error) {
    await logCommunication({
      eventType,
      channel: "email",
      provider: "brevo_smtp",
      recipientType,
      recipientName: recipient.name || "",
      recipientEmail: recipient.email,
      meetingId: meeting.id,
      investorId: meeting.investorId || null,
      leadId: meeting.leadId || null,
      advisorUid: meeting.advisorUid,
      status: "failed",
      providerMessageId: null,
      failureReason: error.message,
      sentByUid: actorUid,
      sentAt: null
    });

    return {
      email: recipient.email,
      recipientType,
      status: "failed",
      error: error.message
    };
  }
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { meetingId, eventType = "meeting_scheduled" } = await request.json();

    if (!meetingId) {
      return NextResponse.json({ error: "Meeting ID is required." }, { status: 400 });
    }

    const snapshot = await adminDb.collection("meetings").doc(meetingId).get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Meeting was not found." }, { status: 404 });
    }

    const meeting = { id: snapshot.id, ...snapshot.data() };
    const isAdmin = ["super_admin", "admin"].includes(actor.role);
    if (!isAdmin && meeting.advisorUid !== actor.uid) {
      return NextResponse.json(
        { error: "You are not authorised to send this meeting communication." },
        { status: 403 }
      );
    }

    const settings = meeting.communicationSettings || {};
    const branding = await getServerBranding();
    const communicationSettings = await getServerCommunicationSettings();
    const advisor = await getAdvisorEmailProfile(meeting.advisorUid, {
      fullName: meeting.advisorName || actor.fullName,
      email: meeting.advisorEmail || actor.email,
      designation: meeting.advisorDesignation || ""
    });
    advisor.companyName = branding.companyName;
    advisor.defaultSenderName = communicationSettings.senderName;
    advisor.defaultSenderEmail = communicationSettings.senderEmail;
    advisor.replyToEmail = communicationSettings.replyToEmail;
    const ics = createMeetingIcs(meeting, eventType);
    const attachment = {
      filename: `${meeting.meetingCode || "growvest-meeting"}.ics`,
      content: ics,
      contentType: "text/calendar; charset=utf-8; method=REQUEST"
    };

    const jobs = [];
    const clientRecipient = primaryClientRecipient(meeting);

    if (settings.sendInvestorEmail !== false) {
      if (clientRecipient?.email) {
        jobs.push(sendAndLog({
          meeting,
          recipient: clientRecipient,
          recipientType: clientRecipient.type,
          eventType,
          advisor,
          branding,
          actorUid: actor.uid,
          attachment
        }));
      }
    }

    const advisorEmail = String(meeting.advisorEmail || actor.email || "").trim();
    if (settings.sendAdvisorEmail !== false && advisorEmail) {
      jobs.push(sendAndLog({
        meeting,
        recipient: { name: meeting.advisorName || actor.fullName, email: advisorEmail },
        recipientType: "advisor",
        eventType,
        advisor,
        branding,
        actorUid: actor.uid,
        attachment
      }));
    }

    const primaryEmails = new Set([
      clientRecipient?.email,
      advisorEmail
    ].filter(Boolean).map((value) => value.toLowerCase()));

    const additional = uniqueRecipients((meeting.attendees || [])
      .filter((item) => item.sendEmail !== false && item.email && !primaryEmails.has(item.email.toLowerCase()))
      .map((item) => ({ name: item.name, email: item.email })));

    additional.forEach((recipient) => {
      jobs.push(sendAndLog({
        meeting,
        recipient,
        recipientType: "attendee",
        eventType,
        advisor,
        branding,
        actorUid: actor.uid,
        attachment
      }));
    });

    if (!jobs.length) {
      const message = "No email recipient was found. Add an investor/lead email or an attendee email.";
      await adminDb.collection("meetings").doc(meetingId).set({
        lastCommunicationEvent: eventType,
        lastEmailAttemptAt: new Date(),
        lastEmailStatus: "skipped",
        lastEmailError: message,
        updatedAt: new Date()
      }, { merge: true });

      return NextResponse.json({ error: message, success: false, results: [] }, { status: 422 });
    }

    const results = await Promise.all(jobs);
    const failed = results.filter((item) => item.status === "failed");
    const sent = results.filter((item) => item.status === "sent");
    const lastEmailError = failed.map((item) => `${item.email}: ${item.error}`).join(" | ") || null;

    await adminDb.collection("meetings").doc(meetingId).set({
      lastCommunicationEvent: eventType,
      lastEmailAttemptAt: new Date(),
      lastEmailStatus: failed.length ? (sent.length ? "partial" : "failed") : "sent",
      lastEmailError,
      lastEmailResults: results,
      updatedAt: new Date()
    }, { merge: true });

    if (failed.length) {
      return NextResponse.json({
        error: sent.length
          ? `Some emails failed: ${lastEmailError}`
          : `Email could not be sent: ${lastEmailError}`,
        success: false,
        results
      }, { status: 502 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Meeting communication failed", error);
    return NextResponse.json(
      { error: error.message || "Unable to send meeting communication." },
      { status: 500 }
    );
  }
}
