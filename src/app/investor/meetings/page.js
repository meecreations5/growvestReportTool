"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { CalendarClock, CalendarPlus, CheckCircle2, ExternalLink, FileText, MapPin, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { formatDateTime } from "@/lib/utils/date";
import { meetingProviderLabel } from "@/lib/constants/meeting";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";

const tabs = ["Upcoming", "Past", "Meeting summaries"];

function toDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


function downloadMeetingIcs(meeting) {
  const start = toDate(meeting.startAt);
  const end = toDate(meeting.endAt) || (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
  if (!start || !end) return;
  const stamp = (value) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value) => String(value || "").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GrowVest//Investor Meeting//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.id || Date.now()}@growvest.info`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(meeting.title || "GrowVest Portfolio Review")}`,
    `DESCRIPTION:${escape(Array.isArray(meeting.agenda) ? meeting.agenda.join(" | ") : meeting.agenda || "GrowVest meeting")}`,
    meeting.meetingLink ? `URL:${meeting.meetingLink}` : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `growvest-meeting-${String(meeting.startAt || meeting.id || "review").slice(0, 10)}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function meetingIsUpcoming(meeting) {
  const date = toDate(meeting.startAt);
  return date && date.getTime() >= Date.now() && !["cancelled", "completed"].includes(String(meeting.status || "").toLowerCase());
}

function MeetingCard({ meeting }) {
  const provider = meetingProviderLabel(meeting.meetingProvider);
  const online = Boolean(meeting.meetingLink);
  return (
    <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${online ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{online ? <Video size={20} /> : <MapPin size={20} />}</span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${String(meeting.status).toLowerCase() === "cancelled" ? "bg-red-50 text-red-700" : String(meeting.status).toLowerCase() === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{meeting.status || "scheduled"}</span>
      </div>
      <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">{meeting.title || "Portfolio review"}</h2>
      <p className="mt-2 text-sm font-semibold text-slate-600">{formatDateTime(meeting.startAt)}</p>
      <p className="mt-1 text-xs text-slate-500">{provider} · Advisor: {meeting.advisorName || "GrowVest Advisor"}</p>
      {meeting.agenda?.length ? <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">{Array.isArray(meeting.agenda) ? meeting.agenda.join(" · ") : meeting.agenda}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {meeting.meetingLink && String(meeting.status).toLowerCase() !== "cancelled" ? <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white"><ExternalLink size={16} /> Join meeting</a> : null}
        <button type="button" onClick={() => downloadMeetingIcs(meeting)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600"><CalendarPlus size={16} /> Calendar</button>
      </div>
    </article>
  );
}

export default function InvestorMeetingsPage() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [moms, setMoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Upcoming");

  useEffect(() => {
    async function loadMeetings() {
      if (!profile?.investorId) return;
      setLoading(true);
      setError("");
      try {
        const [meetingSnapshot, momSnapshot] = await Promise.all([
          getDocs(query(collection(db, "meetings"), where("investorId", "==", profile.investorId), where("investorVisible", "==", true), orderBy("startAt", "desc"))),
          getDocs(query(collection(db, "meetingMinutes"), where("investorId", "==", profile.investorId), where("investorVisible", "==", true), orderBy("meetingDate", "desc")))
        ]);
        setMeetings(meetingSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setMoms(momSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load meetings. The required Firestore indexes may still be building.");
      } finally {
        setLoading(false);
      }
    }
    loadMeetings();
  }, [profile?.investorId]);

  const upcoming = useMemo(() => meetings.filter(meetingIsUpcoming).sort((a, b) => (toDate(a.startAt)?.getTime() || 0) - (toDate(b.startAt)?.getTime() || 0)), [meetings]);
  const past = useMemo(() => meetings.filter((meeting) => !meetingIsUpcoming(meeting)), [meetings]);
  const currentItems = tab === "Upcoming" ? upcoming : past;

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Reviews and MOM" title="Meetings" description="Join upcoming reviews and revisit client-shareable meeting summaries and agreed actions." />

      <section className="grid grid-cols-3 gap-3">
        {[
          ["Upcoming", upcoming.length, CalendarClock],
          ["Completed", past.filter((item) => String(item.status).toLowerCase() === "completed").length, CheckCircle2],
          ["Summaries", moms.length, FileText]
        ].map(([label, value, Icon]) => (
          <article key={label} className="rounded-2xl border border-[var(--gv-border)] bg-white p-3 text-center shadow-[var(--gv-shadow-card)] sm:p-4">
            <Icon size={18} className="mx-auto text-[var(--gv-blue)]" />
            <p className="mt-2 font-heading text-2xl font-bold text-[var(--gv-ink)]">{loading ? "…" : value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          </article>
        ))}
      </section>

      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Meeting views">
        <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-card)]">
          {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-10 rounded-xl px-4 text-xs font-bold ${tab === item ? "bg-[var(--gv-blue)] text-white" : "text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}
        </div>
      </nav>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2"><div className="gv-skeleton h-56 rounded-2xl" /><div className="gv-skeleton h-56 rounded-2xl" /></div>
      ) : tab === "Meeting summaries" ? (
        moms.length ? <section className="grid gap-4 md:grid-cols-2">{moms.map((mom) => (
          <article key={mom.id} className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)]">
            <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileText size={20} /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Client visible</span></div>
            <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">{mom.meetingTitle || mom.title || "Portfolio review summary"}</h2>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(mom.meetingDate || mom.createdAt)} · {mom.advisorName || "GrowVest Advisor"}</p>
            <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{mom.clientSummary || "Your meeting summary is available."}</p>
            {mom.clientDecisions?.length || mom.decisions?.length ? <p className="mt-4 text-xs font-bold text-[var(--gv-blue)]">{(mom.clientDecisions || mom.decisions || []).length} agreed decision(s)</p> : null}
          </article>
        ))}</section> : <EmptyMeetingState title="No meeting summaries yet" message="Client-shareable MOMs will appear after your Advisor completes a review." />
      ) : currentItems.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{currentItems.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}</section>
      ) : (
        <EmptyMeetingState title={tab === "Upcoming" ? "No upcoming meetings" : "No previous meetings"} message={tab === "Upcoming" ? "Your next review will appear here after it is scheduled." : "Completed and cancelled meetings will appear here."} />
      )}
    </div>
  );
}

function EmptyMeetingState({ title, message }) {
  return (
    <section className="grid place-items-center rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white px-6 py-16 text-center shadow-[var(--gv-shadow-card)]">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><CalendarClock size={24} /></span>
      <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{message}</p>
    </section>
  );
}
