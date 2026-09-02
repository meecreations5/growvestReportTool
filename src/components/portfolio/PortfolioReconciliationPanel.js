"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  Clock3,
  Layers3,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp
} from "lucide-react";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  PORTFOLIO_RECONCILIATION_LABELS,
  PORTFOLIO_RECONCILIATION_STATUS,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import { getPortfolioReconciliation } from "@/services/portfolioService";

function statusMeta(status = "") {
  const map = {
    [PORTFOLIO_RECONCILIATION_STATUS.VERIFIED]: ["bg-emerald-50 text-emerald-700 ring-emerald-200", ShieldCheck],
    [PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW]: ["bg-amber-50 text-amber-800 ring-amber-200", AlertTriangle],
    [PORTFOLIO_RECONCILIATION_STATUS.MISMATCH]: ["bg-red-50 text-red-700 ring-red-200", ShieldAlert],
    [PORTFOLIO_RECONCILIATION_STATUS.STALE]: ["bg-orange-50 text-orange-800 ring-orange-200", Clock3],
    [PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE]: ["bg-slate-100 text-slate-700 ring-slate-200", CircleAlert],
    [PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT]: ["bg-red-50 text-red-700 ring-red-200", ShieldAlert]
  };
  return map[status] || ["bg-slate-100 text-slate-700 ring-slate-200", CircleAlert];
}

