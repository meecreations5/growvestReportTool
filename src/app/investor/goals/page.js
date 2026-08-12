"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Search, SlidersHorizontal, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { goalDisplayStatus } from "@/lib/utils/reportPresentation";
import InvestorGoalCard from "@/components/investor/InvestorGoalCard";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { subscribeLatestPortfolioSnapshot } from "@/services/portfolioService";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const filters = ["All", "On Track", "Near Completion", "Attention Required", "Not Started", "Completed"];

export default function InvestorGoalsPage() {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [portfolioSnapshot, setPortfolioSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    async function loadGoals() {
      if (!profile?.investorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const snapshot = await getDoc(doc(db, "investors", profile.investorId));
        setInvestor(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      } catch (nextError) {
        console.error(nextError);
        setError("Your Bucket List could not be loaded. Please refresh after a moment.");
      } finally {
        setLoading(false);
      }
    }
    loadGoals();
  }, [profile?.investorId]);

  useEffect(() => {
    if (!profile?.investorId) return undefined;
    return subscribeLatestPortfolioSnapshot(
      profile.investorId,
      profile,
      setPortfolioSnapshot,
      (nextError) => console.error("Unable to load goal-linked portfolio values", nextError)
    );
  }, [profile]);

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

      {portfolioSnapshot ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Portfolio-linked progress</p><p className="mt-1 text-sm font-semibold text-emerald-950">Goal corpus is calculated from your latest verified portfolio assignments.</p></div>
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
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Try a different filter. Goals added by your Advisor will appear here.</p>
        </section>
      )}
    </div>
  );
}
