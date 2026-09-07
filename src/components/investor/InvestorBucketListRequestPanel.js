"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Home,
  Landmark,
  Plane,
  Plus,
  Send,
  Sparkles,
  Target,
  X
} from "lucide-react";
import {
  createBucketListRequest,
  getBucketListRequests
} from "@/services/bucketListRequestService";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const CATEGORIES = [
  "Home",
  "Travel",
  "Education",
  "Financial Freedom",
  "Vehicle",
  "Wedding",
  "Emergency Fund",
  "Other"
];

function categoryIcon(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("home")) return Home;
  if (value.includes("travel")) return Plane;
  if (value.includes("freedom") || value.includes("retire")) return Landmark;
  return Target;
}

function statusVisual(status) {
  const value = String(status || "").toLowerCase();
  if (value === "confirmed") return { label: "Confirmed", className: "bg-[#EAF0FF] text-[#1F4ED8]", icon: CheckCircle2 };
  if (value === "needs_information") return { label: "Needs your input", className: "bg-[#FFF3C4] text-[#7A5200]", icon: Sparkles };
  if (value === "declined") return { label: "Not proceeding", className: "bg-[#F4F6F9] text-[#6B7280]", icon: X };
  return { label: "Review with GrowVest", className: "bg-[#FFF8DF] text-[#7A5200]", icon: Clock3 };
}

function emptyForm() {
  return {
    goalName: "",
    category: "Home",
    targetAmount: "",
    targetDate: "",
    timeline: "",
    investorNote: ""
  };
}

