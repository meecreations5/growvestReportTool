"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  FilePenLine,
  Search,
  SquareCheckBig
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeMoms } from "@/services/momService";
import { inputClassName } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils/format";
import MetricCard from "@/components/ui/MetricCard";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import EmptyState from "@/components/ui/EmptyState";

function StatusBadge({ status }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status || "draft"}</span>;
}

function MomMobileCard({ item }) {
  const openActions = (item.actionItems || []).filter((action) => !["completed", "cancelled"].includes(action.status)).length;
  return (
    <article className="gv-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0"><p className="truncate font-heading text-lg font-bold text-slate-950">{item.meetingTitle}</p><p className="mt-1 text-xs text-slate-500">{item.momCode} · {formatDate(item.meetingDate)}</p></div>
        <StatusBadge status={item.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Client</p><p className="mt-1 font-semibold text-slate-900">{item.investorName || item.leadName || "Internal"}</p><p className="text-xs text-slate-500">{item.clientCode || item.leadCode || "—"}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Open actions</p><p className={`mt-1 text-xl font-bold ${openActions ? "text-amber-700" : "text-emerald-700"}`}>{openActions}</p><p className="text-xs text-slate-500">{item.investorVisible ? "Investor visible" : "Internal only"}</p></div>
      </div>
      <div className="border-t border-slate-100 p-3"><Link href={`/mom/${item.id}`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">Open MOM <ChevronRight size={15} /></Link></div>
    </article>
  );
}

export default function MomsTable() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");

  useEffect(() => {
    if (!profile) return undefined;
    return subscribeMoms(profile, (rows) => {
      setItems(rows);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError("Unable to load MOMs. Deploy the required Firestore indexes and try again.");
      setLoading(false);
    });
  }, [profile]);

  const stats = useMemo(() => ({
    total: items.length,
    completed: items.filter((item) => item.status === "completed").length,
    drafts: items.filter((item) => item.status !== "completed").length,
    openActions: items.reduce((sum, item) => sum + (item.actionItems || []).filter((action) => !["completed", "cancelled"].includes(action.status)).length, 0),
    published: items.filter((item) => item.status === "completed" && item.investorVisible).length
  }), [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTerm = !term || [item.momCode, item.meetingTitle, item.investorName, item.leadName, item.advisorName]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const openActions = (item.actionItems || []).some((action) => !["completed", "cancelled"].includes(action.status));
      const matchesView = view === "all"
        || (view === "draft" && item.status !== "completed")
        || (view === "completed" && item.status === "completed")
        || (view === "open_actions" && openActions)
        || (view === "published" && item.status === "completed" && item.investorVisible);
      return matchesTerm && matchesView;
    });
  }, [items, search, view]);

  const tabs = [
    { value: "all", label: "All", count: stats.total },
    { value: "draft", label: "Drafts", count: stats.drafts },
    { value: "completed", label: "Completed", count: stats.completed },
    { value: "open_actions", label: "Open actions", count: stats.openActions },
    { value: "published", label: "Investor visible", count: stats.published }
  ];

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading MOMs…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>;

  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Completed" value={stats.completed} helper="Finalised meeting records" icon={CheckCircle2} tone="green" />
        <MetricCard label="Drafts" value={stats.drafts} helper="Needs completion" icon={FilePenLine} tone={stats.drafts ? "amber" : "green"} />
        <MetricCard label="Open actions" value={stats.openActions} helper="Pending commitments" icon={SquareCheckBig} tone={stats.openActions ? "amber" : "green"} />
        <MetricCard label="Investor visible" value={stats.published} helper="Client-safe summaries" icon={Eye} tone="blue" />
      </section>

      <section className="grid gap-3">
        <SegmentedTabs items={tabs} value={view} onChange={setView} ariaLabel="MOM views" />
        <div className="relative"><Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-11`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search MOM, client or advisor" aria-label="Search minutes of meeting" /></div>
      </section>

      <div className="grid gap-3 lg:hidden">
        {filtered.map((item) => <MomMobileCard key={item.id} item={item} />)}
        {!filtered.length ? <EmptyState icon={ClipboardCheck} title="No MOM records found" description="Complete a meeting and create its minutes, decisions and action items." /> : null}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--gv-border)] bg-white shadow-sm lg:block">
        <div className="gv-scrollbar overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">MOM</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Meeting date</th><th className="px-5 py-3">Advisor</th><th className="px-5 py-3">Open actions</th><th className="px-5 py-3">Visibility</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Open</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const openActions = (item.actionItems || []).filter((action) => !["completed", "cancelled"].includes(action.status)).length;
                return <tr key={item.id} className="transition hover:bg-slate-50"><td className="px-5 py-4"><Link href={`/mom/${item.id}`} className="font-bold text-slate-950 hover:text-blue-700">{item.meetingTitle}</Link><p className="mt-1 text-xs text-slate-500">{item.momCode}</p></td><td className="px-5 py-4"><p className="font-semibold text-slate-800">{item.investorName || item.leadName || "Internal"}</p><p className="mt-1 text-xs text-slate-500">{item.clientCode || item.leadCode || "—"}</p></td><td className="px-5 py-4 text-slate-700">{formatDate(item.meetingDate)}</td><td className="px-5 py-4 text-slate-700">{item.advisorName || "—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${openActions ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{openActions}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.investorVisible ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{item.investorVisible ? "Investor" : "Internal"}</span></td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4 text-right"><Link href={`/mom/${item.id}`} aria-label={`Open ${item.meetingTitle}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ChevronRight size={17} /></Link></td></tr>;
              })}
              {!filtered.length ? <tr><td colSpan="8" className="px-5 py-12 text-center text-sm text-slate-500">No MOMs match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
