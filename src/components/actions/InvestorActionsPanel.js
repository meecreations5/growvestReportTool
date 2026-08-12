"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, Clock3, ListChecks, MessageCircleMore, Plus, Search, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { formatDate } from "@/lib/utils/format";
import { ACTION_SOURCE_LABELS, ACTION_TERMINAL_STATUSES } from "@/lib/constants/actions";
import { subscribeInvestorPortfolio } from "@/services/portfolioService";
import { subscribeInvestorActions, updateInvestorAction } from "@/services/actionService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import ActionStatusBadge from "@/components/actions/ActionStatusBadge";
import ActionRequestDialog from "@/components/actions/ActionRequestDialog";
import ActionTimeline from "@/components/actions/ActionTimeline";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Field, inputClassName } from "@/components/ui/Field";

function contextText(action = {}) {
  return action.relatedInvestmentName || action.relatedGoalName || action.sourceReportMonthKey || "General portfolio";
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

  useEffect(() => {
    if (!profile?.investorId) return;
    getDoc(doc(db, "investors", profile.investorId)).then((snapshot) => {
      setInvestor(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    }).catch((nextError) => {
      console.error(nextError);
      setError("Your investor profile could not be loaded.");
    });
  }, [profile?.investorId]);

  useEffect(() => {
    if (!profile?.investorId) return undefined;
    return subscribeInvestorPortfolio(profile.investorId, profile, setPositions, (nextError) => console.error("Unable to load portfolio for actions", nextError));
  }, [profile]);

  useEffect(() => {
    if (!profile?.investorId) return undefined;
    return subscribeInvestorActions(profile.investorId, profile, setActions, (nextError) => {
      console.error(nextError);
      setError("Your action requests could not be loaded.");
    });
  }, [profile]);

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
    if (filter === "open") return !ACTION_TERMINAL_STATUSES.includes(item.status);
    if (filter === "completed") return item.status === "Completed";
    if (filter === "decision") return ["Recommended", "Discussion Required", "Under Review"].includes(item.status) && item.investorDecision === "Pending Discussion";
    return true;
  }), [actions, filter, search]);

  const openCount = actions.filter((item) => !ACTION_TERMINAL_STATUSES.includes(item.status)).length;
  const completedCount = actions.filter((item) => item.status === "Completed").length;
  const decisionCount = actions.filter((item) => ["Recommended", "Discussion Required", "Under Review"].includes(item.status) && item.investorDecision === "Pending Discussion").length;

  async function respond(action, investorDecision, requestDiscussion = false) {
    setBusyId(action.id);
    setError("");
    setNotice("");
    try {
      await updateInvestorAction(action.id, { investorDecision, requestDiscussion, comment });
      setNotice(requestDiscussion ? "Your Advisor has been asked to discuss this action." : `Your decision was recorded as ${investorDecision}.`);
      setComment("");
      setSelectedId(action.id);
    } catch (nextError) {
      setError(nextError.message || "Unable to update the action.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-5 pb-24 lg:pb-0">
      <InvestorPageHeader eyebrow="Advisor follow-up" title="Actions & Requests" description="See recommendations, track progress and send requests to your GrowVest Advisor." action={<Button type="button" onClick={() => { setInitial({}); setDialogOpen(true); }}><Plus size={16} /> New Request</Button>} />

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
          const terminal = ACTION_TERMINAL_STATUSES.includes(action.status);
          const needsDecision = ["Recommended", "Under Review", "Discussion Required"].includes(action.status)
            && (action.investorDecision || "Pending Discussion") === "Pending Discussion";
          return <article key={action.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-lg font-bold text-slate-950">{action.title}</h2><ActionStatusBadge status={action.status} /></div><p className="mt-1 text-xs font-semibold text-blue-700">{action.requestType || action.recommendationType || "Portfolio Review"} · {contextText(action)}</p>{action.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{action.description}</p> : null}</div>
              <div className="shrink-0 text-left sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due</p><p className="mt-1 text-sm font-semibold text-slate-700">{action.dueDate ? formatDate(action.dueDate) : "Next review"}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4"><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Owner</p><p className="mt-1 text-xs font-bold text-slate-700">{action.owner || "Advisor"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Your decision</p><p className="mt-1 text-xs font-bold text-slate-700">{action.investorDecision || "Pending Discussion"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Source</p><p className="mt-1 text-xs font-bold text-slate-700">{ACTION_SOURCE_LABELS[action.sourceType] || "GrowVest"}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Reference</p><p className="mt-1 text-xs font-bold text-slate-700">{action.actionCode || "—"}</p></div></div>
            {!terminal ? <div className="mt-4 border-t border-slate-100 pt-4"><Field label="Optional comment"><textarea rows={2} className={inputClassName} value={selected ? comment : ""} onFocus={() => setSelectedId(action.id)} onChange={(event) => { setSelectedId(action.id); setComment(event.target.value); }} placeholder="Add a note for your Advisor" /></Field><div className="mt-3 flex flex-wrap gap-2">{needsDecision ? <><Button type="button" variant="secondary" disabled={busyId === action.id} onClick={() => respond(action, "Approved")}>Approve</Button><Button type="button" variant="secondary" disabled={busyId === action.id} onClick={() => respond(action, "Deferred")}>Defer</Button><Button type="button" variant="secondary" disabled={busyId === action.id} onClick={() => respond(action, "Rejected")}>Reject</Button></> : null}<Button type="button" disabled={busyId === action.id} onClick={() => respond(action, action.investorDecision || "Pending Discussion", true)}><MessageCircleMore size={15} /> Discuss</Button></div></div> : null}
            <details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-xs font-bold text-blue-700">View activity timeline</summary><div className="mt-3"><ActionTimeline actionId={action.id} /></div></details>
          </article>;
        }) : <EmptyState title="No action requests here" description={filter === "open" ? "Your open Advisor recommendations and requests will appear here." : "No actions match this view."} icon={ListChecks} />}
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-start gap-3"><Target size={18} className="mt-0.5 text-blue-700" /><div><p className="text-sm font-bold text-slate-950">Requests are discussion workflows</p><p className="mt-1 text-xs leading-5 text-slate-600">Sending or approving a request does not place, redeem or switch an investment automatically. Your Advisor will review suitability, documentation and consent before any external execution.</p></div></div></section>

      <ActionRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={() => setNotice("Your request was sent to your Advisor.")} investor={investor || { id: profile?.investorId, fullName: profile?.fullName }} positions={positions} initial={initial} />
    </div>
  );
}
