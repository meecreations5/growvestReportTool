"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CandlestickChart,
  Clock3,
  FileUp,
  Loader2,
  Settings2,
  UsersRound,
  WalletCards
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricCard from "@/components/ui/MetricCard";
import PageHeader from "@/components/ui/PageHeader";
import { ADMIN_ROLES } from "@/lib/constants/roles";
import {
  PORTFOLIO_RECONCILIATION_LABELS,
  PORTFOLIO_RECONCILIATION_STATUS,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import { formatCurrency } from "@/lib/utils/format";
import {
  getDailyPortfolioCoverage,
  getPortfolioReconciliation
} from "@/services/portfolioService";

function statusClasses(status) {
  if (status === PORTFOLIO_RECONCILIATION_STATUS.VERIFIED) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if ([PORTFOLIO_RECONCILIATION_STATUS.MISMATCH, PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT].includes(status)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

export default function PortfolioOverview() {
  const { profile } = useAuth();
  const [reconciliation, setReconciliation] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canAdminister = ADMIN_ROLES.includes(profile?.role);

  useEffect(() => {
    let active = true;
    if (!profile?.id) return () => { active = false; };
    setLoading(true);
    setError("");
    Promise.all([
      getPortfolioReconciliation(),
      getDailyPortfolioCoverage()
    ]).then(([reconciliationResult, coverageResult]) => {
      if (!active) return;
      setReconciliation(reconciliationResult);
      setCoverage(coverageResult);
    }).catch((nextError) => {
      if (active) setError(nextError?.message || "Unable to load Portfolio Overview.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [profile?.id, canAdminister]);

  const portfolioTotals = useMemo(() => (reconciliation?.rows || []).reduce((total, row) => {
    total.currentValue += Number(row.portfolioValue || 0);
    total.invested += Number(row.investedAmount || 0);
    total.gainLoss += Number(row.gainLoss || 0);
    return total;
  }, { currentValue: 0, invested: 0, gainLoss: 0 }), [reconciliation]);

  const sourceSummary = useMemo(() => {
    const map = new Map();
    (reconciliation?.rows || []).forEach((row) => {
      (row.sourceFreshness || []).forEach((source) => {
        const key = source.source || "other";
        const current = map.get(key) || { source: key, investorCount: 0, positionCount: 0, currentValue: 0, stale: 0 };
        current.investorCount += 1;
        current.positionCount += Number(source.positionCount || 0);
        current.currentValue += Number(source.currentValue || 0);
        if (["stale", "critical", "missing"].includes(source.freshnessStatus)) current.stale += 1;
        map.set(key, current);
      });
    });
    return [...map.values()].sort((left, right) => right.currentValue - left.currentValue);
  }, [reconciliation]);

  const exceptions = useMemo(() => (reconciliation?.rows || [])
    .filter((row) => row.reconciliationStatus !== PORTFOLIO_RECONCILIATION_STATUS.VERIFIED)
    .slice(0, 8), [reconciliation]);

  if (!profile) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div>;

  const summary = reconciliation?.summary || {};
  const staleCount = Number(summary.stale || 0) + Number(summary.missingSource || 0);

  return <div className="grid gap-6">
    <PageHeader eyebrow="Portfolio management" title="Portfolio Overview" description="A single operating view of current investor portfolios, daily update coverage and portfolio-health exceptions. Uploads happen in Daily Portfolio Update; destructive cleanup stays in Portfolio Administration." action={<><Link href="/portfolio/daily-update" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"><FileUp size={16} /> Daily Portfolio Update</Link>{canAdminister ? <Link href="/portfolio/administration" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Settings2 size={16} /> Portfolio Administration</Link> : null}</>} />

    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Investors With Portfolio" value={summary.investors ?? (loading ? "—" : 0)} helper={`${summary.verified || 0} verified`} icon={UsersRound} tone="blue" />
      <MetricCard label="Current Portfolio Value" value={loading && !reconciliation ? "—" : formatCurrency(portfolioTotals.currentValue)} helper={`Invested ${formatCurrency(portfolioTotals.invested)}`} icon={WalletCards} tone="blue" />
      <MetricCard label="Updated Today" value={coverage?.updatedCount ?? (loading ? "—" : 0)} helper={`${coverage?.missingCount || 0} Fundbazaar missing`} icon={BadgeCheck} tone={coverage?.missingCount ? "amber" : "green"} />
      <MetricCard label="Needs Portfolio Review" value={Number(summary.investors || 0) - Number(summary.verified || 0)} helper={`${staleCount} stale/missing · ${summary.mismatch || 0} mismatch`} icon={AlertTriangle} tone={Number(summary.investors || 0) - Number(summary.verified || 0) ? "amber" : "green"} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Portfolio health</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Exceptions needing staff attention</h2><p className="mt-1 text-sm text-slate-500">This is a health summary, not another workflow module. Resolve the underlying issue through Daily Portfolio Update or the investor's Portfolio Administration page.</p></div>{loading && !reconciliation ? <div className="grid min-h-52 place-items-center text-sm font-semibold text-slate-500"><Loader2 className="animate-spin" /></div> : exceptions.length ? <div className="divide-y divide-slate-100">{exceptions.map((row) => <div key={row.investorId} className="p-4 sm:p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="font-bold text-slate-950">{row.investorName}</p><p className="mt-0.5 text-xs text-slate-500">{row.clientCode || "No client code"} · {formatCurrency(row.portfolioValue)}</p></div><span className={`inline-flex self-start rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusClasses(row.reconciliationStatus)}`}>{PORTFOLIO_RECONCILIATION_LABELS[row.reconciliationStatus] || "Needs Review"}</span></div><p className="mt-2 text-xs leading-5 text-slate-600">{row.issues?.[0]?.description || `${row.issueCount || 0} portfolio issue(s) require review.`}</p><Link href={`/investors/${row.investorId}?tab=portfolio`} className="mt-2 inline-flex text-xs font-bold text-blue-700">Open Investor Portfolio →</Link></div>)}</div> : <div className="p-6"><EmptyState title="Portfolio health is clear" description="No current portfolio exceptions require staff attention." /></div>}</Card>

      <div className="grid gap-5">
        <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Daily coverage</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Fundbazaar today</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Expected</p><p className="mt-1 text-xl font-black text-slate-950">{coverage?.expectedCount ?? "—"}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Updated</p><p className="mt-1 text-xl font-black text-emerald-950">{coverage?.updatedCount ?? "—"}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-red-600">Missing</p><p className="mt-1 text-xl font-black text-red-950">{coverage?.missingCount ?? "—"}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Attention</p><p className="mt-1 text-xl font-black text-amber-950">{coverage?.attentionCount ?? "—"}</p></div></div><Link href="/portfolio/daily-update" className="mt-4 inline-flex text-sm font-bold text-blue-700">Open Daily Portfolio Update →</Link></Card>

        {canAdminister ? <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Trading / Intraday</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Separate activity</h2></div><CandlestickChart size={20} className="text-amber-700" /></div><p className="mt-4 font-heading text-2xl font-bold text-slate-950">Separate</p><p className="mt-1 text-xs leading-5 text-slate-500">Trading records are tracked separately and are not automatically included in Goal/Bucket corpus.</p></Card> : null}
      </div>
    </div>

    {sourceSummary.length ? <Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Source visibility</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Latest portfolio sources</h2></div><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{sourceSummary.map((source) => <div key={source.source} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-950">{PORTFOLIO_SOURCE_LABELS[source.source] || source.source}</p>{source.stale ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><Clock3 size={12} /> {source.stale} stale/missing</span> : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><BadgeCheck size={12} /> Current</span>}</div><p className="mt-3 font-heading text-xl font-bold text-slate-950">{formatCurrency(source.currentValue)}</p><p className="mt-1 text-xs text-slate-500">{source.positionCount} holding(s) across {source.investorCount} investor source record(s)</p></div>)}</div></Card> : null}

    {!loading && !reconciliation?.rows?.length ? <EmptyState title="No portfolio data yet" description="Use Daily Portfolio Update or the Manual Portfolio Excel on an investor profile to create the first portfolio records." /> : null}
  </div>;
}
