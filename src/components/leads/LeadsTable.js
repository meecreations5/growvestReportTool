"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronRight, RotateCcw, Search } from "lucide-react";
import { setLeadArchived, subscribeLeads } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { calculateLeadTat } from "@/lib/utils/leadTat";
import { inputClassName } from "@/components/ui/Field";
import StatusBadge from "./StatusBadge";
import TatBadge from "./TatBadge";

export default function LeadsTable() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [tatState, setTatState] = useState("ALL");
  const [now, setNow] = useState(() => new Date());
  const [showArchived, setShowArchived] = useState(false);
  const [workingId, setWorkingId] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) return undefined;
    setLoading(true);
    return subscribeLeads(
      profile,
      (items) => {
        setLeads(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Unable to load leads. A Firestore composite index may be required.");
        setLoading(false);
      },
      { archived: showArchived }
    );
  }, [profile, showArchived]);

  const statuses = useMemo(() => ["ALL", ...new Set(leads.map((item) => item.status).filter(Boolean))], [leads]);
  const enriched = useMemo(() => leads.map((lead) => ({ ...lead, tat: calculateLeadTat(lead, now) })), [leads, now]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enriched.filter((lead) => {
      const matchesSearch = !term || [lead.leadCode, lead.fullName, lead.contactNo, lead.email, lead.assignedAdvisorName].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = status === "ALL" || lead.status === status;
      const matchesTat = tatState === "ALL" || lead.tat.state === tatState;
      return matchesSearch && matchesStatus && matchesTat;
    });
  }, [enriched, search, status, tatState]);


  async function handleArchiveToggle(lead) {
    setWorkingId(lead.id);
    setError("");
    try {
      await setLeadArchived(lead, !lead.isDeleted, profile);
    } catch (err) {
      console.error(err);
      setError(`Unable to ${lead.isDeleted ? "restore" : "archive"} the lead.`);
    } finally {
      setWorkingId("");
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading leads…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">{error}</div>;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_220px_200px_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by lead ID, name, contact or advisor" />
        </div>
        <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)}>
          {statuses.map((option) => <option key={option} value={option}>{option === "ALL" ? "All statuses" : option}</option>)}
        </select>
        <select className={inputClassName} value={tatState} onChange={(event) => setTatState(event.target.value)}>
          <option value="ALL">All TAT states</option>
          <option value="breached">TAT breached</option>
          <option value="on_track">On track</option>
          <option value="not_set">Deadline not set</option>
          <option value="complete">Completed</option>
        </select>
        {profile?.role !== "advisor" ? <button type="button" onClick={() => setShowArchived((value) => !value)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${showArchived ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{showArchived ? <RotateCcw size={17} /> : <Archive size={17} />} {showArchived ? "Show active" : "Show archived"}</button> : null}
      </div>

      <div className="gv-scrollbar overflow-x-auto">
        <table className="min-w-[1250px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-bold">Lead</th>
              <th className="px-5 py-3 font-bold">Contact</th>
              <th className="px-5 py-3 font-bold">Advisor</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold">TAT</th>
              <th className="px-5 py-3 font-bold">Service</th>
              <th className="px-5 py-3 text-right font-bold">Amount</th>
              <th className="px-5 py-3 font-bold">Follow-up</th>
              <th className="px-5 py-3 text-right font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((lead) => (
              <tr key={lead.id} className={`transition hover:bg-slate-50/80 ${lead.tat.isBreached ? "bg-red-50/40" : ""}`}>
                <td className="px-5 py-4">
                  <Link href={`/leads/${lead.id}`} className="group block">
                    <p className="font-bold text-slate-950 group-hover:text-blue-700">{lead.fullName}</p>
                    <p className="mt-1 text-xs text-slate-500">{lead.leadCode}</p>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-700">{lead.contactNo || "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">{lead.email || "—"}</p>
                </td>
                <td className="px-5 py-4 font-medium text-slate-700">{lead.assignedAdvisorName || "—"}</td>
                <td className="px-5 py-4"><StatusBadge status={lead.status} /></td>
                <td className="px-5 py-4">
                  <TatBadge state={lead.tat.state} />
                  <p className="mt-1 max-w-52 truncate text-xs text-slate-500" title={lead.tat.action}>{lead.tat.action}</p>
                </td>
                <td className="px-5 py-4 text-slate-700">{lead.serviceType || "—"}</td>
                <td className="px-5 py-4 text-right font-bold text-slate-950">{formatCurrency(lead.amount)}</td>
                <td className="px-5 py-4 text-slate-700">{formatDate(lead.followUpDue)}</td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {profile?.role !== "advisor" ? <button type="button" disabled={workingId === lead.id} onClick={() => handleArchiveToggle(lead)} aria-label={lead.isDeleted ? `Restore ${lead.fullName}` : `Archive ${lead.fullName}`} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-50 ${lead.isDeleted ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>{lead.isDeleted ? <RotateCcw size={16} /> : <Archive size={16} />}</button> : null}
                    <Link href={`/leads/${lead.id}`} aria-label={`Open ${lead.fullName}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                      <ChevronRight size={17} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr><td colSpan="9" className="px-5 py-12 text-center text-sm text-slate-500">No leads match the selected filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500">Showing {filtered.length} of {leads.length} {showArchived ? "archived" : "active"} leads</div>
    </div>
  );
}
