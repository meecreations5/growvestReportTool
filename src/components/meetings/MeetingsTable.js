"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Search,
  Users,
  Video
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeMeetings } from "@/services/meetingService";
import { formatDateTime } from "@/lib/utils/date";
import { meetingProviderLabel, meetingTypeLabel } from "@/lib/constants/meeting";
import MeetingStatusBadge from "@/components/meetings/MeetingStatusBadge";
import { inputClassName } from "@/components/ui/Field";
import MetricCard from "@/components/ui/MetricCard";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import EmptyState from "@/components/ui/EmptyState";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function isSameDay(left, right) {
  return left && right
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function mobileMeetingCard(item) {
  const start = toDate(item.startAt);
  const canJoin = Boolean(item.meetingLink) && !["completed", "cancelled"].includes(item.status);
  return (
    <article key={item.id} className="gv-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold text-[var(--gv-ink)]">{item.title}</p>
          <p className="mt-1 text-xs text-slate-500">{item.meetingCode} · {meetingTypeLabel(item.meetingType)}</p>
        </div>
        <MeetingStatusBadge status={item.status} />
      </div>
      <div className="grid gap-3 p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Users size={17} /></span>
          <div className="min-w-0"><p className="font-semibold text-slate-900">{item.investorName || item.leadName || "Internal meeting"}</p><p className="truncate text-xs text-slate-500">{item.clientCode || item.leadCode || item.advisorName || "—"}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><CalendarClock size={17} /></span>
          <div><p className="font-semibold text-slate-900">{formatDateTime(item.startAt)}</p><p className="text-xs text-slate-500">{meetingProviderLabel(item.meetingProvider)} · {item.advisorName || "Unassigned"}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
        {canJoin ? <a href={item.meetingLink} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-3 text-sm font-semibold text-white"><Video size={15} /> Join</a> : <span />}
        <Link href={`/meetings/${item.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--gv-border)] bg-white px-3 text-sm font-semibold text-slate-700">Open <ChevronRight size={15} /></Link>
      </div>
    </article>
  );
}

export default function MeetingsTable() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("upcoming");

  useEffect(() => {
    if (!profile) return undefined;
    return subscribeMeetings(profile, (rows) => {
      setItems(rows);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError("Unable to load meetings. Deploy the required Firestore indexes and try again.");
      setLoading(false);
    });
  }, [profile]);

  const today = useMemo(() => new Date(), []);
  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: items.length,
      today: items.filter((item) => isSameDay(toDate(item.startAt), today) && !["cancelled"].includes(item.status)).length,
      upcoming: items.filter((item) => (toDate(item.startAt)?.getTime() || 0) > now && !["cancelled", "completed"].includes(item.status)).length,
      pendingMom: items.filter((item) => item.status === "completed" && !item.momId).length,
      completed: items.filter((item) => item.status === "completed").length
    };
  }, [items, today]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    return items.filter((item) => {
      const start = toDate(item.startAt);
      const matchesTerm = !term || [item.meetingCode, item.title, item.investorName, item.leadName, item.advisorName]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const matchesView = view === "all"
        || (view === "upcoming" && (start?.getTime() || 0) > now && !["completed", "cancelled"].includes(item.status))
        || (view === "today" && isSameDay(start, today) && item.status !== "cancelled")
        || (view === "completed" && item.status === "completed")
        || (view === "pending_mom" && item.status === "completed" && !item.momId)
        || (view === "cancelled" && item.status === "cancelled");
      return matchesTerm && matchesView;
    });
  }, [items, search, today, view]);

  const tabs = [
    { value: "upcoming", label: "Upcoming", count: stats.upcoming },
    { value: "today", label: "Today", count: stats.today },
    { value: "pending_mom", label: "MOM pending", count: stats.pendingMom },
    { value: "completed", label: "Completed", count: stats.completed },
    { value: "cancelled", label: "Cancelled" },
    { value: "all", label: "All", count: stats.total }
  ];

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading meetings…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>;

  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Upcoming" value={stats.upcoming} helper="Scheduled ahead" icon={CalendarClock} tone="blue" />
        <MetricCard label="Today" value={stats.today} helper="Client touchpoints" icon={CalendarCheck2} tone="cyan" />
        <MetricCard label="MOM pending" value={stats.pendingMom} helper="Needs documentation" icon={ClipboardList} tone={stats.pendingMom ? "amber" : "green"} />
        <MetricCard label="Completed" value={stats.completed} helper="Meeting history" icon={CheckCircle2} tone="green" />
      </section>

      <section className="grid gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <SegmentedTabs items={tabs} value={view} onChange={setView} ariaLabel="Meeting views" className="xl:max-w-[760px]" />
          <Link href="/meetings/create" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--gv-blue-strong)]"><CalendarPlus size={17} /> Schedule meeting</Link>
        </div>

        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClassName} pl-11`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search meeting, investor, lead or advisor" aria-label="Search meetings" />
        </div>
      </section>

      <div className="grid gap-3 lg:hidden">
        {filtered.map(mobileMeetingCard)}
        {!filtered.length ? <EmptyState title="No meetings found" description="Change the filter or schedule a new client meeting." /> : null}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--gv-border)] bg-white shadow-sm lg:block">
        <div className="gv-scrollbar overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Meeting</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Date &amp; time</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Advisor</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => <tr key={item.id} className="transition hover:bg-slate-50"><td className="px-5 py-4"><Link href={`/meetings/${item.id}`} className="font-bold text-slate-950 hover:text-blue-700">{item.title}</Link><p className="mt-1 text-xs text-slate-500">{item.meetingCode} · {meetingTypeLabel(item.meetingType)}</p></td><td className="px-5 py-4"><p className="font-semibold text-slate-800">{item.investorName || item.leadName || "Internal"}</p><p className="mt-1 text-xs text-slate-500">{item.clientCode || item.leadCode || "—"}</p></td><td className="px-5 py-4 font-semibold text-slate-700">{formatDateTime(item.startAt)}</td><td className="px-5 py-4 text-slate-700">{meetingProviderLabel(item.meetingProvider)}</td><td className="px-5 py-4 text-slate-700">{item.advisorName || "—"}</td><td className="px-5 py-4"><MeetingStatusBadge status={item.status} /></td><td className="px-5 py-4 text-right"><Link href={`/meetings/${item.id}`} aria-label={`Open ${item.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ChevronRight size={17} /></Link></td></tr>)}
              {!filtered.length ? <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-slate-500">No meetings match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
