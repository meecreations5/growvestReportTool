"use client";

import { CheckCircle2, CircleAlert, Eye, FileBarChart, Target, WalletCards } from "lucide-react";
import ProgressNav from "@/components/ui/ProgressNav";
import { compactCurrency } from "@/lib/utils/reportPresentation";
import { getMonthLabel } from "@/lib/constants/report";

export default function ReportEditorSummary({ form, sections, activeId, onSelect }) {
  const complete = sections.filter((item) => item.complete).length;
  const percent = sections.length ? Math.round((complete / sections.length) * 100) : 0;
  const issues = sections.filter((item) => !item.complete).length;

  return (
    <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
      <ProgressNav
        items={sections}
        activeId={activeId}
        onSelect={onSelect}
        title="Report completion"
        description="Move through each section before completing and publishing the report."
      />

      <div className="gv-card overflow-hidden">
        <div className="border-b border-slate-200 bg-[var(--gv-ink)] p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Live summary</p>
          <p className="mt-2 font-heading text-xl font-bold">{form.investorName || "Investor not selected"}</p>
          <p className="mt-1 text-xs text-slate-300">{getMonthLabel(form.reportMonth)} {form.reportYear}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <WalletCards size={17} className="text-blue-700" />
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Portfolio</p>
            <p className="mt-1 font-heading text-lg font-bold text-slate-950">{compactCurrency(form.summary?.totalCorpus)}</p>
          </div>
          <div className="rounded-xl bg-cyan-50 p-3">
            <Target size={17} className="text-cyan-700" />
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Goals</p>
            <p className="mt-1 font-heading text-lg font-bold text-slate-950">{form.goals?.length || 0}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <FileBarChart size={17} className="text-emerald-700" />
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Funds</p>
            <p className="mt-1 font-heading text-lg font-bold text-slate-950">{form.funds?.length || 0}</p>
          </div>
          <div className={`rounded-xl p-3 ${issues ? "bg-amber-50" : "bg-emerald-50"}`}>
            {issues ? <CircleAlert size={17} className="text-amber-700" /> : <CheckCircle2 size={17} className="text-emerald-700" />}
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Ready</p>
            <p className={`mt-1 font-heading text-lg font-bold ${issues ? "text-amber-700" : "text-emerald-700"}`}>{percent}%</p>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{complete} of {sections.length} sections complete</span>
            <span>{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <button
            type="button"
            onClick={() => onSelect("report-summary")}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 hover:bg-blue-100"
          >
            <Eye size={16} /> Review headline data
          </button>
        </div>
      </div>
    </aside>
  );
}
