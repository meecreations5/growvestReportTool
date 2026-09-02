"use client";

import { formatCurrency, formatDate } from "@/lib/utils/format";
import { isStructuredWithdrawalAction } from "@/lib/constants/actions";

function sipLabel(value = "") {
  if (value === "pause") return "Pause SIP";
  if (value === "stop") return "Stop SIP";
  return "Continue SIP";
}

export default function WithdrawalActionSummary({ action, compact = false }) {
  if (!isStructuredWithdrawalAction(action)) return null;
  const items = action.withdrawalCompletion?.items?.length ? action.withdrawalCompletion.items : (action.withdrawalItems || []);
  const completed = action.status === "Completed" && action.financialImpactStatus === "confirmed";
  const before = Number(action.withdrawalCompletion?.beforePortfolioValue || 0);
  const after = Number(action.withdrawalCompletion?.afterPortfolioValue || 0);

  return (
    <div className={`mt-3 grid gap-3 rounded-xl border ${completed ? "border-emerald-200 bg-emerald-50/50" : "border-violet-200 bg-violet-50/40"} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-white px-2.5 py-1">Bucket List: <strong className="text-slate-900">{action.withdrawalBucketName || action.relatedGoalName || "General Wealth"}</strong></span>
        {action.withdrawalPurpose ? <span className="rounded-full bg-white px-2.5 py-1">Purpose: <strong className="text-slate-900">{action.withdrawalPurpose}</strong></span> : null}
        {action.requestedEffectiveDate ? <span className="rounded-full bg-white px-2.5 py-1">Planned: <strong className="text-slate-900">{formatDate(action.requestedEffectiveDate)}</strong></span> : null}
        {completed && action.actualFinancialDate ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">Completed {formatDate(action.actualFinancialDate)}</span> : null}
      </div>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div key={item.positionId || index} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{item.instrumentName || "Mutual Fund"}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{item.withdrawalMode === "full" ? "Complete withdrawal" : "Partial withdrawal"} · {sipLabel(item.sipInstruction)}</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(completed ? item.actualAmount : item.requestedAmount)}</p>
            </div>
            {Number(item.bucketPercentageAtRequest || 0) > 0 && Number(item.bucketPercentageAtRequest || 0) < 99.999 ? <p className="mt-2 text-[11px] text-amber-700">This fund was split across Bucket Lists. {Number(item.bucketPercentageAtRequest).toFixed(1)}% was mapped to this Bucket List when requested.</p> : null}
            {completed ? <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600"><span className="rounded bg-slate-100 px-2 py-1">Before {formatCurrency(item.beforeValue)}</span><span className="rounded bg-slate-100 px-2 py-1">After {formatCurrency(item.afterValue)}</span><span className="rounded bg-slate-100 px-2 py-1">SIP {formatCurrency(item.currentMonthlySip)}/month</span></div> : null}
          </div>
        ))}
      </div>
      {completed && (before || after) ? <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-3 text-center"><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Portfolio before</p><p className="mt-1 text-xs font-bold text-slate-800">{formatCurrency(before)}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Withdrawn</p><p className="mt-1 text-xs font-bold text-red-700">{formatCurrency(action.actualFinancialAmount)}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Portfolio after</p><p className="mt-1 text-xs font-bold text-emerald-700">{formatCurrency(after)}</p></div></div> : null}
    </div>
  );
}
