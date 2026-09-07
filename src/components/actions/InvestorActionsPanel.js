"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Clock3, ListChecks, MessageCircleMore, Plus, Search, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { ACTION_SOURCE_LABELS, ACTION_TERMINAL_STATUSES, isActionOpen } from "@/lib/constants/actions";
import { getInvestorPortfolioView } from "@/services/portfolioService";
import { getInvestorActions, updateInvestorAction } from "@/services/actionService";
import { getInvestorAppData } from "@/services/investorAppService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import ActionStatusBadge from "@/components/actions/ActionStatusBadge";
import ActionRequestDialog from "@/components/actions/ActionRequestDialog";
import ActionTimeline from "@/components/actions/ActionTimeline";
import WithdrawalActionSummary from "@/components/actions/WithdrawalActionSummary";
import WithdrawalCashNeedsPanel from "@/components/actions/WithdrawalCashNeedsPanel";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Field, inputClassName } from "@/components/ui/Field";
import { GrowVestOutline, MobileEmptyState, MobileSectionHeading } from "@/components/investor/mobile/InvestorMobilePrimitives";

function contextText(action = {}) {
  return action.relatedInvestmentName || action.relatedGoalName || action.sourceReportMonthKey || "General portfolio";
}


function MobileActionsApp({ actions, visible, openCount, decisionCount, completedCount, search, setSearch, filter, setFilter, selectedId, setSelectedId, comment, setComment, busyId, respond, notice, error, onNewRequest }) {
  const [pendingDecision, setPendingDecision] = useState(null);

  async function confirmDecision() {
    if (!pendingDecision?.action || !pendingDecision?.decision) return;
    const { action, decision } = pendingDecision;
    setPendingDecision(null);
    await respond(action, decision);
  }

  return <div className="gv-mobile-app-stack md:hidden">
    <section className="relative overflow-hidden rounded-[26px] border border-[color-mix(in_srgb,var(--gv-blue)_14%,#dbe3ef)] bg-white p-4 shadow-[0_14px_38px_rgba(31,78,216,.08)]">
      <GrowVestOutline className="absolute -right-8 -top-7 w-32" opacity={0.055} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="gv-mobile-section-title text-[var(--gv-blue)]">Next steps</p>
          <h2 className="mt-1.5 font-heading text-[1.35rem] font-bold text-slate-950">Your actions</h2>
          <p className="mt-1 max-w-[250px] text-xs leading-5 text-slate-500">Clear decisions and follow-ups from your GrowVest wealth journey.</p>
        </div>
        <button type="button" onClick={onNewRequest} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gv-blue)] text-white shadow-[0_9px_20px_rgba(31,78,216,.2)]" aria-label="Create new request"><Plus size={19} /></button>
      </div>
      <div className="relative mt-4 grid grid-cols-3 overflow-hidden rounded-[18px] bg-slate-50">
        <div className="p-3 text-center"><p className="font-heading text-xl font-bold text-slate-950">{openCount}</p><p className="mt-0.5 text-[8px] font-black uppercase tracking-[.08em] text-slate-400">Open</p></div>
        <div className="border-x border-slate-200 p-3 text-center"><p className="font-heading text-xl font-bold text-amber-600">{decisionCount}</p><p className="mt-0.5 text-[8px] font-black uppercase tracking-[.08em] text-slate-400">Decision</p></div>
        <div className="p-3 text-center"><p className="font-heading text-xl font-bold text-emerald-600">{completedCount}</p><p className="mt-0.5 text-[8px] font-black uppercase tracking-[.08em] text-slate-400">Done</p></div>
      </div>
    </section>

    {notice ? <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} /> {notice}</div> : null}
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}

    <section className="gv-mobile-app-card p-3">
      <label className="relative block"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--gv-blue)] focus:bg-white" placeholder="Search actions" /></label>
      <div className="gv-mobile-segment mt-2 grid grid-cols-4 rounded-[16px] bg-slate-100 p-1">{[["open","Open"],["decision","Decision"],["completed","Done"],["all","All"]].map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 rounded-[12px] px-1 text-[9px] font-black ${filter === value ? 'bg-[var(--gv-blue)] text-white shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
    </section>

    <section>
      <MobileSectionHeading eyebrow="Action centre" title="What needs your attention" className="mb-3" />
      <div className="space-y-3">{visible.length ? visible.map((action) => {
        const selected = selectedId === action.id;
        const terminal = !isActionOpen(action);
        const needsDecision = ["Recommended", "Under Review", "Discussion Required"].includes(action.status) && (action.investorDecision || "Pending Discussion") === "Pending Discussion";
        return <article key={action.id} className="gv-mobile-app-card p-4">
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${needsDecision ? 'bg-amber-50 text-amber-700' : terminal ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]'}`}>{terminal ? <CheckCircle2 size={18} /> : needsDecision ? <Clock3 size={18} /> : <ListChecks size={18} />}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-1.5"><h4 className="min-w-0 flex-1 font-heading text-[.98rem] font-bold leading-5 text-slate-950">{action.title}</h4><ActionStatusBadge status={action.status} /></div>
              <p className="mt-1 text-[10px] font-bold text-[var(--gv-blue)]">{action.requestType || action.recommendationType || "Portfolio Review"}</p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{contextText(action)}</p>
            </div>
          </div>
          {action.description ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{action.description}</p> : null}
          <WithdrawalActionSummary action={action} />
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-[18px] bg-slate-50 p-3">
            <div><p className="text-[8px] font-black uppercase tracking-[.08em] text-slate-400">Due date</p><p className="mt-1 text-[10px] font-black text-slate-800">{action.dueDate ? formatDate(action.dueDate) : "Next review"}</p></div>
            <div className="border-l border-slate-200 pl-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-slate-400">Your status</p><p className="mt-1 line-clamp-2 text-[10px] font-black text-slate-800">{action.investorDecision || (needsDecision ? "Decision pending" : terminal ? "Completed" : "In progress")}</p></div>
          </div>
          {!terminal ? <details className="group mt-3 rounded-[18px] border border-slate-200 bg-white p-3 open:bg-slate-50/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-[var(--gv-blue)]"><span>{needsDecision ? "Review decision options" : "Respond to GrowVest"}</span><ChevronRight size={15} className="transition group-open:rotate-90" /></summary>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <textarea rows={2} value={selected ? comment : ""} onFocus={() => setSelectedId(action.id)} onChange={(event) => { setSelectedId(action.id); setComment(event.target.value); }} placeholder="Optional note for your GrowVest Partner" className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-[var(--gv-blue)]" />
              {needsDecision ? <div className="mt-2 grid grid-cols-3 gap-2"><button type="button" disabled={busyId === action.id} onClick={() => setPendingDecision({ action, decision: "Approved" })} className="min-h-10 rounded-xl bg-emerald-50 text-[10px] font-black text-emerald-700">Approve</button><button type="button" disabled={busyId === action.id} onClick={() => setPendingDecision({ action, decision: "Deferred" })} className="min-h-10 rounded-xl bg-amber-50 text-[10px] font-black text-amber-700">Defer</button><button type="button" disabled={busyId === action.id} onClick={() => setPendingDecision({ action, decision: "Rejected" })} className="min-h-10 rounded-xl bg-red-50 text-[10px] font-black text-red-700">Reject</button></div> : null}
              <button type="button" disabled={busyId === action.id} onClick={() => respond(action, action.investorDecision || "Pending Discussion", true)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] text-xs font-black text-white"><MessageCircleMore size={15} /> Discuss with GrowVest</button>
            </div>
          </details> : null}
          <details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-[10px] font-black text-slate-500">Activity timeline</summary><div className="mt-3"><ActionTimeline actionId={action.id} /></div></details>
        </article>;
      }) : <MobileEmptyState icon={ListChecks} title="No actions here" copy={filter === 'open' ? 'You are all caught up. New recommendations or requests will appear here.' : 'No actions match this view.'} />}</div>
    </section>

    <section className="rounded-[22px] border border-blue-100 bg-[var(--gv-blue-soft)] p-4"><div className="flex items-start gap-3"><Target size={17} className="mt-0.5 shrink-0 text-[var(--gv-blue)]" /><div><p className="text-xs font-black text-slate-950">You remain in control</p><p className="mt-1 text-[10px] leading-4 text-slate-600">Approving a request does not execute an investment automatically. GrowVest reviews suitability, documentation and consent before execution.</p></div></div></section>

    {pendingDecision ? <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/45 p-3 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Confirm decision">
      <div className="w-full rounded-[26px] bg-white p-5 shadow-2xl">
        <p className="gv-mobile-section-title text-[var(--gv-blue)]">Confirm your decision</p>
        <h3 className="mt-2 font-heading text-xl font-bold text-slate-950">{pendingDecision.decision === "Approved" ? "Approve this recommendation?" : pendingDecision.decision === "Deferred" ? "Defer this recommendation?" : "Reject this recommendation?"}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">This records your decision for GrowVest review. It does not place, redeem, switch or execute an investment.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPendingDecision(null)} className="min-h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700">Cancel</button>
          <button type="button" onClick={confirmDecision} className="min-h-12 rounded-2xl bg-[var(--gv-blue)] text-sm font-black text-white">Confirm</button>
        </div>
      </div>
    </div> : null}
  </div>;
}

export default function InvestorActionsPanel() {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [positions, setPositions] = useState([]);
  const [actions, setActions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initial, setInitial] = useState({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState("");
  const [comment, setComment] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function reloadActions() {
    if (!profile?.investorId) return;
    const nextActions = await getInvestorActions();
    setActions(nextActions);
  }

  useEffect(() => {
    if (!profile?.investorId) return undefined;
    let active = true;
    setError("");
    Promise.all([
      getInvestorAppData("profile"),
      getInvestorPortfolioView(),
      getInvestorActions()
    ]).then(([appPayload, portfolioPayload, actionRows]) => {
      if (!active) return;
      setInvestor(appPayload.investor ? { ...appPayload.investor, bucketList: appPayload.goals || appPayload.investor.bucketList || [] } : null);
      setPositions(portfolioPayload.positions || []);
      setActions(actionRows || []);
    }).catch((nextError) => {
      console.error(nextError);
      if (active) setError(nextError?.message || "Your action requests could not be loaded.");
    });
    return () => { active = false; };
  }, [profile?.investorId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    setInitial({
      requestType: params.get("requestType") || "Discuss Investment",
      relatedInvestmentId: params.get("positionId") || "",
      relatedInvestmentName: params.get("positionName") || "",
      relatedGoalId: params.get("goalId") || "",
      relatedGoalName: params.get("goalName") || ""
    });
    setDialogOpen(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const visible = useMemo(() => actions.filter((item) => {
    const text = `${item.title || ""} ${item.description || ""} ${item.requestType || ""} ${item.relatedInvestmentName || ""} ${item.relatedGoalName || ""}`.toLowerCase();
    if (!text.includes(search.trim().toLowerCase())) return false;
    if (filter === "open") return isActionOpen(item);
    if (filter === "completed") return item.status === "Completed";
    if (filter === "decision") return ["Recommended", "Discussion Required", "Under Review"].includes(item.status) && item.investorDecision === "Pending Discussion";
    return true;
  }), [actions, filter, search]);

  const openCount = actions.filter((item) => isActionOpen(item)).length;
  const completedCount = actions.filter((item) => item.status === "Completed").length;
  const decisionCount = actions.filter((item) => ["Recommended", "Discussion Required", "Under Review"].includes(item.status) && item.investorDecision === "Pending Discussion").length;

  async function respond(action, investorDecision, requestDiscussion = false) {
    setBusyId(action.id);
    setError("");
    setNotice("");
    try {
      await updateInvestorAction(action.id, { investorDecision, requestDiscussion, comment });
      setNotice(requestDiscussion ? "Your GrowVest Partner has been asked to discuss this action." : `Your decision was recorded as ${investorDecision}.`);
      setComment("");
      setSelectedId(action.id);
      await reloadActions().catch(() => {});
    } catch (nextError) {
      setError(nextError.message || "Unable to update the action.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <MobileActionsApp actions={actions} visible={visible} openCount={openCount} decisionCount={decisionCount} completedCount={completedCount} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} selectedId={selectedId} setSelectedId={setSelectedId} comment={comment} setComment={setComment} busyId={busyId} respond={respond} notice={notice} error={error} onNewRequest={() => { setInitial({}); setDialogOpen(true); }} />
      <div className="hidden gap-5 pb-24 md:grid lg:pb-0">
      <InvestorPageHeader eyebrow="Your actions" title="Actions & Requests" description="See recommendations, track progress and send requests to your GrowVest Partner." actions={<Button type="button" onClick={() => { setInitial({}); setDialogOpen(true); }}><Plus size={16} /> New Request</Button>} />

      {investor ? <WithdrawalCashNeedsPanel investor={investor} embedded /> : null}

      <section className="grid grid-cols-3 gap-3">
        {[["Open", openCount], ["Your decision", decisionCount], ["Completed", completedCount]].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"><p className="font-heading text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p></article>)}
      </section>

      {notice ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17} /> {notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" placeholder="Search actions" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"><option value="open">Open</option><option value="decision">Needs my decision</option><option value="completed">Completed</option><option value="all">All</option></select>
        </div>
      </section>

      <section className="grid gap-3">
        {visible.length ? visible.map((action) => {
          const selected = selectedId === action.id;
          const terminal = !isActionOpen(action);
          const needsDecision = ["Recommended", "Under Review", "Discussion Required"].includes(action.status)
            && (action.investorDecision || "Pending Discussion") === "Pending Discussion";
          return <article key={action.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-lg font-bold text-slate-950">{action.title}</h2><ActionStatusBadge status={action.status} /></div><p className="mt-1 text-xs font-semibold text-blue-700">{action.requestType || action.recommendationType || "Portfolio Review"} · {contextText(action)}</p>{action.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{action.description}</p> : null}<WithdrawalActionSummary action={action} />{Number(action.requestedAmount || 0) || Number(action.requestedMonthlyAmount || 0) || Number(action.requestedUnits || 0) || action.requestedEffectiveDate || action.requestedTargetGoalName || action.requestedAccountReference || action.requestedChangeDetails ? <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">{Number(action.requestedAmount || 0) ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Amount {formatCurrency(action.requestedAmount)}</span> : null}{Number(action.requestedMonthlyAmount || 0) ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Monthly {formatCurrency(action.requestedMonthlyAmount)}</span> : null}{Number(action.requestedUnits || 0) ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Units {Number(action.requestedUnits).toLocaleString("en-IN")}</span> : null}{action.requestedEffectiveDate ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Preferred {formatDate(action.requestedEffectiveDate)}</span> : null}{action.requestedTargetGoalName ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Target {action.requestedTargetGoalName}</span> : null}{action.requestedAccountReference ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Account {action.requestedAccountReference}</span> : null}{action.requestedChangeDetails ? <span className="w-full rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{action.requestedChangeDetails}</span> : null}</div> : null}</div>
              <div className="shrink-0 text-left sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due</p><p className="mt-1 text-sm font-semibold text-slate-700">{action.dueDate ? formatDate(action.dueDate) : "Next review"}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4"><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Owner</p><p className="mt-1 text-xs font-bold text-slate-700">{action.owner || "GrowVest"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Your decision</p><p className="mt-1 text-xs font-bold text-slate-700">{action.investorDecision || "Pending Discussion"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Source</p><p className="mt-1 text-xs font-bold text-slate-700">{ACTION_SOURCE_LABELS[action.sourceType] || "GrowVest"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Reference</p><p className="mt-1 text-xs font-bold text-slate-700">{action.actionCode || "—"}</p></div></div>
            {!terminal ? <div className="mt-4 border-t border-slate-100 pt-4"><Field label="Optional comment"><textarea rows={2} className={inputClassName} value={selected ? comment : ""} onFocus={() => setSelectedId(action.id)} onChange={(event) => { setSelectedId(action.id); setComment(event.target.value); }} placeholder="Add a note for your GrowVest Partner" /></Field><div className="mt-3 flex flex-wrap gap-2">{needsDecision ? <><Button type="button" variant="secondary" disabled={busyId === action.id} onClick={() => respond(action, "Approved")}>Approve</Button><Button type="button" variant="secondary" disabled={busyId === action.id} onClick={() => respond(action, "Deferred")}>Defer</Button><Button type="button" variant="secondary" disabled={busyId === action.id} onClick={() => respond(action, "Rejected")}>Reject</Button></> : null}<Button type="button" disabled={busyId === action.id} onClick={() => respond(action, action.investorDecision || "Pending Discussion", true)}><MessageCircleMore size={15} /> Discuss</Button></div></div> : null}
            <details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-xs font-bold text-blue-700">View activity timeline</summary><div className="mt-3"><ActionTimeline actionId={action.id} /></div></details>
          </article>;
        }) : <EmptyState title="No action requests here" description={filter === "open" ? "Your open GrowVest recommendations and requests will appear here." : "No actions match this view."} icon={ListChecks} />}
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-start gap-3"><Target size={18} className="mt-0.5 text-blue-700" /><div><p className="text-sm font-bold text-slate-950">Requests are discussion workflows</p><p className="mt-1 text-xs leading-5 text-slate-600">Sending or approving a request does not place, redeem or switch an investment automatically. Your GrowVest Partner will review suitability, documentation and consent before any external execution.</p></div></div></section>

      </div>
      <ActionRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={() => { setNotice("Your request was sent to GrowVest."); reloadActions().catch(() => {}); }} investor={investor || { id: profile?.investorId, fullName: profile?.fullName }} positions={positions} initial={initial} />
    </>
  );
}
