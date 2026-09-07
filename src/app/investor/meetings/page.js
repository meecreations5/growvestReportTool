"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, CheckCircle2, ChevronRight, ExternalLink, FileText, MapPin, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils/date";
import { meetingProviderLabel } from "@/lib/constants/meeting";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { getInvestorAppData } from "@/services/investorAppService";
import { GrowVestOutline } from "@/components/investor/mobile/InvestorMobilePrimitives";

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

function MobileMeetingCard({ meeting }) {
  const online = Boolean(meeting.meetingLink);
  const status = String(meeting.status || "scheduled").toLowerCase();
  return <article className="gv-mobile-app-card p-4">
    <div className="flex items-start gap-3">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] ${online ? "bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]" : "bg-amber-50 text-amber-700"}`}>{online ? <Video size={20} /> : <MapPin size={20} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 flex-1 font-heading text-[1.05rem] font-bold leading-5 text-slate-950">{meeting.title || "Portfolio review"}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black uppercase ${status === "cancelled" ? "bg-red-50 text-red-700" : status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-[var(--gv-blue)]"}`}>{meeting.status || "Scheduled"}</span></div>
        <p className="mt-1.5 text-xs font-bold text-slate-600">{formatDateTime(meeting.startAt)}</p>
        <p className="mt-1 text-[10px] text-slate-400">{meetingProviderLabel(meeting.meetingProvider)} · {meeting.advisorName || "GrowVest Advisor"}</p>
      </div>
    </div>
    {meeting.agenda?.length ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{Array.isArray(meeting.agenda) ? meeting.agenda.join(" · ") : meeting.agenda}</p> : null}
    <div className="mt-3 grid grid-cols-2 gap-2">
      {meeting.meetingLink && status !== "cancelled" ? <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--gv-blue)] px-3 text-xs font-black text-white"><ExternalLink size={15} /> Join</a> : <span className="grid min-h-11 place-items-center rounded-2xl bg-slate-50 text-[10px] font-bold text-slate-400">{status === "completed" ? "Completed" : "Offline review"}</span>}
      <button type="button" onClick={() => downloadMeetingIcs(meeting)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600"><CalendarPlus size={15} /> Calendar</button>
    </div>
  </article>;
}