function StatusBadge({ status }) {
  const [className, Icon] = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${className}`}>
      <Icon size={12} />
      {PORTFOLIO_RECONCILIATION_LABELS[status] || "Review"}
    </span>
  );
}

function freshnessLabel(item = {}) {
  if (!item.valuationDate) return "Date missing";
  if (item.ageDays === 0) return "Today";
  if (item.ageDays === null || item.ageDays === undefined) return formatDate(item.valuationDate);
  return `${item.ageDays} day${item.ageDays === 1 ? "" : "s"} old`;
}

function ReconciliationRow({ row }) {
  const [expanded, setExpanded] = useState(false);
  const sourceIssues = (row.sourceFreshness || []).filter((item) => ["stale", "critical", "missing"].includes(item.freshnessStatus));
  const primaryIssue = row.issues?.find((item) => item.severity === "block") || row.issues?.find((item) => item.severity === "warn") || row.issues?.[0] || null;

  return (
    <article className="border-t border-slate-100 first:border-t-0">
      <div className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-slate-950">{row.investorName}</p>
            {row.clientCode ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{row.clientCode}</span> : null}
            <StatusBadge status={row.reconciliationStatus} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {row.snapshotDate ? `Snapshot ${formatDate(row.snapshotDate)}` : "No verified portfolio snapshot"}
            {!row.intelligenceAvailable && row.snapshotId ? " · refreshes to full intelligence on the next portfolio snapshot" : ""}
          </p>
          {primaryIssue ? <p className="mt-2 text-xs font-semibold text-amber-800">{primaryIssue.title}: <span className="font-normal text-slate-600">{primaryIssue.description}</span></p> : null}
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Portfolio</p>
          <p className="mt-1 font-heading text-lg font-bold text-slate-950">{formatCurrency(row.portfolioValue)}</p>
          <p className="mt-1 text-xs text-slate-500">Gain/Loss {formatCurrency(row.gainLoss)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><p className="font-bold text-slate-900">{row.counts?.newHoldings || 0}</p><p className="text-slate-500">New</p></div>
          <div><p className="font-bold text-slate-900">{row.counts?.exitedHoldings || 0}</p><p className="text-slate-500">Exited</p></div>
          <div><p className="font-bold text-slate-900">{row.counts?.generalWealthHoldings || 0}</p><p className="text-slate-500">General Wealth</p></div>
          <div><p className={`font-bold ${row.issueCount ? "text-amber-700" : "text-emerald-700"}`}>{row.issueCount || 0}</p><p className="text-slate-500">Issues</p></div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700">
            <Layers3 size={13} /> {expanded ? "Hide" : "Review"}
          </button>
          <Link href={`/investors/${row.investorId}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100">
            Open Investor <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Largest Holding</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{row.concentration?.largestHolding?.instrumentName || "—"}</p>
              <p className="mt-1 text-xs text-slate-500">{row.concentration?.largestHolding ? `${row.concentration.largestHolding.percentage || 0}% · ${formatCurrency(row.concentration.largestHolding.currentValue)}` : "No concentration data"}</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Largest Asset Class</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{row.concentration?.largestAssetClass?.name || "—"}</p>
              <p className="mt-1 text-xs text-slate-500">{row.concentration?.largestAssetClass ? `${row.concentration.largestAssetClass.percentage || 0}% of portfolio` : "No allocation data"}</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Partial Exits</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{row.counts?.partialExits || 0}</p>
              <p className="mt-1 text-xs text-slate-500">Quantity reductions since previous snapshot</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Valuation Mismatches</p>
              <p className={`mt-1 text-sm font-bold ${row.counts?.valuationMismatches ? "text-red-700" : "text-emerald-700"}`}>{row.counts?.valuationMismatches || 0}</p>
              <p className="mt-1 text-xs text-slate-500">Units/quantity × NAV/rate check</p>
            </div>
          </div>

          {row.sourceFreshness?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {row.sourceFreshness.map((item) => {
                const attention = ["stale", "critical", "missing"].includes(item.freshnessStatus);
                return <span key={`${item.source}-${item.valuationDate}`} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${attention ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-white text-slate-600 ring-slate-200"}`}>{PORTFOLIO_SOURCE_LABELS[item.source] || item.sourceLabel || item.source}: {freshnessLabel(item)}</span>;
              })}
            </div>
          ) : null}

          {row.issues?.length ? (
            <div className="mt-3 grid gap-2">
              {row.issues.map((item, index) => (
                <div key={`${item.code}-${index}`} className={`rounded-lg border px-3 py-2 text-xs ${item.severity === "block" ? "border-red-200 bg-red-50 text-red-800" : item.severity === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800"}`}>
                  <strong>{item.title}</strong><span className="ml-1 font-normal">{item.description}</span>
                </div>
              ))}
            </div>
          ) : sourceIssues.length ? null : (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><BadgeCheck size={14} /> No reconciliation exceptions detected.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function PortfolioReconciliationPanel({ currentUser, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("exceptions");

  async function load() {
    if (!currentUser?.id) return;
    setLoading(true);
    setError("");
    try {
      const next = await getPortfolioReconciliation();
      setData(next);
      const exceptions = (next.rows || []).filter((item) => item.reconciliationStatus !== PORTFOLIO_RECONCILIATION_STATUS.VERIFIED);
      if (!exceptions.length && filter === "exceptions") setFilter("all");
    } catch (nextError) {
      setError(nextError.message || "Unable to load portfolio reconciliation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshKey]);

  const rows = useMemo(() => {
    const items = data?.rows || [];
    if (filter === "exceptions") return items.filter((item) => item.reconciliationStatus !== PORTFOLIO_RECONCILIATION_STATUS.VERIFIED);
    if (filter === "mismatch") return items.filter((item) => [PORTFOLIO_RECONCILIATION_STATUS.MISMATCH, PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT].includes(item.reconciliationStatus));
    if (filter === "stale") return items.filter((item) => [PORTFOLIO_RECONCILIATION_STATUS.STALE, PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE].includes(item.reconciliationStatus));
    if (filter === "review") return items.filter((item) => item.reconciliationStatus === PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW);
    return items;
  }, [data, filter]);

  const summary = data?.summary || {};
  const exceptionCount = Number(summary.investors || 0) - Number(summary.verified || 0);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-violet-700"><Layers3 size={16} /><p className="text-[11px] font-bold uppercase tracking-[0.14em]">Portfolio Intelligence</p></div>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Portfolio Reconciliation</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">GrowVest compares verified snapshots, transaction cash flows, units/NAV values, source freshness and persistent Goal/Bucket assignments. Staff review exceptions; investors continue to see a simplified portfolio view.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700 disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />} Refresh
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <MetricCard label="Investors" value={summary.investors ?? (loading ? "—" : 0)} helper="Portfolio records reviewed" icon={Layers3} tone="blue" />
          <MetricCard label="Verified" value={summary.verified ?? (loading ? "—" : 0)} helper="No action required" icon={ShieldCheck} tone="green" />
          <MetricCard label="Need Review" value={summary.needsReview ?? (loading ? "—" : 0)} helper="Cash flow / quantity review" icon={AlertTriangle} tone={summary.needsReview ? "amber" : "green"} />
          <MetricCard label="Stale / Missing" value={Number(summary.stale || 0) + Number(summary.missingSource || 0)} helper="Source freshness attention" icon={Clock3} tone={Number(summary.stale || 0) + Number(summary.missingSource || 0) ? "amber" : "green"} />
          <MetricCard label="Mismatch" value={summary.mismatch ?? (loading ? "—" : 0)} helper="Blocks trusted reconciliation" icon={ShieldAlert} tone={summary.mismatch ? "red" : "green"} />
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span><strong className="text-slate-900">{summary.newHoldings || 0}</strong> new holdings</span>
            <span><strong className="text-slate-900">{summary.exitedHoldings || 0}</strong> exited</span>
            <span><strong className="text-slate-900">{summary.generalWealthHoldings || 0}</strong> in General Wealth</span>
            <span><strong className={summary.issueCount ? "text-amber-700" : "text-emerald-700"}>{summary.issueCount || 0}</strong> actionable issues</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["exceptions", `Exceptions ${exceptionCount}`],
              ["mismatch", `Mismatch ${summary.mismatch || 0}`],
              ["review", `Review ${summary.needsReview || 0}`],
              ["stale", `Stale/Missing ${Number(summary.stale || 0) + Number(summary.missingSource || 0)}`],
              ["all", `All ${summary.investors || 0}`]
            ].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${filter === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{label}</button>)}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          {loading && !data ? <div className="p-8 text-center text-sm font-semibold text-slate-500"><Loader2 size={18} className="mx-auto mb-2 animate-spin" />Reconciling latest portfolio snapshots...</div> : null}
          {!loading && data && !rows.length ? <div className="p-8 text-center text-sm font-semibold text-emerald-700"><BadgeCheck size={18} className="mx-auto mb-2" />No portfolio exceptions in this view.</div> : null}
          {rows.map((row) => <ReconciliationRow key={row.investorId} row={row} />)}
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-900">
          <div className="flex items-start gap-2"><TrendingUp size={15} className="mt-0.5 shrink-0" /><p><strong>Concentration indicators are informational.</strong> GrowVest surfaces the largest holding, asset class and Goal/Bucket allocation to support review; it does not automatically label a portfolio suitable/unsuitable or execute rebalancing.</p></div>
          <div className="mt-2 flex items-start gap-2"><Target size={15} className="mt-0.5 shrink-0" /><p>Every holding has a persistent bucket assignment. New holdings default to General Wealth until staff deliberately links them to a specific Bucket List goal.</p></div>
        </div>
      </div>
    </Card>
  );
}
