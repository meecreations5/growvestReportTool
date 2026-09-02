"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BellRing,
  CalendarClock,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Umbrella
} from "lucide-react";
import { getInsuranceProtectionSnapshot } from "@/services/insuranceService";
import { formatCurrency, formatDate } from "@/lib/utils/format";

function currency(value) {
  return formatCurrency(Number(value || 0));
}

function dueText(due) {
  if (!due?.date) return "No upcoming premium or renewal date";
  const timing = due.daysUntil === null || due.daysUntil === undefined
    ? ""
    : due.daysUntil < 0
      ? `${Math.abs(due.daysUntil)} day${Math.abs(due.daysUntil) === 1 ? "" : "s"} overdue`
      : due.daysUntil === 0
        ? "Due today"
        : `Due in ${due.daysUntil} day${due.daysUntil === 1 ? "" : "s"}`;
  return `${due.label || "Next due"} · ${formatDate(due.date)}${timing ? ` · ${timing}` : ""}`;
}

function Metric({ label, value, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700"
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone] || tones.blue}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold text-slate-950 tabular-nums">{value}</p>
    </div>
  );
}

export default function InvestorProtectionSnapshotCard({
  investorId,
  onOpenProtection,
  portal = false,
  compact = false,
  title = "Protection Snapshot"
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!investorId) {
      setSnapshot(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    getInsuranceProtectionSnapshot(investorId)
      .then((result) => { if (active) setSnapshot(result); })
      .catch((nextError) => { if (active) setError(nextError?.message || "Protection details could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [investorId]);

  const summary = snapshot?.summary || {};
  const metrics = [
    ["Active policies", summary.activePolicyCount || 0, ShieldCheck, "blue"],
    ["Life cover", currency(summary.lifeCover), Umbrella, "violet"],
    ["Health cover", currency(summary.healthCover), HeartPulse, "green"],
    ["Expiring ≤30 days", summary.policiesExpiringWithin30Days || 0, CalendarClock, "amber"],
    ["Premiums due ≤30 days", summary.premiumsDueWithin30Days || 0, BellRing, "amber"]
  ];

  const action = portal ? (
    <Link href="/investor/insurance" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100">
      View Insurance & Protection
    </Link>
  ) : onOpenProtection ? (
    <button type="button" onClick={onOpenProtection} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100">
      Manage Insurance & Protection
    </button>
  ) : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><ShieldCheck size={18} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Insurance & Protection</p>
              <h3 className="mt-0.5 font-heading text-lg font-bold text-slate-950">{title}</h3>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Protection cover is shown alongside wealth, but is never added to portfolio value, AUM or Bucket List corpus.</p>
        </div>
        {action}
      </div>

      {loading ? <div className="mt-4 flex min-h-20 items-center justify-center text-slate-400"><Loader2 size={20} className="animate-spin" /></div> : null}
      {!loading && error ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{error}</div> : null}
      {!loading && !error ? (
        <>
          <div className={`mt-4 grid gap-2.5 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"}`}>
            {metrics.map(([label, value, Icon, tone]) => <Metric key={label} label={label} value={value} icon={Icon} tone={tone} />)}
          </div>
          <div className={`mt-3 rounded-lg px-3 py-2.5 text-xs font-semibold ${summary.nextDue?.daysUntil !== null && summary.nextDue?.daysUntil !== undefined && summary.nextDue.daysUntil <= 30 ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600"}`}>
            {dueText(summary.nextDue)}
          </div>
        </>
      ) : null}
    </section>
  );
}
