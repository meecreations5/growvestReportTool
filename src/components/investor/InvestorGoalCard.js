"use client";

import { CalendarDays, ChevronRight, Target } from "lucide-react";
import { compactCurrency, goalDisplayStatus, goalTone } from "@/lib/utils/reportPresentation";

const toneMap = {
  danger: {
    badge: "bg-red-50 text-red-700",
    bar: "bg-[var(--gv-danger)]",
    icon: "bg-red-50 text-red-700"
  },
  success: {
    badge: "bg-emerald-50 text-emerald-700",
    bar: "bg-[var(--gv-success)]",
    icon: "bg-emerald-50 text-emerald-700"
  },
  cyan: {
    badge: "bg-cyan-50 text-cyan-700",
    bar: "bg-[var(--gv-cyan)]",
    icon: "bg-cyan-50 text-cyan-700"
  },
  primary: {
    badge: "bg-blue-50 text-blue-700",
    bar: "bg-[var(--gv-blue)]",
    icon: "bg-blue-50 text-blue-700"
  },
  neutral: {
    badge: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
    icon: "bg-slate-100 text-slate-600"
  }
};

function goalProgress(goal) {
  const stored = Number(goal?.progress);
  if (Number.isFinite(stored) && stored >= 0) return Math.min(100, stored);
  const current = Number(goal?.currentAmount || goal?.currentValue || 0);
  const target = Number(goal?.targetAmount || 0);
  return target > 0 ? Math.min(100, (current / target) * 100) : 0;
}

export default function InvestorGoalCard({ goal, compact = false, onOpen }) {
  const tone = goalTone(goal);
  const colors = toneMap[tone] || toneMap.neutral;
  const progress = goalProgress(goal);
  const current = Number(goal?.currentAmount || goal?.currentValue || 0);
  const target = Number(goal?.targetAmount || 0);
  const monthly = Number(goal?.monthlySip || goal?.monthlyContribution || 0);
  const status = goalDisplayStatus({ ...goal, progress });
  const name = goal?.name || goal?.goalName || "Financial goal";

  return (
    <article className={`rounded-[var(--gv-radius-lg)] border bg-white shadow-[var(--gv-shadow-card)] ${goal?.isPrimary ? "border-blue-200" : "border-[var(--gv-border)]"} ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid shrink-0 place-items-center rounded-2xl ${compact ? "h-10 w-10" : "h-12 w-12"} ${colors.icon}`}>
            <Target size={compact ? 18 : 21} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`${compact ? "text-base" : "text-lg"} truncate font-heading font-bold text-[var(--gv-ink)]`}>{name}</h3>
              {goal?.isPrimary ? <span className="rounded-full bg-[var(--gv-blue)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Primary</span> : null}
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-[var(--gv-muted)]">{goal?.category || goal?.description || "Your Bucket List goal"}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${colors.badge}`}>{status}</span>
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Current</p>
            <p className="mt-1 font-heading text-xl font-bold text-[var(--gv-ink)]">{compactCurrency(current)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Target</p>
            <p className="mt-1 text-sm font-bold text-slate-600">{compactCurrency(target)}</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`${name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <strong className="text-[var(--gv-blue)]">{progress.toFixed(1)}%</strong>
          <span className="inline-flex items-center gap-1 text-slate-400"><CalendarDays size={13} /> {goal?.targetMonth ? `${goal.targetMonth} ${goal.targetYear || ""}` : goal?.targetYear || "Target date pending"}</span>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">Monthly contribution <strong className="text-slate-800">{monthly ? compactCurrency(monthly) : "Not set"}</strong></p>
          {onOpen ? <button type="button" onClick={() => onOpen(goal)} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--gv-blue)]">View details <ChevronRight size={15} /></button> : null}
        </div>
      ) : null}
    </article>
  );
}