function MobileMeetingsApp({ loading, error, tab, setTab, upcoming, past, moms, currentItems }) {
  const completed = past.filter((item) => String(item.status).toLowerCase() === "completed").length;
  const next = upcoming[0];
  const listedItems = tab === "Upcoming" && next ? currentItems.filter((item) => item.id !== next.id) : currentItems;
  return <div className="gv-mobile-app-stack md:hidden">
    <section className="gv-mobile-hero-glow relative overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,#07122f_0%,#0f2a73_46%,#1f4ed8_100%)] p-5 text-white shadow-[0_24px_64px_rgba(31,78,216,.2)]">
      <GrowVestOutline className="absolute -right-10 top-8 w-40 brightness-0 invert" opacity={0.14} />
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/80">Reviews & conversations</p>
      <h2 className="mt-2 font-heading text-2xl font-bold">Your GrowVest reviews</h2>
      <p className="mt-1.5 max-w-[270px] text-xs leading-5 text-white/65">Meet, review progress and keep every agreed action in one place.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-[20px] border border-white/10 bg-white/[.07] p-3">
        {[['Upcoming', upcoming.length], ['Completed', completed], ['Summaries', moms.length]].map(([label, value]) => <div key={label} className="text-center"><p className="font-heading text-xl font-bold">{loading ? '…' : value}</p><p className="mt-0.5 text-[8px] font-bold uppercase text-white/45">{label}</p></div>)}
      </div>
    </section>

    {next ? <section className="gv-mobile-app-card overflow-hidden p-4"><div className="flex items-center justify-between"><div><p className="gv-mobile-section-title text-[var(--gv-blue)]">Next review</p><h3 className="mt-1 font-heading text-lg font-bold text-slate-950">{next.title || 'Portfolio review'}</h3></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]"><CalendarClock size={18} /></span></div><p className="mt-2 text-xs font-bold text-slate-600">{formatDateTime(next.startAt)}</p><p className="mt-1 text-[10px] text-slate-400">With {next.advisorName || 'your GrowVest Advisor'}</p></section> : null}

    <div className="gv-mobile-segment grid grid-cols-3 rounded-[18px] bg-slate-100 p-1">
      {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-10 rounded-[14px] px-2 text-[10px] font-black ${tab === item ? 'bg-[var(--gv-blue)] text-white shadow-sm' : 'text-slate-500'}`}>{item === 'Meeting summaries' ? 'Summaries' : item}</button>)}
    </div>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}
    {loading ? <div className="space-y-3"><div className="gv-skeleton h-40 rounded-[24px]" /><div className="gv-skeleton h-40 rounded-[24px]" /></div> : tab === 'Meeting summaries' ? (moms.length ? <div className="space-y-3">{moms.map((mom) => <article key={mom.id} className="gv-mobile-app-card p-4"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileText size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-heading text-base font-bold leading-5 text-slate-950">{mom.meetingTitle || mom.title || 'Portfolio review summary'}</h3><CheckCircle2 size={16} className="shrink-0 text-emerald-600" /></div><p className="mt-1 text-[10px] text-slate-400">{formatDateTime(mom.meetingDate || mom.createdAt)} · {mom.advisorName || 'GrowVest Advisor'}</p></div></div><p className="mt-3 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{mom.clientSummary || 'Your meeting summary is available.'}</p>{mom.clientDecisions?.length || mom.decisions?.length ? <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--gv-blue-soft)] px-3 py-2.5 text-[10px] font-bold text-[var(--gv-blue)]"><span>{(mom.clientDecisions || mom.decisions || []).length} agreed decision(s)</span><ChevronRight size={15} /></div> : null}</article>)}</div> : <MobileEmpty title="No summaries yet" message="Your meeting summaries will appear after a completed GrowVest review." />) : listedItems.length ? <div className="space-y-3">{listedItems.map((meeting) => <MobileMeetingCard key={meeting.id} meeting={meeting} />)}</div> : <MobileEmpty title={tab === 'Upcoming' ? 'No upcoming meetings' : 'No previous meetings'} message={tab === 'Upcoming' ? 'Your next review will appear here once scheduled.' : 'Completed and cancelled reviews will appear here.'} />}
  </div>;
}

function MobileEmpty({ title, message }) {
  return <section className="gv-mobile-app-card px-5 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]"><CalendarClock size={20} /></span><h3 className="mt-3 font-heading text-lg font-bold text-slate-950">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{message}</p></section>;
}

export default function InvestorMeetingsPage() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [moms, setMoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Upcoming");

  useEffect(() => {
    let active = true;
    async function loadMeetings() {
      if (!profile?.investorId) { setLoading(false); return; }
      setLoading(true); setError("");
      try {
        const payload = await getInvestorAppData("meetings");
        if (!active) return;
        setMeetings(payload.meetings || []); setMoms(payload.moms || []);
      } catch (loadError) {
        console.error("Investor meetings load failed", loadError);
        if (active) setError(loadError?.message || "Unable to load meetings. Please refresh and try again.");
      } finally { if (active) setLoading(false); }
    }
    loadMeetings();
    return () => { active = false; };
  }, [profile?.investorId]);

  const upcoming = useMemo(() => meetings.filter(meetingIsUpcoming).sort((a, b) => (toDate(a.startAt)?.getTime() || 0) - (toDate(b.startAt)?.getTime() || 0)), [meetings]);
  const past = useMemo(() => meetings.filter((meeting) => !meetingIsUpcoming(meeting)), [meetings]);
  const currentItems = tab === "Upcoming" ? upcoming : past;

  return <>
    <MobileMeetingsApp loading={loading} error={error} tab={tab} setTab={setTab} upcoming={upcoming} past={past} moms={moms} currentItems={currentItems} />
    <div className="hidden gap-5 sm:gap-6 md:grid">
      <InvestorPageHeader eyebrow="Reviews and MOM" title="Meetings" description="Join upcoming reviews and revisit client-shareable meeting summaries and agreed actions." />
      <section className="grid grid-cols-3 gap-3">{[["Upcoming", upcoming.length, CalendarClock], ["Completed", past.filter((item) => String(item.status).toLowerCase() === "completed").length, CheckCircle2], ["Summaries", moms.length, FileText]].map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-[var(--gv-border)] bg-white p-3 text-center shadow-[var(--gv-shadow-card)] sm:p-4"><Icon size={18} className="mx-auto text-[var(--gv-blue)]" /><p className="mt-2 font-heading text-2xl font-bold text-[var(--gv-ink)]">{loading ? "…" : value}</p><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p></article>)}</section>
      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Meeting views"><div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-card)]">{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-10 rounded-xl px-4 text-xs font-bold ${tab === item ? "bg-[var(--gv-blue)] text-white" : "text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}</div></nav>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="gv-skeleton h-56 rounded-2xl" />
          <div className="gv-skeleton h-56 rounded-2xl" />
        </div>
      ) : tab === "Meeting summaries" ? (
        moms.length ? (
          <section className="grid gap-4 md:grid-cols-2">
            {moms.map((mom) => (
              <article key={mom.id} className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileText size={20} /></span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Client visible</span>
                </div>
                <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">{mom.meetingTitle || mom.title || "Portfolio review summary"}</h2>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(mom.meetingDate || mom.createdAt)} · {mom.advisorName || "GrowVest Advisor"}</p>
                <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{mom.clientSummary || "Your meeting summary is available."}</p>
                {mom.clientDecisions?.length || mom.decisions?.length ? (
                  <p className="mt-4 text-xs font-bold text-[var(--gv-blue)]">{(mom.clientDecisions || mom.decisions || []).length} agreed decision(s)</p>
                ) : null}
              </article>
            ))}
          </section>
        ) : (
          <EmptyMeetingState title="No meeting summaries yet" message="Client-shareable MOMs will appear after your GrowVest Partner completes a review." />
        )
      ) : currentItems.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {currentItems.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}
        </section>
      ) : (
        <EmptyMeetingState
          title={tab === "Upcoming" ? "No upcoming meetings" : "No previous meetings"}
          message={tab === "Upcoming" ? "Your next review will appear here after it is scheduled." : "Completed and cancelled meetings will appear here."}
        />
      )}
    </div>
  </>;
}

function EmptyMeetingState({ title, message }) {
  return <section className="grid place-items-center rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white px-6 py-16 text-center shadow-[var(--gv-shadow-card)]"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><CalendarClock size={24} /></span><h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{message}</p></section>;
}
