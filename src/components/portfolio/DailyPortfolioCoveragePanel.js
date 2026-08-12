"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  CirclePause,
  RefreshCcw,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/utils/format";
import { getDailyPortfolioCoverage, setDailyPortfolioTracking } from "@/services/portfolioService";

function displayDate(dateKey = "") {
  if (!dateKey) return "Today";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function displayDateTime(value = "") {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function statusBadge(row = {}) {
  if (row.status === "updated_attention") return ["Updated · review issue", "bg-amber-50 text-amber-800 ring-amber-200", AlertTriangle];
  if (row.status === "updated") return ["Updated today", "bg-emerald-50 text-emerald-700 ring-emerald-200", CheckCircle2];
  if (row.status === "attention") return ["Needs attention", "bg-amber-50 text-amber-800 ring-amber-200", AlertTriangle];
  if (row.status === "received_duplicate") return ["Received · duplicate", "bg-blue-50 text-blue-700 ring-blue-200", ShieldCheck];
  if (row.status === "received") return ["Received", "bg-blue-50 text-blue-700 ring-blue-200", CheckCircle2];
  if (row.status === "paused") return ["Tracking paused", "bg-slate-100 text-slate-600 ring-slate-200", CirclePause];
  return ["Missing today", "bg-red-50 text-red-700 ring-red-200", Clock3];
}

function CoverageRow({ row, canManage, onToggle, busyInvestorId }) {
  const [label, badgeClass, Icon] = statusBadge(row);
  const staleLabel = row.staleDays === null || row.staleDays === undefined
    ? "No successful portfolio update yet"
    : row.staleDays === 0
      ? "Current today"
      : `${row.staleDays} day${row.staleDays === 1 ? "" : "s"} since last portfolio snapshot`;

  return (
    <div className="grid gap-3 border-t border-slate-100 px-4 py-4 first:border-t-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-slate-950">{row.investorName}</p>
          {row.clientCode ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{row.clientCode}</span> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">{row.externalClientName ? `Fundbazaar: ${row.externalClientName}` : "Verified Fundbazaar mapping"}</p>
      </div>

      <div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${badgeClass}`}><Icon size={12} />{label}</span>
        <p className="mt-1.5 text-xs text-slate-500">{row.todayFileName || staleLabel}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700">Portfolio retained: {formatCurrency(row.portfolioValue || 0)}</p>
        <p className={`mt-1 text-xs ${Number(row.staleDays || 0) >= 2 ? "font-semibold text-amber-700" : "text-slate-500"}`}>
          Last Fundbazaar update: {row.lastSourceDate || "—"} · {staleLabel}
        </p>
        {row.lastSuccessfulImportAt ? <p className="mt-1 text-[11px] text-slate-400">Last successful import: {displayDateTime(row.lastSuccessfulImportAt)}</p> : null}
      </div>

      {canManage ? (
        <button
          type="button"
          disabled={busyInvestorId === row.investorId}
          onClick={() => onToggle(row)}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:opacity-50"
        >
          {busyInvestorId === row.investorId ? <Loader2 size={13} className="animate-spin" /> : row.coverageEnabled ? <CirclePause size={13} /> : <RefreshCcw size={13} />}
          {row.coverageEnabled ? "Pause" : "Resume"}
        </button>
      ) : null}
    </div>
  );
}

export default function DailyPortfolioCoveragePanel({ currentUser, refreshKey = 0 }) {
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("exceptions");
  const [busyInvestorId, setBusyInvestorId] = useState("");
  const canManage = ["super_admin", "admin"].includes(currentUser?.role);

  async function loadCoverage() {
    if (!currentUser?.id) return;
    setLoading(true);
    setError("");
    try {
      const next = await getDailyPortfolioCoverage();
      setCoverage(next);
      if (!next.missingCount && !next.attentionCount && filter === "exceptions") setFilter("all");
    } catch (nextError) {
      setError(nextError.message || "Unable to load today's portfolio coverage.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshKey]);

  const visibleRows = useMemo(() => {
    if (!coverage) return [];
    if (filter === "missing") return coverage.rows.filter((item) => item.status === "missing");
    if (filter === "attention") return coverage.rows.filter((item) => ["attention", "updated_attention"].includes(item.status));
    if (filter === "paused") return coverage.paused || [];
    if (filter === "exceptions") return coverage.rows.filter((item) => ["missing", "attention", "updated_attention"].includes(item.status));
    return coverage.rows;
  }, [coverage, filter]);

  async function toggleTracking(row) {
    setBusyInvestorId(row.investorId);
    setError("");
    try {
      await setDailyPortfolioTracking(row.investorId, !row.coverageEnabled);
      await loadCoverage();
    } catch (nextError) {
      setError(nextError.message || "Unable to update daily tracking.");
    } finally {
      setBusyInvestorId("");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><CalendarDays size={16} /><p className="text-[11px] font-bold uppercase tracking-[0.14em]">Daily Coverage</p></div>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Fundbazaar portfolio coverage · {displayDate(coverage?.dateKey)}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Expected investors come from verified Fundbazaar mappings. A missing file never clears the investor portfolio; GrowVest retains the latest verified value and shows how stale the source is.</p>
          </div>
          <button type="button" onClick={loadCoverage} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700 disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />} Refresh
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Expected" value={coverage?.expectedCount ?? (loading ? "—" : 0)} helper={`${coverage?.pausedCount || 0} paused`} icon={UsersRound} tone="blue" />
          <MetricCard label="Received" value={coverage?.receivedCount ?? (loading ? "—" : 0)} helper={`${coverage?.completionPercentage ?? 0}% coverage`} icon={CheckCircle2} tone="green" />
          <MetricCard label="Updated" value={coverage?.updatedCount ?? (loading ? "—" : 0)} helper="Applied to Portfolio Master" icon={ShieldCheck} tone="green" />
          <MetricCard label="Need Attention" value={coverage?.attentionCount ?? (loading ? "—" : 0)} helper={coverage?.unmatchedIssues?.length ? `${coverage.unmatchedIssues.length} unmatched file(s)` : "Review exceptions"} icon={AlertTriangle} tone={coverage?.attentionCount ? "amber" : "green"} />
          <MetricCard label="Missing" value={coverage?.missingCount ?? (loading ? "—" : 0)} helper="Latest portfolio retained" icon={Clock3} tone={coverage?.missingCount ? "amber" : "green"} />
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Primary daily source</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">Fundbazaar · Portfolio Ledger</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["exceptions", `Exceptions ${(coverage?.missingCount || 0) + (coverage?.attentionCount || 0)}`],
              ["missing", `Missing ${coverage?.missingCount || 0}`],
              ["attention", `Attention ${coverage?.attentionCount || 0}`],
              ["all", `All ${coverage?.expectedCount || 0}`],
              ["paused", `Paused ${coverage?.pausedCount || 0}`]
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${filter === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{label}</button>
            ))}
          </div>
        </div>

        {coverage?.unmatchedIssues?.length && ["exceptions", "attention"].includes(filter) ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Unmatched files requiring review</p>
            <div className="mt-2 grid gap-2">
              {coverage.unmatchedIssues.slice(0, 10).map((item) => (
                <div key={item.fileId} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                  <strong>{item.fileName}</strong>{item.externalClientName ? ` · ${item.externalClientName}` : ""}<span className="block mt-1 text-slate-500">{item.error}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          {loading && !coverage ? <div className="p-8 text-center text-sm font-semibold text-slate-500"><Loader2 size={18} className="mx-auto mb-2 animate-spin" />Loading today's coverage...</div> : null}
          {!loading && coverage && !visibleRows.length ? <div className="p-8 text-center text-sm font-semibold text-emerald-700">No investors in this view. Today's portfolio coverage is clear.</div> : null}
          {visibleRows.map((row) => <CoverageRow key={row.investorId} row={row} canManage={canManage} onToggle={toggleTracking} busyInvestorId={busyInvestorId} />)}
        </div>
      </div>
    </Card>
  );
}
