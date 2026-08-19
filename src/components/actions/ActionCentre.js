"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks, Plus, Search, UserRoundCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import { subscribeActionCentre, updateInvestorAction } from "@/services/actionService";
import { ACTION_PRIORITIES, ACTION_STATUSES, ACTION_TERMINAL_STATUSES, INVESTOR_DECISIONS } from "@/lib/constants/actions";
import { formatDate } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Field, inputClassName } from "@/components/ui/Field";
import ActionStatusBadge from "@/components/actions/ActionStatusBadge";
import ActionRequestDialog from "@/components/actions/ActionRequestDialog";
import ActionTimeline from "@/components/actions/ActionTimeline";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isOverdue(action) {
  return action.dueDate && action.dueDate < todayKey() && !ACTION_TERMINAL_STATUSES.includes(action.status);
}

function ActionEditor({ action, onSaved }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      status: action.status || "Requested",
      priority: action.priority || "Planned",
      investorDecision: action.investorDecision || "Pending Discussion",
      owner: action.owner || "Advisor",
      dueDate: action.dueDate || "",
      completionDate: action.completionDate || "",
      advisorResponse: action.advisorResponse || ""
    });
  }, [action]);

  function set(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function save() {
    setBusy(true); setError("");
    try {
      await updateInvestorAction(action.id, form);
      onSaved?.();
    } catch (nextError) {
      setError(nextError.message || "Unable to update the action.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 grid gap-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">{error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Status"><select className={inputClassName} value={form.status || ""} onChange={(event) => set("status", event.target.value)}>{ACTION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Priority"><select className={inputClassName} value={form.priority || ""} onChange={(event) => set("priority", event.target.value)}>{ACTION_PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Investor decision"><select className={inputClassName} value={form.investorDecision || ""} onChange={(event) => set("investorDecision", event.target.value)}>{INVESTOR_DECISIONS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Owner"><select className={inputClassName} value={form.owner || "Advisor"} onChange={(event) => set("owner", event.target.value)}><option>Advisor</option><option>Investor</option><option>GrowVest</option><option>Joint</option></select></Field><Field label="Due date"><input type="date" className={inputClassName} value={form.dueDate || ""} onChange={(event) => set("dueDate", event.target.value)} /></Field><Field label="Completion date"><input type="date" className={inputClassName} value={form.completionDate || ""} onChange={(event) => set("completionDate", event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Advisor response / update"><textarea rows={2} className={inputClassName} value={form.advisorResponse || ""} onChange={(event) => set("advisorResponse", event.target.value)} placeholder="Add a client-visible update or next step." /></Field></div></div><div className="flex justify-end"><Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Update"}</Button></div></div>;
}

export default function ActionCentre() {
  const { profile } = useAuth();
  const [actions, setActions] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [investorFilter, setInvestorFilter] = useState("all");
  const [createInvestorId, setCreateInvestorId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return undefined;
    return subscribeActionCentre(profile, setActions, (nextError) => { console.error(nextError); setError("Advisor follow-up could not be loaded."); });
  }, [profile]);

  useEffect(() => {
    if (!profile) return undefined;
    return subscribeInvestors(profile, (items) => {
      setInvestors(items);
      setCreateInvestorId((current) => current || items[0]?.id || "");
    }, (nextError) => console.error("Unable to load investors for actions", nextError));
  }, [profile]);

  const visible = useMemo(() => actions.filter((action) => {
    if (investorFilter !== "all" && action.investorId !== investorFilter) return false;
    if (status === "open" && ACTION_TERMINAL_STATUSES.includes(action.status)) return false;
    if (status === "overdue" && !isOverdue(action)) return false;
    if (status === "decision" && !(action.investorDecision === "Pending Discussion" && ["Recommended", "Under Review", "Discussion Required"].includes(action.status))) return false;
    if (status === "completed" && action.status !== "Completed") return false;
    const text = `${action.investorName || ""} ${action.title || ""} ${action.description || ""} ${action.requestType || ""} ${action.relatedInvestmentName || ""} ${action.relatedGoalName || ""}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }), [actions, investorFilter, search, status]);

  const openCount = actions.filter((item) => !ACTION_TERMINAL_STATUSES.includes(item.status)).length;
  const overdueCount = actions.filter(isOverdue).length;
  const decisionCount = actions.filter((item) => item.investorDecision === "Pending Discussion" && ["Recommended", "Under Review", "Discussion Required"].includes(item.status)).length;
  const completedCount = actions.filter((item) => item.status === "Completed").length;
  const createInvestor = investors.find((item) => item.id === createInvestorId) || null;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow="Advisor workflow" title="Advisor Follow-up" description="Turn portfolio recommendations and investor requests into accountable follow-up work with decisions, due dates and completion tracking." action={<div className="flex flex-wrap items-center gap-2"><select className="min-h-10 max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600" value={createInvestorId} onChange={(event) => setCreateInvestorId(event.target.value)}>{investors.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.clientCode || "Investor"}</option>)}</select><Button type="button" disabled={!createInvestor} onClick={() => setDialogOpen(true)}><Plus size={16} /> Create Follow-up</Button></div>} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Open actions", openCount, ListChecks, "text-blue-700 bg-blue-50"], ["Overdue", overdueCount, AlertTriangle, "text-red-700 bg-red-50"], ["Awaiting decision", decisionCount, UserRoundCheck, "text-amber-700 bg-amber-50"], ["Completed", completedCount, CheckCircle2, "text-emerald-700 bg-emerald-50"]].map(([label, value, Icon, tone]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4"><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon size={17} /></span><p className="mt-4 font-heading text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p></article>)}
      </section>

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px]">
          <label className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investor, action or investment" /></label>
          <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="overdue">Overdue</option><option value="decision">Awaiting decision</option><option value="completed">Completed</option><option value="all">All</option></select>
          <select className={inputClassName} value={investorFilter} onChange={(event) => setInvestorFilter(event.target.value)}><option value="all">All investors</option>{investors.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.clientCode}</option>)}</select>
        </div>
      </section>

      <section className="grid gap-3">
        {visible.length ? visible.map((action) => <article key={action.id} className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${isOverdue(action) ? "border-red-200" : "border-slate-200"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-lg font-bold text-slate-950">{action.title}</h2><ActionStatusBadge status={action.status} />{isOverdue(action) ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">Overdue</span> : null}</div><p className="mt-1 text-sm font-semibold text-blue-700">{action.investorName || "Investor"} · {action.requestType || action.recommendationType || "Portfolio Review"}</p>{action.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{action.description}</p> : null}</div>
            <div className="grid shrink-0 grid-cols-2 gap-3 text-left lg:min-w-[270px]"><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Due</p><p className="mt-1 text-sm font-semibold text-slate-700">{action.dueDate ? formatDate(action.dueDate) : "Next review"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Decision</p><p className="mt-1 text-sm font-semibold text-slate-700">{action.investorDecision || "Pending Discussion"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Priority</p><p className="mt-1 text-sm font-semibold text-slate-700">{action.priority || "Planned"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Reference</p><p className="mt-1 text-xs font-semibold text-slate-600">{action.actionCode || "—"}</p></div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">{action.relatedInvestmentName || action.relatedGoalName || action.sourceReportMonthKey || "General portfolio action"}</p><Button type="button" variant="secondary" onClick={() => setEditingId((current) => current === action.id ? "" : action.id)}>{editingId === action.id ? "Close" : "Manage"}</Button></div>
          {editingId === action.id ? <><ActionEditor action={action} onSaved={() => setNotice("Action updated successfully.")} /><details className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-bold text-blue-700">Audit timeline</summary><div className="mt-3"><ActionTimeline actionId={action.id} /></div></details></> : null}
        </article>) : <EmptyState title="No actions in this view" description="Investor requests and Advisor recommendations will appear here." icon={CalendarClock} />}
      </section>

      <ActionRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={() => setNotice("Investor action created successfully.")} investor={createInvestor} staff />
    </div>
  );
}
