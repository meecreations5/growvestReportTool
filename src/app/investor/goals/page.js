"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, SlidersHorizontal, Target, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { compactCurrency, goalDisplayStatus } from "@/lib/utils/reportPresentation";
import InvestorGoalCard from "@/components/investor/InvestorGoalCard";
import InvestorBucketListRequestPanel from "@/components/investor/InvestorBucketListRequestPanel";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { getInvestorAppData } from "@/services/investorAppService";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";
import { goalStatusTone, goalToneClasses, goalVisual } from "@/components/investor/goalVisuals";

const filters = ["All", "On Track", "Near Completion", "Attention Required", "Not Started", "Completed"];


function progressLabel(value) {
  const safe = Number(value || 0);
  if (safe > 0 && safe < 1) return "<1%";
  return `${Math.round(safe)}%`;
}

function MobileGoalsApp({ goals, filteredGoals, loading, error, filter, setFilter, search, setSearch, portfolioSnapshot }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeCount = goals.filter((goal) => String(goal.status || "").toLowerCase() !== "completed").length;
  const completedCount = goals.length - activeCount;
  const topFilters = ["All", "On Track", "Attention Required"];
  const showGoalTools = goals.length > 4 || Boolean(search.trim()) || filter !== "All";

  function goalRow(goal, index) {
    const name = goal.name || goal.goalName || "Bucket List goal";
    const current = Number(goal.currentAmount || goal.currentValue || 0);
    const target = Number(goal.targetAmount || 0);
    const progress = target > 0 ? Math.min(100, current / target * 100) : Number(goal.progress || 0);
    const status = goalDisplayStatus(goal);
    const tone = goalStatusTone(status);
    const toneClass = goalToneClasses(tone);
    const Icon = goalVisual(name);
    const href = goal.id || goal.goalId ? `/investor/goals/${encodeURIComponent(goal.id || goal.goalId)}` : "/investor/goals";
    return (
      <Link key={goal.id || goal.goalId || name} href={href} className={`block px-4 py-4 active:bg-[#F4F6F9] ${index ? "border-t border-slate-100" : ""}`}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#EAF0FF] text-[#1F4ED8]"><Icon size={21} strokeWidth={1.5} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3"><h2 className="line-clamp-1 font-heading text-[15px] font-bold text-[#0B0B0F]">{name}</h2><span className="shrink-0 text-[12px] font-bold text-[#0B0B0F]">{progressLabel(progress)}</span></div>
            <p className="gv-private-value mt-1 text-[11px] text-[#6B7280]">{formatCurrency(current)} of {formatCurrency(target)}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F4F6F9]"><div className="h-full rounded-full bg-[#1F4ED8]" style={{ width: `${Math.min(100, progress)}%`, minWidth: progress > 0 ? "2px" : 0 }} /></div>
            <div className="mt-2 flex items-center justify-between gap-3"><span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${toneClass.text}`}><span className={`h-1.5 w-1.5 rounded-full ${toneClass.dot}`} />{status}</span><span className="text-[10px] text-[#6B7280]">{goal.targetDate ? formatDate(goal.targetDate) : "Date to be planned"}</span></div>
          </div>
        </div>
      </Link>
    );
  }

  const totalCurrent = goals.reduce((sum, goal) => sum + Number(goal.currentAmount || goal.currentValue || 0), 0);
  const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
  const totalMonthly = goals.reduce((sum, goal) => sum + Number(goal.monthlyContribution || goal.monthlySip || 0), 0);
  const overallProgress = totalTarget > 0 ? Math.min(100, totalCurrent / totalTarget * 100) : 0;
  const dateMissingCount = goals.filter((goal) => !goal.targetDate && String(goal.status || "").toLowerCase() !== "completed").length;
  const criticalCount = goals.filter((goal) => goalStatusTone(goalDisplayStatus(goal)) === "red").length;
  const attentionCount = goals.filter((goal) => ["yellow", "red"].includes(goalStatusTone(goalDisplayStatus(goal)))).length;

  return (
    <div className="gv-mobile-app-stack md:hidden">
      {error ? <div className="rounded-[16px] border border-[#E53935]/20 bg-[#E53935]/5 p-4 text-xs font-semibold text-[#B42318]">{error}</div> : null}

      <section className="px-0.5 pt-1">
        <h1 className="font-heading text-[1.55rem] font-bold leading-none text-[#0B0B0F]">Your Bucket List</h1>
        <p className="mt-2 text-[12px] leading-5 text-[#6B7280]">Big goals. A brighter tomorrow. See how your wealth is moving toward the life you want.</p>
        <p className="mt-2 text-[10px] text-[#6B7280]">{activeCount} active · {completedCount} completed{portfolioSnapshot?.snapshotDate ? ` · Updated ${formatDate(portfolioSnapshot.snapshotDate)}` : ""}</p>
      </section>

      <InvestorBucketListRequestPanel />

      {goals.length ? (
        <section className="grid grid-cols-3 divide-x divide-slate-200 rounded-[16px] bg-[#F4F6F9] py-3.5">
          <div className="px-3"><p className="text-[10px] text-[#6B7280]">Goal corpus</p><p className="gv-private-value mt-1 truncate font-heading text-[13px] font-bold text-[#0B0B0F]">{compactCurrency(totalCurrent)}</p></div>
          <div className="px-3"><p className="text-[10px] text-[#6B7280]">Overall progress</p><p className="mt-1 font-heading text-[13px] font-bold text-[#1F4ED8]">{progressLabel(overallProgress)}</p></div>
          <div className="px-3"><p className="text-[10px] text-[#6B7280]">Monthly plan</p><p className="gv-private-value mt-1 truncate font-heading text-[13px] font-bold text-[#0B0B0F]">{compactCurrency(totalMonthly)}</p></div>
        </section>
      ) : null}

      {showGoalTools ? (
        <section className="space-y-2.5">
          <div className="flex gap-2"><label className="relative min-w-0 flex-1"><Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your goals" className="min-h-11 w-full rounded-[14px] border border-slate-200 bg-white pl-9 pr-3 text-[12px] font-medium text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" /></label><button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[14px] border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#6B7280]"><SlidersHorizontal size={16} strokeWidth={1.5} /> Filter</button></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{topFilters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-9 shrink-0 rounded-full px-3 text-[10px] font-semibold ${filter === item ? "bg-[#1F4ED8] text-white" : "border border-slate-200 bg-white text-[#6B7280]"}`}>{item === "Attention Required" ? "Attention" : item}</button>)}</div>
        </section>
      ) : goals.length > 1 ? (
        <div className="flex justify-end"><button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#6B7280]"><SlidersHorizontal size={15} strokeWidth={1.5} /> Filter</button></div>
      ) : null}

      {filtersOpen ? <div className="fixed inset-0 z-[95] md:hidden"><button type="button" className="absolute inset-0 bg-[#0B0B0F]/45" onClick={() => setFiltersOpen(false)} aria-label="Close goal filters" /><section className="gv-safe-bottom absolute inset-x-0 bottom-0 rounded-t-[30px] bg-white p-4 shadow-2xl"><div className="mx-auto h-1.5 w-11 rounded-full bg-slate-200" /><div className="mt-4 flex items-center justify-between"><div><h3 className="font-heading text-[1.15rem] font-bold text-[#0B0B0F]">Show goals by status</h3><p className="mt-1 text-[11px] text-[#6B7280]">Choose what you want to focus on.</p></div><button type="button" onClick={() => setFiltersOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-[#F4F6F9] text-[#6B7280]"><X size={18} strokeWidth={1.5} /></button></div><div className="mt-4 grid grid-cols-2 gap-2">{filters.map((item) => <button key={item} type="button" onClick={() => { setFilter(item); setFiltersOpen(false); }} className={`min-h-11 rounded-[14px] px-3 text-[11px] font-semibold ${filter === item ? "bg-[#1F4ED8] text-white" : "border border-slate-200 bg-white text-[#6B7280]"}`}>{item}</button>)}</div></section></div> : null}

      {loading ? <div className="space-y-3"><div className="gv-skeleton h-24 rounded-[18px]" /><div className="gv-skeleton h-24 rounded-[18px]" /><div className="gv-skeleton h-24 rounded-[18px]" /></div> : filteredGoals.length ? <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">{filteredGoals.map((goal, index) => goalRow(goal, index))}</section> : <MobileEmptyState icon={Target} title={goals.length ? "No matching goals" : "Your Bucket List starts here"} copy={goals.length ? "Try another search or goal filter." : "GrowVest will show your life goals here once they are defined and linked to your wealth plan."} />}

      {!loading && goals.length && (dateMissingCount || attentionCount || goals.length <= 2) ? (
        <section className={`flex items-start gap-3 rounded-[16px] border px-4 py-4 ${criticalCount ? "border-[#E53935]/25 bg-[#FFF0EF]" : dateMissingCount || attentionCount ? "border-[#F5B301]/35 bg-[#FFF8DF]" : "border-[#1F4ED8]/12 bg-[#EAF0FF]"}`}>
          <CalendarDays size={19} strokeWidth={1.5} className={`mt-0.5 shrink-0 ${criticalCount ? "text-[#E53935]" : dateMissingCount || attentionCount ? "text-[#8A5B00]" : "text-[#1F4ED8]"}`} />
          <div className="min-w-0">
            <p className="font-heading text-[14px] font-bold text-[#0B0B0F]">{criticalCount ? "A goal needs urgent review" : dateMissingCount ? `${dateMissingCount} goal${dateMissingCount > 1 ? "s need" : " needs"} a target date` : attentionCount ? "A goal needs planning attention" : "Keep building your Bucket List"}</p>
            <p className="mt-1 text-[11px] leading-[1.15rem] text-[#6B7280]">{criticalCount ? "Open the goal to review the issue with your GrowVest Partner." : dateMissingCount ? "A target date lets GrowVest measure whether your current monthly contribution is on track." : attentionCount ? "Open the goal to see what part of the plan needs review." : "As more goals are added, this page will compare progress and priorities in one place."}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function InvestorGoalsPage() {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [portfolioSnapshot, setPortfolioSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let active = true;
    async function loadGoals() {
      if (!profile?.investorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const payload = await getInvestorAppData("goals");
        if (!active) return;
        setInvestor(payload.investor ? { ...payload.investor, bucketList: payload.goals || [] } : null);
        setPortfolioSnapshot(payload.portfolio ? {
          snapshotDate: payload.portfolio.asOfDate || payload.portfolio.snapshotDate || "",
          goalTotals: payload.portfolio.goalTotals || []
        } : null);
      } catch (nextError) {
        console.error("Investor goals load failed", nextError);
        if (active) setError(nextError?.message || "Your Bucket List could not be loaded. Please refresh after a moment.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadGoals();
    return () => { active = false; };
  }, [profile?.investorId]);

  const goals = useMemo(() => {
    const sourceGoals = investor?.bucketList?.length ? investor.bucketList : investor?.goals || [];
    const liveTotals = new Map((portfolioSnapshot?.goalTotals || []).map((item) => [String(item.goalId || ""), item]));
    return sourceGoals.map((goal) => {
      const goalId = String(goal.id || goal.goalId || "");
      const live = liveTotals.get(goalId);
      if (!live) return goal;
      const currentAmount = Number(live.currentValue || 0);
      const monthlyContribution = Number(live.monthlyContribution || 0);
      const targetAmount = Number(goal.targetAmount || 0);
      return {
        ...goal,
        currentAmount,
        currentValue: currentAmount,
        monthlySip: monthlyContribution,
        monthlyContribution,
        progress: targetAmount > 0 ? currentAmount / targetAmount * 100 : 0
      };
    });
  }, [investor, portfolioSnapshot]);
  const filteredGoals = useMemo(() => goals.filter((goal) => {
    const text = `${goal.name || goal.goalName || ""} ${goal.category || ""} ${goal.description || ""}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "All") return true;
    const status = goalDisplayStatus(goal);
    if (filter === "On Track") return ["On Track", "SIP Running"].includes(status);
    return status === filter || String(goal.status || "").toLowerCase() === filter.toLowerCase();
  }), [filter, goals, search]);

  const completed = goals.filter((goal) => String(goal.status || "").toLowerCase() === "completed").length;
  const active = goals.length - completed;

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Your Bucket List" title="Goals that matter to you" description="Track the financial journeys created around your family, experiences and future priorities. Goal values are refreshed automatically from investments assigned by GrowVest." />
      <MobileGoalsApp goals={goals} filteredGoals={filteredGoals} loading={loading} error={error} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} portfolioSnapshot={portfolioSnapshot} />

      <div className="hidden gap-5 md:grid md:gap-6">
      <InvestorBucketListRequestPanel />
      {portfolioSnapshot ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1F4ED8]">Portfolio-linked progress</p><p className="mt-1 text-sm font-semibold text-[#0B0B0F]">Goal corpus is calculated from your latest verified portfolio assignments.</p></div>
        <div className="mt-3 text-left sm:mt-0 sm:text-right"><p className="font-heading text-lg font-bold text-emerald-950">{formatCurrency((portfolioSnapshot.goalTotals || []).reduce((sum, item) => sum + Number(item.currentValue || 0), 0))}</p><p className="mt-1 text-xs text-emerald-700">As of {formatDate(portfolioSnapshot.snapshotDate)}</p></div>
      </section> : null}

      <section className="grid grid-cols-3 gap-3">
        {[
          ["Total goals", goals.length],
          ["Active", active],
          ["Completed", completed]
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-[var(--gv-border)] bg-white p-4 text-center shadow-[var(--gv-shadow-card)]">
            <p className="font-heading text-2xl font-bold text-[var(--gv-ink)]">{loading ? "…" : value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-3 shadow-[var(--gv-shadow-card)] sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search goals" className="min-h-11 w-full rounded-xl border border-slate-200 bg-[var(--gv-surface)] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--gv-blue)] focus:bg-white" />
          </label>
          <div className="relative sm:hidden">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-600">
              {filters.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            {filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-10 rounded-full px-4 text-xs font-bold transition ${filter === item ? "bg-[var(--gv-blue)] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2"><div className="gv-skeleton h-64 rounded-2xl" /><div className="gv-skeleton h-64 rounded-2xl" /></div>
      ) : filteredGoals.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGoals.map((goal, index) => <InvestorGoalCard key={goal.id || `${goal.name || "goal"}-${index}`} goal={goal} />)}
        </section>
      ) : (
        <section className="grid place-items-center rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white px-6 py-16 text-center shadow-[var(--gv-shadow-card)]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Target size={24} /></span>
          <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">No matching goals</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Try a different filter. Goals added with your GrowVest Partner will appear here.</p>
        </section>
      )}
      </div>
    </div>
  );
}
