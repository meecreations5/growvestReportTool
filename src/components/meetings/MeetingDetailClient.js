"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Users,
  Video,
  XCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { changeMeetingStatus, recordMeetingWhatsAppOpened, subscribeMeeting } from "@/services/meetingService";
import { sendMeetingCommunication } from "@/services/communicationService";
import { buildInvestorMeetingWhatsAppMessage } from "@/lib/utils/meetingMessages";
import { openWhatsAppChat } from "@/lib/utils/whatsapp";
import { formatDateTime } from "@/lib/utils/date";
import { meetingProviderLabel, meetingTypeLabel } from "@/lib/constants/meeting";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import MeetingStatusBadge from "@/components/meetings/MeetingStatusBadge";

export default function MeetingDetailClient({ meetingId }) {
  const { profile } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => subscribeMeeting(meetingId, (item) => {
    setMeeting(item);
    setLoading(false);
  }, (error) => {
    console.error(error);
    setMessage("You do not have access to this meeting.");
    setLoading(false);
  }), [meetingId]);

  useEffect(() => {
    const communicationMessage = sessionStorage.getItem("meetingCommunicationMessage");
    if (communicationMessage) {
      setMessage(communicationMessage);
      sessionStorage.removeItem("meetingCommunicationMessage");
    }
  }, []);

  async function resendEmail(eventType = "meeting_scheduled") {
    setBusy("email");
    setMessage("");
    try {
      await sendMeetingCommunication(meeting.id, eventType);
      setMessage("Meeting email sent successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  async function updateStatus(status) {
    let reason = "";
    if (status === "cancelled") {
      reason = window.prompt("Enter the client-shareable cancellation reason:") || "";
      if (!reason) return;
    }
    setBusy(status);
    setMessage("");
    try {
      await changeMeetingStatus(meeting, status, profile, reason);
      if (status === "cancelled") await sendMeetingCommunication(meeting.id, "meeting_cancelled");
      setMessage(`Meeting marked ${status}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  function openWhatsApp() {
    try {
      openWhatsAppChat({ mobile: meeting.investorMobile || meeting.leadMobile, message: buildInvestorMeetingWhatsAppMessage(meeting) });
      recordMeetingWhatsAppOpened(meeting, profile).catch((error) => console.error(error));
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading meeting…</div>;
  if (!meeting) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{message || "Meeting was not found."}</div>;

  const canJoin = Boolean(meeting.meetingLink) && !["completed", "cancelled"].includes(meeting.status);

  return (
    <div className="grid gap-5 pb-20 lg:pb-0">
      <Link href="/meetings" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to meetings</Link>

      <section className="overflow-hidden rounded-[var(--gv-radius-xl)] bg-[#070b1e] text-white shadow-[var(--gv-shadow-card)]">
        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3"><MeetingStatusBadge status={meeting.status} /><span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{meeting.meetingCode}</span></div>
            <h1 className="mt-4 max-w-3xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">{meeting.title}</h1>
            <p className="mt-2 text-sm text-slate-300">{meetingTypeLabel(meeting.meetingType)} · {meeting.investorName || meeting.leadName || "Internal meeting"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canJoin ? <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950"><Video size={17} /> Join meeting</a> : null}
            <Link href={`/meetings/${meeting.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white"><Edit3 size={16} /> Edit / Reschedule</Link>
          </div>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3">
          <div className="flex items-start gap-3 p-4 sm:p-5"><CalendarClock size={19} className="mt-0.5 text-cyan-300" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Date and time</p><p className="mt-1 font-semibold text-white">{formatDateTime(meeting.startAt)} – {meeting.endTime}</p></div></div>
          <div className="flex items-start gap-3 border-white/10 p-4 sm:border-l sm:p-5"><Video size={19} className="mt-0.5 text-cyan-300" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Meeting mode</p><p className="mt-1 font-semibold text-white">{meetingProviderLabel(meeting.meetingProvider)}</p></div></div>
          <div className="flex items-start gap-3 border-white/10 p-4 sm:border-l sm:p-5"><Users size={19} className="mt-0.5 text-cyan-300" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Advisor</p><p className="mt-1 font-semibold text-white">{meeting.advisorName || "Unassigned"}</p></div></div>
        </div>
      </section>

      {message ? <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(310px,.8fr)]">
        <div className="grid gap-5">
          <Card className="p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Client</p><p className="mt-2 text-lg font-bold text-slate-950">{meeting.investorName || meeting.leadName || "Internal"}</p><p className="mt-1 text-sm text-slate-500">{meeting.clientCode || meeting.leadCode || "—"}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Contact owner</p><p className="mt-2 text-lg font-bold text-slate-950">{meeting.advisorName}</p><p className="mt-1 text-sm text-slate-500">{meeting.advisorEmail || "—"}</p></div>
              {meeting.location ? <div className="flex gap-3 sm:col-span-2"><MapPin size={20} className="text-blue-700" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Location</p><p className="mt-1 font-semibold text-slate-900">{meeting.location}</p></div></div> : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-6"><p className="gv-eyebrow">Agenda</p><ol className="mt-4 grid gap-3">{(meeting.agenda || []).map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-700 text-xs font-bold text-white">{index + 1}</span><span className="pt-1">{item}</span></li>)}</ol>{meeting.instructions ? <div className="mt-5 rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Preparation notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{meeting.instructions}</p></div> : null}</Card>

          <Card className="p-5 sm:p-6"><p className="gv-eyebrow">Attendees</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{(meeting.attendees || []).map((item, index) => <div key={item.id || index} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.email || item.mobile || "No contact"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-600">{String(item.type || "attendee").replace(/_/g, " ")}</span></div><div className="mt-3 flex gap-2 text-[10px] font-semibold text-slate-500">{item.sendEmail ? <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">Email</span> : null}{item.sendWhatsApp ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">WhatsApp</span> : null}</div></div>)}</div></Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Communication</p><div className="mt-4 grid gap-2"><Button type="button" onClick={() => resendEmail(meeting.status === "rescheduled" ? "meeting_rescheduled" : "meeting_scheduled")} disabled={busy === "email"}><Mail size={16} /> {busy === "email" ? "Sending…" : "Send email again"}</Button><Button type="button" variant="secondary" onClick={openWhatsApp}><MessageCircle size={16} /> Open WhatsApp</Button></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><p><strong>Email status:</strong> {meeting.lastEmailStatus || "Not attempted"}</p>{meeting.lastEmailError ? <p className="mt-1 text-red-700"><strong>Error:</strong> {meeting.lastEmailError}</p> : null}</div></Card>

          <Card className="p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList size={19} /></span><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Minutes of Meeting</p><p className="mt-1 text-sm leading-5 text-slate-600">Record decisions, action items, internal notes, client summary and next follow-up.</p></div></div>{meeting.momId ? <Link href={`/mom/${meeting.momId}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">View MOM <ExternalLink size={15} /></Link> : <Link href={`/mom/create?meetingId=${meeting.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">Create MOM</Link>}</Card>

          {meeting.investorId ? <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Investor record</p><Link href={`/investors/${meeting.investorId}`} className="mt-3 inline-flex items-center gap-2 font-semibold text-blue-700 hover:underline">{meeting.investorName} · {meeting.clientCode} <ExternalLink size={14} /></Link></Card> : null}

          {meeting.status !== "completed" && meeting.status !== "cancelled" ? <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Meeting status</p><div className="mt-3 grid gap-2"><Button type="button" onClick={() => updateStatus("completed")} disabled={Boolean(busy)}><CheckCircle2 size={16} /> Mark completed</Button><Button type="button" variant="danger" onClick={() => updateStatus("cancelled")} disabled={Boolean(busy)}><XCircle size={16} /> Cancel meeting</Button></div></Card> : null}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {canJoin ? <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-semibold text-white"><Video size={16} /> Join</a> : <Button type="button" variant="secondary" onClick={() => resendEmail()}><Mail size={16} /> Email</Button>}
        {meeting.momId ? <Link href={`/mom/${meeting.momId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">View MOM</Link> : <Link href={`/mom/create?meetingId=${meeting.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">Create MOM</Link>}
      </div>
    </div>
  );
}
