"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageCircleMore,
  Target,
  XCircle
} from "lucide-react";
import {
  getBucketListRequests,
  reviewBucketListRequest
} from "@/services/bucketListRequestService";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const CATEGORIES = ["Home", "Travel", "Education", "Financial Freedom", "Vehicle", "Wedding", "Emergency Fund", "Other"];
const PRIORITIES = ["", "High", "Medium", "Low"];

function visual(status) {
  const value = String(status || "").toLowerCase();
  if (value === "confirmed") return { label: "Confirmed", className: "border-blue-200 bg-blue-50 text-blue-700" };
  if (value === "needs_information") return { label: "Needs investor input", className: "border-amber-200 bg-amber-50 text-amber-800" };
  if (value === "discussion_completed") return { label: "Discussion complete", className: "border-blue-200 bg-blue-50 text-blue-700" };
  if (value === "declined") return { label: "Not proceeding", className: "border-slate-200 bg-slate-50 text-slate-600" };
  if (value === "discussion_required") return { label: "Discussion required", className: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "New request", className: "border-blue-200 bg-blue-50 text-blue-700" };
}

function draftFor(item) {
  return {
    goalName: item.goalName || "",
    category: item.category || "Other",
    targetAmount: item.targetAmount ? String(item.targetAmount) : "",
    targetDate: item.targetDate || "",
    timeline: item.timeline || "",
    monthlyContribution: item.monthlyContribution ? String(item.monthlyContribution) : "",
    priority: item.priority || "",
    advisorNote: item.advisorNote || ""
  };
}

function RequestCard({ item, draft, setDraft, busy, onStatus }) {
  const status = visual(item.status);
  const isClosed = ["confirmed", "declined"].includes(String(item.status || "").toLowerCase());
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-bold text-slate-950">{item.goalName || "Bucket List request"}</h3>
            <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Submitted by {item.investorName || "Investor"}{item.submittedAt ? ` · ${formatDate(item.submittedAt)}` : ""}</p>
          {item.investorNote ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">Investor note:</span> {item.investorNote}</p> : null}
        </div>
        {Number(item.targetAmount || 0) > 0 ? <div className="shrink-0 text-left sm:text-right"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Approx. target</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{formatCurrency(item.targetAmount)}</p></div> : null}
      </div>

      {!isClosed ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-bold text-slate-700">Goal name</span>
            <input value={draft.goalName} onChange={(event) => setDraft({ ...draft, goalName: event.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700">Category</span>
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700">Priority</span>
            <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">{PRIORITIES.map((priority) => <option key={priority || "none"} value={priority}>{priority || "Not set"}</option>)}</select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700">Target amount</span>
            <input type="number" min="0" value={draft.targetAmount} onChange={(event) => setDraft({ ...draft, targetAmount: event.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700">Target date</span>
            <input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700">Monthly contribution</span>
            <input type="number" min="0" value={draft.monthlyContribution} onChange={(event) => setDraft({ ...draft, monthlyContribution: event.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700">Timeline note</span>
            <input value={draft.timeline} onChange={(event) => setDraft({ ...draft, timeline: event.target.value })} placeholder="e.g. Within 5 years" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className="text-xs font-bold text-slate-700">Advisor note</span>
            <textarea value={draft.advisorNote} onChange={(event) => setDraft({ ...draft, advisorNote: event.target.value })} rows={2} className="resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
        </div>
      ) : null}

      {!isClosed ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {String(item.status || "") !== "discussion_completed" ? <button type="button" disabled={busy} onClick={() => onStatus("discussion_completed")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-800 disabled:opacity-60"><MessageCircleMore size={15} /> Mark discussion complete</button> : null}
          <button type="button" disabled={busy} onClick={() => onStatus("needs_information")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-amber-800 disabled:opacity-60"><AlertCircle size={15} /> Needs investor input</button>
          <button type="button" disabled={busy || String(item.status || "") !== "discussion_completed"} title={String(item.status || "") !== "discussion_completed" ? "Mark discussion complete before confirming the goal." : "Confirm this goal"} onClick={() => onStatus("confirmed")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1F4ED8] px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 size={15} /> Confirm goal</button>
          <button type="button" disabled={busy} onClick={() => onStatus("declined")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 disabled:opacity-60"><XCircle size={15} /> Not proceeding</button>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><Clock3 size={14} /> Reviewed by {item.reviewedByName || "GrowVest"}{item.reviewedAt ? ` · ${formatDate(item.reviewedAt)}` : ""}</div>
      )}
    </article>
  );
}

export default function BucketListRequestReviewPanel({ investorId }) {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await getBucketListRequests(investorId);
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      setDrafts(Object.fromEntries(nextItems.map((item) => [item.id, draftFor(item)])));
    } catch (nextError) {
      console.error("GrowVest Bucket List request review load failed", nextError);
      setError(nextError?.message || "Unable to load investor Bucket List requests.");
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  const openItems = useMemo(() => items.filter((item) => !["confirmed", "declined"].includes(String(item.status || "").toLowerCase())), [items]);
  const historyItems = useMemo(() => items.filter((item) => ["confirmed", "declined"].includes(String(item.status || "").toLowerCase())).slice(0, 6), [items]);

  async function update(item, status) {
    const draft = drafts[item.id] || draftFor(item);
    setBusyId(item.id);
    setError("");
    setSuccess("");
    try {
      await reviewBucketListRequest(item.id, status, {
        ...draft,
        targetAmount: draft.targetAmount ? Number(draft.targetAmount) : 0,
        monthlyContribution: draft.monthlyContribution ? Number(draft.monthlyContribution) : 0
      });
      setSuccess(status === "confirmed" ? `${draft.goalName || item.goalName} is now part of the investor's active Bucket List.` : "Bucket List request updated.");
      await load();
    } catch (nextError) {
      setError(nextError?.message || "Unable to update the Bucket List request.");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <div className="gv-skeleton h-36 rounded-xl" />;
  if (!items.length) return null;

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">Investor-submitted Bucket List</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Review before it enters the financial plan</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Discuss the investor's request, refine the target amount and date, then confirm it. Unconfirmed requests are excluded from goal corpus, progress and investment allocation.</p>
        </div>
        <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-blue-700"><Target size={14} /> {openItems.length} open</span>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {success ? <div className="mt-4 rounded-lg border border-blue-200 bg-white p-3 text-sm font-semibold text-blue-700">{success}</div> : null}

      <div className="mt-4 grid gap-3">
        {openItems.map((item) => (
          <RequestCard
            key={item.id}
            item={item}
            draft={drafts[item.id] || draftFor(item)}
            setDraft={(next) => setDrafts((current) => ({ ...current, [item.id]: next }))}
            busy={busyId === item.id}
            onStatus={(status) => update(item, status)}
          />
        ))}
        {!openItems.length ? <div className="rounded-lg border border-blue-100 bg-white p-4 text-sm text-slate-600">No Bucket List requests currently need review.</div> : null}
      </div>

      {historyItems.length ? (
        <details className="mt-4 rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">Recently reviewed requests ({historyItems.length})</summary>
          <div className="border-t border-slate-100">{historyItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0"><div><p className="text-sm font-semibold text-slate-800">{item.goalName}</p><p className="mt-0.5 text-xs text-slate-500">{item.category}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${visual(item.status).className}`}>{visual(item.status).label}</span></div>)}</div>
        </details>
      ) : null}
    </section>
  );
}