function RequestRow({ item }) {
  const Icon = categoryIcon(item.category);
  const status = statusVisual(item.status);
  const StatusIcon = status.icon;
  return (
    <article className="flex items-start gap-3 border-t border-slate-100 px-4 py-3.5 first:border-t-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#EAF0FF] text-[#1F4ED8]">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[12px] font-bold text-[#0B0B0F]">{item.goalName || "Bucket List request"}</h3>
            <p className="mt-0.5 text-[10px] text-[#6B7280]">{item.category || "Goal"}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${status.className}`}>
            <StatusIcon size={11} strokeWidth={1.5} /> {status.label}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#6B7280]">
          {Number(item.targetAmount || 0) > 0 ? <span className="gv-private-value">Approx. {formatCurrency(item.targetAmount)}</span> : null}
          {item.targetDate ? <span>{formatDate(item.targetDate)}</span> : item.timeline ? <span>{item.timeline}</span> : null}
        </div>
        {item.status === "needs_information" ? <p className="mt-2 text-[10px] leading-4 text-[#7A5200]">GrowVest needs a little more information before this can become part of your active plan.</p> : null}
      </div>
    </article>
  );
}

export default function InvestorBucketListRequestPanel({ onRequestCreated }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getBucketListRequests();
      setRequests(Array.isArray(payload?.items) ? payload.items : []);
    } catch (nextError) {
      console.error("Bucket List requests load failed", nextError);
      setError(nextError?.message || "Unable to load your Bucket List requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleRequests = useMemo(() => requests.filter((item) => !["confirmed", "declined"].includes(String(item.status || "").toLowerCase())), [requests]);

  async function submit(event) {
    event.preventDefault();
    if (!form.goalName.trim()) {
      setError("Tell us what you would like to add to your Bucket List.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createBucketListRequest({
        goalName: form.goalName.trim(),
        category: form.category,
        targetAmount: form.targetAmount ? Number(form.targetAmount) : 0,
        targetDate: form.targetDate,
        timeline: form.timeline.trim(),
        investorNote: form.investorNote.trim()
      });
      setSuccess("Your Bucket List request has been sent to GrowVest for review.");
      setForm(emptyForm());
      setOpen(false);
      await load();
      onRequestCreated?.();
    } catch (nextError) {
      setError(nextError?.message || "Unable to send your Bucket List request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="rounded-[18px] border border-[#1F4ED8]/15 bg-[#F8FAFF] p-4 md:rounded-2xl md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1F4ED8]">Your life, your Bucket List</p>
            <h2 className="mt-1 font-heading text-[15px] font-bold text-[#0B0B0F] md:text-lg">Thinking about something new?</h2>
            <p className="mt-1 text-[11px] leading-[1.15rem] text-[#6B7280] md:text-sm md:leading-6">Share the goal with GrowVest. We will discuss it with you before it becomes part of your active financial plan.</p>
          </div>
          <button type="button" onClick={() => { setOpen(true); setError(""); setSuccess(""); }} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-[#1F4ED8] px-3 text-[11px] font-bold text-white shadow-sm md:px-4 md:text-sm">
            <Plus size={16} strokeWidth={1.6} /> Add
          </button>
        </div>

        {success ? <div className="mt-3 rounded-[12px] border border-[#1F4ED8]/15 bg-white px-3 py-2.5 text-[10px] font-semibold text-[#1F4ED8] md:text-xs">{success}</div> : null}
        {!open && error ? <div className="mt-3 rounded-[12px] border border-[#E53935]/20 bg-[#FFF0EF] px-3 py-2.5 text-[10px] font-semibold text-[#B42318] md:text-xs">{error}</div> : null}

        {loading ? <div className="gv-skeleton mt-3 h-16 rounded-[14px]" /> : visibleRequests.length ? (
          <div className="mt-3 overflow-hidden rounded-[14px] border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-[10px] font-bold text-[#0B0B0F]">With GrowVest for review</p>
              <span className="rounded-full bg-[#FFF8DF] px-2 py-1 text-[9px] font-bold text-[#7A5200]">{visibleRequests.length}</span>
            </div>
            {visibleRequests.map((item) => <RequestRow key={item.id} item={item} />)}
          </div>
        ) : null}
      </section>

      {open ? (
        <div className="fixed inset-0 z-[110] grid items-end md:place-items-center">
          <button type="button" aria-label="Close Bucket List form" className="absolute inset-0 bg-[#0B0B0F]/50 backdrop-blur-[1px]" onClick={() => !saving && setOpen(false)} />
          <section className="gv-safe-bottom relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-2xl md:max-w-xl md:rounded-[24px] md:p-6">
            <div className="mx-auto h-1.5 w-11 rounded-full bg-slate-200 md:hidden" />
            <div className="mt-4 flex items-start justify-between gap-4 md:mt-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1F4ED8]">Add to my Bucket List</p>
                <h2 className="mt-1 font-heading text-[1.2rem] font-bold text-[#0B0B0F]">What would you like life to include?</h2>
                <p className="mt-1 text-[11px] leading-5 text-[#6B7280]">An amount or date can be approximate. GrowVest will refine the goal with you before confirming it.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F4F6F9] text-[#6B7280]"><X size={18} strokeWidth={1.5} /></button>
            </div>

            <form onSubmit={submit} className="mt-5 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold text-[#0B0B0F]">What is on your Bucket List? *</span>
                <input value={form.goalName} onChange={(event) => setForm((current) => ({ ...current, goalName: event.target.value }))} placeholder="e.g. Buy a larger family home" maxLength={180} className="min-h-12 rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold text-[#0B0B0F]">Category</span>
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="min-h-12 rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] text-[#0B0B0F] outline-none focus:border-[#1F4ED8]">
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0B0B0F]"><CircleDollarSign size={14} strokeWidth={1.5} className="text-[#1F4ED8]" /> Approximate amount</span>
                  <input type="number" min="0" step="1000" value={form.targetAmount} onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))} placeholder="Optional" className="min-h-12 rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" />
                </label>
                <label className="grid gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0B0B0F]"><CalendarDays size={14} strokeWidth={1.5} className="text-[#1F4ED8]" /> Desired date</span>
                  <input type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} className="min-h-12 rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold text-[#0B0B0F]">Or tell us the timeline</span>
                <input value={form.timeline} onChange={(event) => setForm((current) => ({ ...current, timeline: event.target.value }))} placeholder="e.g. In the next 5 years" maxLength={120} className="min-h-12 rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold text-[#0B0B0F]">What does this goal mean to you?</span>
                <textarea value={form.investorNote} onChange={(event) => setForm((current) => ({ ...current, investorNote: event.target.value }))} rows={3} maxLength={2000} placeholder="Optional note for your GrowVest Partner" className="resize-none rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-[13px] leading-5 text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" />
              </label>

              {error ? <div className="rounded-[12px] border border-[#E53935]/20 bg-[#FFF0EF] px-3 py-2.5 text-[10px] font-semibold text-[#B42318]">{error}</div> : null}
              <div className="rounded-[14px] border border-[#F5B301]/30 bg-[#FFF8DF] px-3 py-3 text-[10px] leading-4 text-[#7A5200]">Submitting this does not change your active financial plan. Your GrowVest Partner will discuss the goal with you before confirming the target amount, date and contribution plan.</div>

              <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#1F4ED8] px-4 text-[12px] font-bold text-white disabled:opacity-60">
                <Send size={16} strokeWidth={1.6} /> {saving ? "Sending…" : "Submit to GrowVest"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
