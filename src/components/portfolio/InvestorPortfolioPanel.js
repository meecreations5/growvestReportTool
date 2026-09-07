"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  BadgeIndianRupee,
  BellRing,
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Layers3,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Target,
  Trash2,
  Settings2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X
} from "lucide-react";
import Button from "@/components/ui/Button";
import InvestorPortfolioBulkCleanupDialog from "@/components/portfolio/InvestorPortfolioBulkCleanupDialog";
import SipFundingScheduleDialog from "@/components/sip-funding/SipFundingScheduleDialog";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { MobileDonutChart, MobileLineChart } from "@/components/investor/mobile/MobileFinanceCharts";
import { MobileEmptyState, MobileSectionHeading } from "@/components/investor/mobile/InvestorMobilePrimitives";
import { Field, inputClassName } from "@/components/ui/Field";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { businessDateKey } from "@/lib/utils/date";
import { filterTrendByRange } from "@/lib/utils/investorExperience";
import {
  MUTUAL_FUND_INVESTMENT_MODES,
  PORTFOLIO_PRODUCT_LABELS,
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_RECONCILIATION_LABELS,
  PORTFOLIO_RECONCILIATION_STATUS,
  PORTFOLIO_RECONCILIATION_THRESHOLDS,
  PORTFOLIO_SOURCE_LABELS,
  positionGoal
} from "@/lib/constants/portfolio";
import { GENERAL_WEALTH_BUCKET_NAME, specificGoalAllocations } from "@/lib/portfolioGoalAllocation";
import {
  createManualIntradayTrade,
  createManualPortfolioPosition,
  getInvestorPortfolioView,
  recordDeliverySale,
  updatePortfolioGoal
} from "@/services/portfolioService";

const FILTERS = [
  ["all", "All"],
  [PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, "Mutual Funds"],
  [PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY, "Delivery Stocks"],
  [PORTFOLIO_PRODUCT_TYPES.ULIP, "ULIP"],
  ["other", "Other"]
];

function percent(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function goalRows(investor) {
  const safeInvestor = investor && typeof investor === "object" ? investor : {};
  return Array.isArray(safeInvestor.bucketList) && safeInvestor.bucketList.length
    ? safeInvestor.bucketList
    : (Array.isArray(safeInvestor.goals) ? safeInvestor.goals : []);
}

function productLabel(position) {
  return position.investmentTypeLabel || PORTFOLIO_PRODUCT_LABELS[position.productType] || "Investment";
}

function holdingSecondary(position) {
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND) return [position.folioNo ? `Folio ${position.folioNo}` : "", position.investmentMode].filter(Boolean).join(" · ");
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) return [position.symbol, position.exchange, position.provider].filter(Boolean).join(" · ");
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.ULIP) return [position.policyNumber ? `Policy ${position.policyNumber}` : "", position.provider].filter(Boolean).join(" · ");
  return [position.provider, position.assetClass].filter(Boolean).join(" · ");
}

function sourceDate(position) {
  return position.navDate || position.valuationDate || position.priceDate || "";
}

function Stat({ label, value, helper, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600"
  };
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 font-heading text-2xl font-bold text-slate-950">{value}</p>{helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}</div><span className={`grid h-9 w-9 place-items-center rounded-lg ${tones[tone] || tones.blue}`}><Icon size={18} /></span></div></article>;
}

function navMovement(position) {
  const current = Number(position.currentNav || 0);
  const previous = Number(position.previousNav || 0);
  if (current <= 0 || previous <= 0) return null;
  return {
    amount: current - previous,
    percentage: ((current - previous) / previous) * 100
  };
}

function freshnessAge(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const today = new Date(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now));
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
}

function FreshnessBadge({ date }) {
  const age = freshnessAge(date);
  if (age === null) return null;
  const attention = age > 3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${attention ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
      {attention ? <CircleAlert size={11} /> : <ShieldCheck size={11} />}
      {attention ? `${age} days old` : age === 0 ? "As of today" : `${age} day${age === 1 ? "" : "s"} old`}
    </span>
  );
}

function SourceFreshnessPill({ source = {} }) {
  const missing = !source.valuationDate || Number(source.missingDateCount || 0) > 0;
  const age = freshnessAge(source.oldestValuationDate || source.valuationDate);
  const stale = age !== null && age > PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS;
  const aging = age !== null && age > PORTFOLIO_RECONCILIATION_THRESHOLDS.FRESH_DAYS;
  const attention = missing || stale || aging;
  const detail = missing
    ? "date missing"
    : age === 0
      ? "current"
      : age !== null
        ? `${age} day${age === 1 ? "" : "s"} old`
        : source.valuationDate ? formatDate(source.valuationDate) : "latest imported";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${attention ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>{attention ? <CircleAlert size={13} /> : <ShieldCheck size={13} className="text-emerald-600" />}{PORTFOLIO_SOURCE_LABELS[source.source] || source.sourceLabel || source.source}: {detail}</span>;
}

function ReconciliationBadge({ status, portal = false }) {
  const safeStatus = status || PORTFOLIO_RECONCILIATION_STATUS.VERIFIED;
  const label = portal
    ? safeStatus === PORTFOLIO_RECONCILIATION_STATUS.VERIFIED ? "Portfolio data verified" : "Portfolio update under review"
    : PORTFOLIO_RECONCILIATION_LABELS[safeStatus] || "Review";
  const verified = safeStatus === PORTFOLIO_RECONCILIATION_STATUS.VERIFIED;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{verified ? <ShieldCheck size={11} /> : <CircleAlert size={11} />}{label}</span>;
}


function mobileAssetLabel(position = {}) {
  if (position.assetClass) return String(position.assetClass);
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND) return "Mutual Funds";
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) return "Equity";
  if (position.productType === PORTFOLIO_PRODUCT_TYPES.ULIP) return "ULIP";
  const type = String(position.productType || "").toLowerCase();
  if (type.includes("gold")) return "Gold";
  if (type.includes("bond") || type.includes("fixed") || type.includes("debt")) return "Fixed Income";
  return position.investmentTypeLabel || "Other";
}

function mobileTrendDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return String(value).slice(5);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function mobileAllocationColor(label = "", index = 0) {
  const text = String(label).toLowerCase();
  if (/equity|stock/.test(text)) return "#1F4ED8";
  if (/mutual/.test(text)) return "#6F8FF0";
  if (/debt|fixed|bond/.test(text)) return "#F5B301";
  if (/gold/.test(text)) return "#D39A00";
  if (/ulip|retire|nps|ppf/.test(text)) return "#0B0B0F";
  const fallback = ["#1F4ED8", "#6F8FF0", "#F5B301", "#0B0B0F", "#6B7280", "#AEB7C6"];
  return fallback[index % fallback.length];
}

function MobilePortfolioAppView({ summary, positions, snapshots, snapshot, movement, monthComparison, goalHealth, intelligence, tradingSummary, error }) {
  const rawTrend = [...(snapshots || [])].reverse().map((item) => ({ date: item.snapshotDate, label: String(item.snapshotDate || "").slice(5), value: Number(item.summary?.currentValue || 0) }));
  const [range, setRange] = useState("1Y");
  const trend = filterTrendByRange(rawTrend, range);
  const allocationMap = new Map();
  (positions || []).forEach((position) => {
    const label = mobileAssetLabel(position);
    allocationMap.set(label, (allocationMap.get(label) || 0) + Number(position.currentValue || 0));
  });
  const allocation = [...allocationMap.entries()].map(([label, value], index) => ({ label, value, color: mobileAllocationColor(label, index) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const allocationTotal = allocation.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const sortedHoldings = [...(positions || [])].sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0));
  const top = showAllHoldings ? sortedHoldings : sortedHoldings.slice(0, 5);
  const displayGain = summary.invested > 0 ? Number(summary.current || 0) - Number(summary.invested || 0) : Number(summary.gain || 0);
  const gainPercent = summary.invested > 0 ? displayGain / summary.invested * 100 : 0;
  const trendLabels = trend.length ? [trend[0], trend[Math.floor((trend.length - 1) / 2)], trend[trend.length - 1]] : [];
  const marketMovement = Number(monthComparison?.marketMovement ?? movement?.marketMovement ?? 0);
  const freshInvestment = Number(monthComparison?.newMoney || movement?.newMoney || 0);
  const rangeStart = trend[0]?.date || "";
  const rangeEnd = trend[trend.length - 1]?.date || "";
  const rangeDescription = trend.length > 1
    ? `${range} · ${trend.length} verified points · ${mobileTrendDateLabel(rangeStart)} to ${mobileTrendDateLabel(rangeEnd)}`
    : `${range} · Limited verified history`;

  return (
    <div className="gv-mobile-app-stack md:hidden">
      {error ? <div className="rounded-[16px] border border-[#E53935]/20 bg-[#E53935]/5 p-3 text-xs font-semibold text-[#B42318]">{error}</div> : null}

      <section className="px-0.5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#6B7280]">Total Portfolio Value</p>
            <p className="gv-private-value mt-1 font-heading text-[2.1rem] font-bold leading-none tracking-[-.03em] text-[#0B0B0F]">{formatCurrency(summary.current)}</p>
            <p className={`mt-2 inline-flex items-center gap-1 text-[12px] font-bold ${displayGain >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>{displayGain >= 0 ? <TrendingUp size={14} strokeWidth={1.55} /> : <TrendingDown size={14} strokeWidth={1.55} />}<span className="gv-private-value">{displayGain >= 0 ? "+" : ""}{formatCurrency(displayGain)} ({gainPercent >= 0 ? "+" : ""}{gainPercent.toFixed(1)}%)</span></p>
          </div>
          <div className="pt-1"><ReconciliationBadge status={intelligence?.status || snapshot?.reconciliationStatus} portal /></div>
        </div>

        <div className="mt-5 flex items-center gap-1 rounded-[14px] bg-[#F4F6F9] p-1">
          {["1M", "3M", "6M", "1Y", "All"].map((item) => <button key={item} type="button" aria-pressed={range === item} onClick={() => setRange(item)} className={`min-h-8 flex-1 rounded-[10px] text-[10px] font-bold transition ${range === item ? "bg-[#1F4ED8] text-white shadow-sm" : "text-[#6B7280]"}`}>{item}</button>)}
        </div>
        <div className="mt-4 min-h-[140px] overflow-hidden bg-white">
          <MobileLineChart points={trend} height={132} showDots={trend.length <= 8} />
        </div>
        {trendLabels.length ? <div className="mt-1 flex items-center justify-between text-[10px] text-[#6B7280]">{trendLabels.map((item, index) => <span key={`${item.date || item.label}-${index}`}>{mobileTrendDateLabel(item.date)}</span>)}</div> : null}
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[#6B7280]"><span>{rangeDescription}</span><span>{snapshot?.snapshotDate ? `Verified ${formatDate(snapshot.snapshotDate)}` : "Latest"}</span></div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] bg-[#F4F6F9] p-3.5"><p className="text-[11px] text-[#6B7280]">Amount Invested</p><p className="gv-private-value mt-1 font-heading text-[1.05rem] font-bold text-[#0B0B0F]">{formatCurrency(summary.invested)}</p></div>
          <div className="rounded-[16px] bg-[#F4F6F9] p-3.5"><p className="text-[11px] text-[#6B7280]">Gain / Loss vs invested</p><p className={`gv-private-value mt-1 font-heading text-[1.05rem] font-bold ${displayGain >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>{displayGain >= 0 ? "+" : ""}{formatCurrency(displayGain)}</p><p className={`mt-0.5 text-[10px] font-semibold ${displayGain >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>{gainPercent >= 0 ? "+" : ""}{gainPercent.toFixed(1)}%</p></div>
        </div>
      </section>

      {allocation.length ? <section className="border-t border-slate-200 pt-4 gv-mobile-deferred">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-[1.12rem] font-bold text-[#0B0B0F]">Asset Allocation</h2><p className="mt-0.5 text-[11px] text-[#6B7280]">Where your money is invested</p></div><span className="text-[10px] font-medium text-[#6B7280]">{positions.length} holdings</span></div>
        <div className="mt-4 flex items-center gap-5"><MobileDonutChart segments={allocation.slice(0, 6)} size={126} centerValue={formatCurrency(summary.current)} privateValue centerLabel="Total" /><div className="min-w-0 flex-1 space-y-2.5">{allocation.slice(0, 5).map((item) => <div key={item.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#6B7280]">{item.label}</span><strong className="text-[11px] text-[#0B0B0F]">{(Number(item.value || 0) / allocationTotal * 100).toFixed(0)}%</strong></div>)}</div></div>
      </section> : null}

      {Number(goalHealth?.allocationPercentage || 0) > 0 || freshInvestment || marketMovement ? <section className="border-t border-slate-200 pt-4 gv-mobile-deferred">
        <h2 className="font-heading text-[1.12rem] font-bold text-[#0B0B0F]">Portfolio Snapshot</h2>
        <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-[16px] bg-[#F4F6F9] py-3">
          <div className="px-2"><p className="text-[10px] text-[#6B7280]">Fresh money</p><p className="gv-private-value mt-1 truncate text-[11px] font-bold text-[#0B0B0F]">{formatCurrency(freshInvestment)}</p></div>
          <div className="px-2"><p className="text-[10px] text-[#6B7280]">Market move</p><p className={`gv-private-value mt-1 truncate text-[11px] font-bold ${marketMovement >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>{marketMovement >= 0 ? "+" : ""}{formatCurrency(marketMovement)}</p></div>
          <div className="px-2"><p className="text-[10px] text-[#6B7280]">To Bucket List</p><p className="mt-1 truncate text-[11px] font-bold text-[#0B0B0F]">{Number(goalHealth?.allocationPercentage || 0).toFixed(0)}%</p></div>
        </div>
      </section> : null}

      <section className="gv-mobile-deferred">
        <div className="mb-2.5 flex items-end justify-between gap-3"><div><h2 className="font-heading text-[1.12rem] font-bold text-[#0B0B0F]">Top Holdings</h2><p className="mt-0.5 text-[11px] text-[#6B7280]">What you own</p></div>{sortedHoldings.length > 5 ? <button type="button" onClick={() => setShowAllHoldings((value) => !value)} className="text-[11px] font-bold text-[#1F4ED8]">{showAllHoldings ? "Top 5" : "See all"}</button> : null}</div>
        {top.length ? <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">{top.map((position, index) => {
          const value = Number(position.currentValue || 0);
          const gain = Number(position.gainLoss || 0);
          const pct = summary.current > 0 ? value / summary.current * 100 : 0;
          return <Link key={position.id} href={`/investor/portfolio/${position.id}`} className={`flex min-h-[70px] items-center gap-3 px-4 py-3 active:bg-[#F4F6F9] ${index ? "border-t border-slate-100" : ""}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F4F6F9] text-[#1F4ED8]"><WalletCards size={17} strokeWidth={1.5} /></span><div className="min-w-0 flex-1"><p className="line-clamp-1 text-[12px] font-bold text-[#0B0B0F]">{position.instrumentName || position.schemeName || position.stockName || position.fundName || "Investment"}</p><p className="mt-0.5 text-[10px] text-[#6B7280]">{mobileAssetLabel(position)} · {pct.toFixed(1)}% of portfolio</p></div><div className="shrink-0 text-right"><p className="gv-private-value font-heading text-[12px] font-bold text-[#0B0B0F]">{formatCurrency(value)}</p><p className={`gv-private-value mt-0.5 text-[9px] font-semibold ${gain >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>{gain >= 0 ? "+" : ""}{formatCurrency(gain)}</p></div><ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-slate-300" /></Link>;
        })}</div> : <MobileEmptyState icon={WalletCards} title="No verified holdings yet" copy="Your holdings will appear here after the Portfolio Master is updated." />}
      </section>

      {Number(tradingSummary?.net || 0) !== 0 || Number(tradingSummary?.gross || 0) !== 0 ? <section className="border-t border-slate-200 pt-4 gv-mobile-deferred"><h2 className="font-heading text-[1.12rem] font-bold text-[#0B0B0F]">Trading Account</h2><p className="mt-0.5 text-[11px] text-[#6B7280]">Intraday activity stays separate from your long-term wealth.</p><div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-[16px] bg-[#F4F6F9] py-3"><div className="px-2"><p className="text-[10px] text-[#6B7280]">Gross P&L</p><p className="gv-private-value mt-1 text-[11px] font-bold text-[#0B0B0F]">{formatCurrency(tradingSummary.gross)}</p></div><div className="px-2"><p className="text-[10px] text-[#6B7280]">Charges</p><p className="gv-private-value mt-1 text-[11px] font-bold text-[#0B0B0F]">{formatCurrency(tradingSummary.charges)}</p></div><div className="px-2"><p className="text-[10px] text-[#6B7280]">Net</p><p className={`gv-private-value mt-1 text-[11px] font-bold ${Number(tradingSummary.net || 0) >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>{formatCurrency(tradingSummary.net)}</p></div></div></section> : null}
    </div>
  );
}

function UlipPolicyCard({ policy, funds = [] }) {
  const linkedGoals = [...new Set(funds.flatMap((item) => (item.goalAllocations || []).map((goal) => goal?.goalName).filter(Boolean)))];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-bold text-slate-950">{policy.planName || "ULIP Policy"}</h3>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">ULIP Policy</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{policy.policyStatus || "Active"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{policy.insurer || policy.provider || "Insurance Provider"} · Policy {policy.policyNumber || "—"}</p>
          {linkedGoals.length ? <p className="mt-2 text-xs font-semibold text-violet-700">Goals: {linkedGoals.join(", ")}</p> : <p className="mt-2 text-xs text-slate-500">Goal allocation is managed fund-by-fund below.</p>}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Current Fund Value</p>
          <p className="mt-1 font-heading text-xl font-bold text-slate-950">{formatCurrency(policy.currentFundValue)}</p>
          <div className="mt-1"><FreshnessBadge date={policy.latestNavDate} /></div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Premium Paid</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(policy.totalPremiumPaid)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Premium</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(policy.premiumAmount)}{policy.premiumFrequency ? ` · ${policy.premiumFrequency}` : ""}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Funds</p><p className="mt-1 text-sm font-semibold text-slate-800">{Number(policy.fundCount || funds.length || 0)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Latest NAV Date</p><p className="mt-1 text-sm font-semibold text-slate-800">{policy.latestNavDate ? formatDate(policy.latestNavDate) : "—"}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Policy Start</p><p className="mt-1 text-sm font-semibold text-slate-800">{policy.policyStartDate ? formatDate(policy.policyStartDate) : "—"}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Maturity</p><p className="mt-1 text-sm font-semibold text-slate-800">{policy.maturityDate ? formatDate(policy.maturityDate) : "—"}</p></div>
      </div>
    </article>
  );
}

function PositionCard({ position, investor, editable, portal, busyId, onGoalChange, onSell, onSipReminder, selectionMode = false, selected = false, onToggle }) {
  const goal = positionGoal(position);
  const positive = Number(position.gainLoss || 0) >= 0;
  const goals = goalRows(investor);
  const valuationDate = sourceDate(position);
  const navDelta = position.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? navMovement(position) : null;
  const sourceLabel = PORTFOLIO_SOURCE_LABELS[position.source] || position.provider || "GrowVest Portfolio";

  return (
    <article className={`rounded-xl border bg-white p-4 sm:p-5 ${selected ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"}`}>
      {selectionMode ? <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={selected} onChange={() => onToggle?.(position.id)} className="h-4 w-4 accent-red-600" /> Select this investment for cleanup</label> : null}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-bold text-slate-950">{position.instrumentName || "Investment"}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{productLabel(position)}</span>
            {position.investmentMode ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{position.investmentMode}</span> : null}
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${goal?.goalId ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-600"}`}>{goal?.goalName || "General Wealth"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{holdingSecondary(position) || sourceLabel}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-heading text-xl font-bold text-slate-950">{formatCurrency(position.currentValue)}</p>
          {position.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && position.gainLossAvailable === false ? (
            <p className="mt-1 text-xs font-semibold text-slate-500">Fund-level return unavailable</p>
          ) : (
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
              {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {formatCurrency(position.gainLoss)} · {percent(position.returnPercentage)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{position.productType === PORTFOLIO_PRODUCT_TYPES.ULIP ? "Fund cost basis" : "Invested"}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{position.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && !Number(position.totalInvested ?? position.investedAmount ?? 0) ? "Not provided" : formatCurrency(position.totalInvested ?? position.investedAmount)}</p>
        </div>

        {position.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? <>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Units</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{Number(position.totalUnits || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Current NAV</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">₹{Number(position.currentNav || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p>
            {navDelta ? <p className={`mt-1 text-[10px] font-bold ${navDelta.percentage >= 0 ? "text-emerald-600" : "text-red-600"}`}>{percent(navDelta.percentage)} vs previous NAV</p> : null}
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Monthly SIP</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(position.monthlySip)}</p>
          </div>
        </> : null}

        {position.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? <>
          <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Quantity</p><p className="mt-1 text-sm font-semibold text-slate-800">{Number(position.quantity || 0).toLocaleString("en-IN")}</p></div>
          <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Avg Buy Rate</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(position.averageBuyRate)}</p></div>
          <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Current Rate</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(position.currentRate)}</p></div>
        </> : null}

        {position.productType === PORTFOLIO_PRODUCT_TYPES.ULIP ? <>
          <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Units</p><p className="mt-1 text-sm font-semibold text-slate-800">{Number(position.totalUnits || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p></div>
          <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">NAV</p><p className="mt-1 text-sm font-semibold text-slate-800">₹{Number(position.currentNav || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p></div>
          <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Fund Code</p><p className="mt-1 text-sm font-semibold text-slate-800">{position.fundCode || "—"}</p></div>
        </> : null}

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">NAV / Valuation</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{valuationDate ? formatDate(valuationDate) : "—"}</p>
          <div className="mt-1"><FreshnessBadge date={valuationDate} /></div>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Source</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{sourceLabel}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {editable ? (
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Goal / Corpus</label>
              <div className="relative">
                <select disabled={busyId === position.id} className={inputClassName} value={goal?.goalId || ""} onChange={(event) => onGoalChange(position.id, event.target.value)}>
                  <option value="">General Wealth (Default)</option>
                  {goals.map((item) => <option key={item.id || item.goalId} value={item.id || item.goalId}>{item.name || item.goalName || "Goal"}</option>)}
                </select>
                {busyId === position.id ? <Loader2 size={15} className="absolute right-9 top-1/2 -translate-y-1/2 animate-spin text-blue-600" /> : <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
              </div>
            </div>
            <p className="text-xs text-slate-500">This assignment is saved on the permanent holding and will carry forward to future portfolio uploads until staff changes it.</p>
            <div className="flex flex-wrap justify-end gap-2">{position.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND && (Number(position.monthlySip || 0) > 0 || ["SIP", "Both"].includes(position.investmentMode)) ? <Button type="button" variant="secondary" onClick={() => onSipReminder?.(position)}><BellRing size={15} /> SIP Reminder</Button> : null}{position.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY && Number(position.quantity || 0) > 0 ? <Button type="button" variant="secondary" onClick={() => onSell?.(position)}>Record Delivery Sale</Button> : null}</div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"><Target size={14} className="text-blue-700" /> {goal?.goalName || "General Wealth"}</p>
            {portal ? <Link href={`/investor/actions?new=1&requestType=${encodeURIComponent("Discuss Investment")}&positionId=${encodeURIComponent(position.id)}&positionName=${encodeURIComponent(position.instrumentName || "Investment")}&goalId=${encodeURIComponent(goal?.goalId || "")}&goalName=${encodeURIComponent(goal?.goalName || GENERAL_WEALTH_BUCKET_NAME)}`} className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100">Take Action</Link> : null}
          </div>
        )}
      </div>
    </article>
  );
}

function DeliverySaleForm({ position, onClose, onSaved }) {
  const [form, setForm] = useState({ sellDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function save() {
    setBusy(true); setError("");
    try {
      await recordDeliverySale(position.id, form);
      await onSaved?.();
      onClose();
    } catch (nextError) {
      setError(nextError.message || "Unable to record delivery sale.");
    } finally {
      setBusy(false);
    }
  }

  return <Card className="border-amber-200 bg-amber-50/30 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Delivery stock sale</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">{position.instrumentName || position.stockName}</h3><p className="mt-1 text-sm text-slate-500">Current holding: {Number(position.quantity || 0).toLocaleString("en-IN")} shares · Avg buy {formatCurrency(position.averageBuyRate)}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500"><X size={16} /></button></div>{error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-5 grid gap-4 md:grid-cols-4"><Field label="Sell Date"><input type="date" className={inputClassName} value={form.sellDate || ""} onChange={(e) => set("sellDate", e.target.value)} /></Field><Field label="Quantity Sold"><input type="number" min="0" max={Number(position.quantity || 0)} className={inputClassName} value={form.quantity || ""} onChange={(e) => set("quantity", e.target.value)} /></Field><Field label="Sell Rate"><input type="number" min="0" step="0.01" className={inputClassName} value={form.sellRate || ""} onChange={(e) => set("sellRate", e.target.value)} /></Field><Field label="Charges"><input type="number" min="0" step="0.01" className={inputClassName} value={form.charges || ""} onChange={(e) => set("charges", e.target.value)} /></Field></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Record Sale</Button></div></Card>;
}

function ManualHoldingForm({ investor, onClose, onSaved }) {
  const [type, setType] = useState(PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY);
  const [form, setForm] = useState({ provider: "Bajaj Broking", exchange: "NSE", investmentMode: "SIP" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const goals = goalRows(investor);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function save() {
    setBusy(true); setError("");
    try {
      await createManualPortfolioPosition({ investorId: investor.id, productType: type, ...form });
      onSaved?.(); onClose();
    } catch (nextError) { setError(nextError.message || "Unable to save holding."); }
    finally { setBusy(false); }
  }

  return <Card className="border-blue-200 bg-blue-50/20 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Manual portfolio entry</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Add investment holding</h3></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500"><X size={16} /></button></div>{error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Investment type"><select className={inputClassName} value={type} onChange={(event) => { const next = event.target.value; setType(next); setForm((current) => ({ ...current, provider: next === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? "Bajaj Broking" : current.provider })); }}><option value={PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY}>Stock - Delivery</option><option value={PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND}>Mutual Fund</option><option value={PORTFOLIO_PRODUCT_TYPES.ULIP}>ULIP</option><option value={PORTFOLIO_PRODUCT_TYPES.PMS}>PMS</option><option value={PORTFOLIO_PRODUCT_TYPES.BOND}>Bond</option><option value={PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT}>Fixed Deposit</option><option value={PORTFOLIO_PRODUCT_TYPES.GOLD}>Gold</option><option value={PORTFOLIO_PRODUCT_TYPES.ETF}>ETF</option><option value={PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE}>Real Estate</option><option value={PORTFOLIO_PRODUCT_TYPES.OTHER}>Other</option></select></Field><Field label="Investment / instrument"><input className={inputClassName} value={form.instrumentName || ""} onChange={(e) => set("instrumentName", e.target.value)} /></Field><Field label="Provider"><input className={inputClassName} value={form.provider || ""} onChange={(e) => set("provider", e.target.value)} /></Field><Field label="Goal / Corpus"><select className={inputClassName} value={form.goalId || ""} onChange={(e) => set("goalId", e.target.value)}><option value="">General Wealth (Default)</option>{goals.map((goal) => <option key={goal.id || goal.goalId} value={goal.id || goal.goalId}>{goal.name || goal.goalName}</option>)}</select></Field>
      {type === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? <><Field label="Symbol"><input className={inputClassName} value={form.symbol || ""} onChange={(e) => set("symbol", e.target.value)} /></Field><Field label="Exchange"><select className={inputClassName} value={form.exchange || "NSE"} onChange={(e) => set("exchange", e.target.value)}><option>NSE</option><option>BSE</option></select></Field><Field label="Buy / Avg Rate"><input type="number" className={inputClassName} value={form.averageBuyRate || ""} onChange={(e) => set("averageBuyRate", e.target.value)} /></Field><Field label="Quantity"><input type="number" className={inputClassName} value={form.quantity || ""} onChange={(e) => set("quantity", e.target.value)} /></Field><Field label="Current Rate"><input type="number" className={inputClassName} value={form.currentRate || ""} onChange={(e) => set("currentRate", e.target.value)} /></Field><Field label="Price Date"><input type="date" className={inputClassName} value={form.priceDate || ""} onChange={(e) => set("priceDate", e.target.value)} /></Field></> : null}
      {type === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? <><Field label="Investment mode"><select className={inputClassName} value={form.investmentMode || "SIP"} onChange={(e) => set("investmentMode", e.target.value)}>{MUTUAL_FUND_INVESTMENT_MODES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="ISIN"><input className={inputClassName} value={form.isin || ""} onChange={(e) => set("isin", e.target.value)} /></Field><Field label="Folio"><input className={inputClassName} value={form.folioNo || ""} onChange={(e) => set("folioNo", e.target.value)} /></Field><Field label="Total Invested"><input type="number" className={inputClassName} value={form.totalInvested || ""} onChange={(e) => set("totalInvested", e.target.value)} /></Field><Field label="Units"><input type="number" step="0.0001" className={inputClassName} value={form.totalUnits || ""} onChange={(e) => set("totalUnits", e.target.value)} /></Field><Field label="Current NAV"><input type="number" step="0.0001" className={inputClassName} value={form.currentNav || ""} onChange={(e) => set("currentNav", e.target.value)} /></Field><Field label="NAV Date"><input type="date" className={inputClassName} value={form.navDate || ""} onChange={(e) => set("navDate", e.target.value)} /></Field><Field label="Monthly SIP"><input type="number" className={inputClassName} value={form.monthlySip || ""} onChange={(e) => set("monthlySip", e.target.value)} /></Field></> : null}
      {type === PORTFOLIO_PRODUCT_TYPES.ULIP ? <><Field label="Insurance Company"><input className={inputClassName} value={form.insurer || form.provider || ""} onChange={(e) => { set("insurer", e.target.value); set("provider", e.target.value); }} /></Field><Field label="Policy Number"><input className={inputClassName} value={form.policyNumber || ""} onChange={(e) => set("policyNumber", e.target.value)} /></Field><Field label="Plan Name"><input className={inputClassName} value={form.planName || ""} onChange={(e) => set("planName", e.target.value)} /></Field><Field label="Fund Name"><input className={inputClassName} value={form.fundName || ""} onChange={(e) => { set("fundName", e.target.value); if (!form.instrumentName) set("instrumentName", e.target.value); }} /></Field><Field label="Fund Code"><input className={inputClassName} value={form.fundCode || ""} onChange={(e) => set("fundCode", e.target.value)} /></Field><Field label="Policy Start Date"><input type="date" className={inputClassName} value={form.policyStartDate || ""} onChange={(e) => set("policyStartDate", e.target.value)} /></Field><Field label="Units"><input type="number" step="0.0001" className={inputClassName} value={form.totalUnits || ""} onChange={(e) => set("totalUnits", e.target.value)} /></Field><Field label="NAV"><input type="number" step="0.0001" className={inputClassName} value={form.currentNav || ""} onChange={(e) => set("currentNav", e.target.value)} /></Field><Field label="NAV Date"><input type="date" className={inputClassName} value={form.navDate || ""} onChange={(e) => set("navDate", e.target.value)} /></Field><Field label="Total Premium Paid"><input type="number" className={inputClassName} value={form.policyTotalPremiumPaid || ""} onChange={(e) => set("policyTotalPremiumPaid", e.target.value)} /></Field><Field label="Premium Amount"><input type="number" className={inputClassName} value={form.premiumAmount || ""} onChange={(e) => set("premiumAmount", e.target.value)} /></Field><Field label="Premium Frequency"><select className={inputClassName} value={form.premiumFrequency || ""} onChange={(e) => set("premiumFrequency", e.target.value)}><option value="">Select</option><option>Monthly</option><option>Quarterly</option><option>Half-Yearly</option><option>Annual</option><option>Single</option></select></Field><Field label="Maturity Date"><input type="date" className={inputClassName} value={form.maturityDate || ""} onChange={(e) => set("maturityDate", e.target.value)} /></Field><Field label="Sum Assured"><input type="number" className={inputClassName} value={form.sumAssured || ""} onChange={(e) => set("sumAssured", e.target.value)} /></Field></> : null}
      {![PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY, PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(type) ? <><Field label="Asset Class"><input className={inputClassName} value={form.assetClass || ""} onChange={(e) => set("assetClass", e.target.value)} placeholder="Equity, Debt, Gold, Real Estate…" /></Field><Field label="Invested Amount"><input type="number" className={inputClassName} value={form.totalInvested || ""} onChange={(e) => set("totalInvested", e.target.value)} /></Field><Field label="Current Value"><input type="number" className={inputClassName} value={form.currentValue || ""} onChange={(e) => set("currentValue", e.target.value)} /></Field><Field label="Valuation Date"><input type="date" className={inputClassName} value={form.valuationDate || ""} onChange={(e) => set("valuationDate", e.target.value)} /></Field></> : null}
    </div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save Holding</Button></div></Card>;
}

function IntradayForm({ investor, onClose, onSaved }) {
  const [form, setForm] = useState({ provider: "Bajaj Broking", exchange: "NSE", tradeDate: businessDateKey() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function save() { setBusy(true); setError(""); try { await createManualIntradayTrade({ investorId: investor.id, ...form }); await onSaved?.(); onClose(); } catch (nextError) { setError(nextError.message || "Unable to save trade."); } finally { setBusy(false); } }
  return <Card className="border-amber-200 bg-amber-50/20 p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Bajaj Broking</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Add closed intraday trade</h3></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white"><X size={16} /></button></div>{error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Trade Date"><input type="date" className={inputClassName} value={form.tradeDate} onChange={(e) => set("tradeDate", e.target.value)} /></Field><Field label="Stock"><input className={inputClassName} value={form.stockName || ""} onChange={(e) => set("stockName", e.target.value)} /></Field><Field label="Symbol"><input className={inputClassName} value={form.symbol || ""} onChange={(e) => set("symbol", e.target.value)} /></Field><Field label="Quantity"><input type="number" className={inputClassName} value={form.quantity || ""} onChange={(e) => set("quantity", e.target.value)} /></Field><Field label="Buy Rate"><input type="number" className={inputClassName} value={form.buyRate || ""} onChange={(e) => set("buyRate", e.target.value)} /></Field><Field label="Sell Rate"><input type="number" className={inputClassName} value={form.sellRate || ""} onChange={(e) => set("sellRate", e.target.value)} /></Field><Field label="Brokerage"><input type="number" className={inputClassName} value={form.brokerage || ""} onChange={(e) => set("brokerage", e.target.value)} /></Field><Field label="STT"><input type="number" className={inputClassName} value={form.stt || ""} onChange={(e) => set("stt", e.target.value)} /></Field><Field label="Exchange Charges"><input type="number" className={inputClassName} value={form.exchangeCharges || ""} onChange={(e) => set("exchangeCharges", e.target.value)} /></Field><Field label="GST"><input type="number" className={inputClassName} value={form.gst || ""} onChange={(e) => set("gst", e.target.value)} /></Field><Field label="Stamp Duty"><input type="number" className={inputClassName} value={form.stampDuty || ""} onChange={(e) => set("stampDuty", e.target.value)} /></Field><Field label="Other Charges"><input type="number" className={inputClassName} value={form.otherCharges || ""} onChange={(e) => set("otherCharges", e.target.value)} /></Field></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save Trade</Button></div></Card>;
}

export default function InvestorPortfolioPanel({ investor, editable = false, portal = false }) {
  const { profile } = useAuth();
  const [portfolioInvestor, setPortfolioInvestor] = useState(null);
  const [positions, setPositions] = useState([]);
  const [ulipPolicies, setUlipPolicies] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [goalBusyId, setGoalBusyId] = useState("");
  const [addHolding, setAddHolding] = useState(false);
  const [addTrade, setAddTrade] = useState(false);
  const [salePosition, setSalePosition] = useState(null);
  const [manageMode, setManageMode] = useState(false);
  const [selectedPositionIds, setSelectedPositionIds] = useState([]);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [sipPosition, setSipPosition] = useState(null);

  const loadPortfolio = useCallback(async ({ quiet = false } = {}) => {
    if (!investor?.id) {
      setPortfolioInvestor(null);
      setPositions([]);
      setUlipPolicies([]);
      setSnapshots([]);
      setTransactions([]);
      setTrades([]);
      setManualAccounts([]);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError("");
    try {
      const result = await getInvestorPortfolioView(investor.id);
      setPortfolioInvestor(result.investor || null);
      setPositions(result.positions || []);
      setUlipPolicies(result.ulipPolicies || []);
      setSnapshots(result.snapshots || []);
      setTransactions(result.transactions || []);
      setTrades(result.trades || []);
      setManualAccounts(result.manualAccounts || []);
    } catch (nextError) {
      console.error("Unable to load investor portfolio", nextError);
      setError(nextError.message || "Unable to load investor portfolio.");
    } finally {
      setLoading(false);
    }
  }, [investor?.id]);

  useEffect(() => {
    let active = true;
    loadPortfolio().catch((nextError) => {
      if (active) console.error("Unable to initialise investor portfolio", nextError);
    });
    return () => { active = false; };
  }, [loadPortfolio]);

  const effectiveInvestor = useMemo(() => ({ ...(investor || {}), ...(portfolioInvestor || {}) }), [investor, portfolioInvestor]);

  const snapshot = snapshots[0] || null;
  const previousSnapshot = snapshots.find((item, index) => index > 0 && String(item.snapshotDate || "") < String(snapshot?.snapshotDate || "")) || null;

  const summary = useMemo(() => {
    const current = positions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const regularInvested = positions
      .filter((item) => item.productType !== PORTFOLIO_PRODUCT_TYPES.ULIP)
      .reduce((sum, item) => sum + Number(item.totalInvested ?? item.investedAmount ?? 0), 0);
    const policyPremium = ulipPolicies.length
      ? ulipPolicies.reduce((sum, policy) => sum + Number(policy.totalPremiumPaid || 0), 0)
      : [...new Map(positions
        .filter((item) => item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && item.policyNumber)
        .map((item) => [String(item.policyNumber).toUpperCase(), Number(item.policyTotalPremiumPaid || 0)])).values()]
        .reduce((sum, value) => sum + Number(value || 0), 0);
    const invested = regularInvested + policyPremium;
    const positionGain = positions.reduce((sum, item) => {
      if (item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && item.gainLossAvailable === false) return sum;
      return sum + Number(item.gainLoss || 0);
    }, 0);
    // Current value and invested amount are the two portfolio-level source-of-truth
    // figures shown to the investor. Derive the portfolio-level gain/loss from
    // those totals so the three displayed numbers can never contradict each other.
    const gain = invested > 0 ? current - invested : positionGain;
    const gainPartial = false;
    const monthlySip = positions.reduce((sum, item) => sum + Number(item.monthlySip || 0), 0);
    return { current, invested, gain, gainPartial, monthlySip };
  }, [positions, ulipPolicies]);

  const goals = useMemo(() => goalRows(effectiveInvestor), [effectiveInvestor]);
  const availableSources = useMemo(() => [...new Set(positions.map((item) => item.source || "manual"))].sort(), [positions]);
  const visible = useMemo(() => positions.filter((item) => {
    const productMatches = filter === "all"
      ? true
      : filter === "other"
        ? ![PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(item.productType)
        : item.productType === filter;
    if (!productMatches) return false;
    if (sourceFilter !== "all" && String(item.source || "manual") !== sourceFilter) return false;
    const goal = positionGoal(item);
    if (goalFilter === "all") return true;
    if (goalFilter === "general") return !goal?.goalId;
    return String(goal?.goalId || "") === String(goalFilter);
  }), [filter, goalFilter, sourceFilter, positions]);

  const canBulkClean = false;
  const canAdministerPortfolio = editable && ["super_admin", "admin"].includes(profile?.role);
  const selectedSet = useMemo(() => new Set(selectedPositionIds.map(String)), [selectedPositionIds]);
  const selectedPositions = useMemo(() => positions.filter((item) => selectedSet.has(String(item.id))), [positions, selectedSet]);
  const selectedValue = useMemo(() => selectedPositions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0), [selectedPositions]);

  useEffect(() => {
    const currentIds = new Set(positions.map((item) => String(item.id)));
    setSelectedPositionIds((current) => current.filter((id) => currentIds.has(String(id))));
  }, [positions]);

  function toggleSelection(positionId) {
    setSelectedPositionIds((current) => current.includes(positionId)
      ? current.filter((id) => id !== positionId)
      : [...current, positionId]);
  }

  function selectVisible() {
    setSelectedPositionIds((current) => [...new Set([...current, ...visible.map((item) => item.id)])]);
  }

  function selectAllPortfolio() {
    setSelectedPositionIds(positions.map((item) => item.id));
  }

  function exitManageMode() {
    setManageMode(false);
    setSelectedPositionIds([]);
    setCleanupOpen(false);
  }

  const goalHealth = useMemo(() => {
    const allocatedValue = positions.reduce((sum, position) => {
      const allocated = specificGoalAllocations(position.goalAllocations).reduce((value, item) => value + Math.max(0, Math.min(100, Number(item.percentage || 0))), 0);
      return sum + Number(position.currentValue || 0) * Math.min(100, allocated) / 100;
    }, 0);
    const generalWealthCount = positions.filter((position) => !specificGoalAllocations(position.goalAllocations).length).length;
    return {
      allocatedValue,
      generalWealth: Math.max(0, summary.current - allocatedValue),
      allocationPercentage: summary.current > 0 ? allocatedValue / summary.current * 100 : 0,
      generalWealthCount
    };
  }, [positions, summary.current]);

  const movement = useMemo(() => {
    const serverMovement = snapshot?.intelligence?.movement;
    if (serverMovement?.available) {
      return {
        from: serverMovement.fromDate,
        to: serverMovement.toDate,
        currentValue: Number(serverMovement.closingValue || 0),
        previousValue: Number(serverMovement.openingValue || 0),
        portfolioChange: Number(serverMovement.portfolioChange || 0),
        newMoney: Number(serverMovement.newMoney || 0),
        withdrawals: Number(serverMovement.withdrawals || 0),
        marketMovement: Number(serverMovement.marketMovement || 0),
        realisedPnl: Number(serverMovement.realisedPnl || 0),
        reviewCashFlowCount: Number(serverMovement.reviewCashFlowCount || 0)
      };
    }
    if (!snapshot || !previousSnapshot) return null;
    const from = String(previousSnapshot.snapshotDate || "");
    const to = String(snapshot.snapshotDate || "");
    const related = transactions.filter((item) => {
      const date = String(item.transactionDate || "");
      return date && date > from && date <= to;
    });
    const flows = related.reduce((total, item) => {
      const amount = Math.abs(Number(item.amount || 0));
      const flow = String(item.cashFlowType || "").toLowerCase();
      const type = String(item.transactionType || "").toLowerCase();
      if (flow === "withdrawal" || (!flow && /redemption|withdraw/.test(type))) total.withdrawals += amount;
      else if (flow === "new_money" || (!flow && amount > 0 && !/switch|redemption|withdraw|sell/.test(type))) total.newMoney += amount;
      return total;
    }, { newMoney: 0, withdrawals: 0 });
    const currentValue = Number(snapshot.summary?.currentValue ?? summary.current);
    const previousValue = Number(previousSnapshot.summary?.currentValue || 0);
    const portfolioChange = currentValue - previousValue;
    const marketMovement = portfolioChange - flows.newMoney + flows.withdrawals;
    return { from, to, currentValue, previousValue, portfolioChange, marketMovement, ...flows, realisedPnl: 0, reviewCashFlowCount: 0 };
  }, [previousSnapshot, snapshot, summary.current, transactions]);

  const monthComparison = useMemo(() => {
    if (!snapshot?.snapshotDate) return null;
    const currentMonthKey = String(snapshot.snapshotDate).slice(0, 7);
    const priorMonthSnapshot = snapshots.find((item) => String(item.snapshotDate || "").slice(0, 7) < currentMonthKey) || null;
    if (!priorMonthSnapshot) return null;
    const from = String(priorMonthSnapshot.snapshotDate || "");
    const to = String(snapshot.snapshotDate || "");
    const flows = transactions.filter((item) => {
      const date = String(item.transactionDate || "");
      return date && date > from && date <= to;
    }).reduce((total, item) => {
      const amount = Math.abs(Number(item.amount || 0));
      const flow = String(item.cashFlowType || "").toLowerCase();
      const type = String(item.transactionType || "").toLowerCase();
      if (flow === "withdrawal" || (!flow && /redemption|withdraw/.test(type))) total.withdrawals += amount;
      else if (flow === "new_money" || (!flow && amount > 0 && !/switch|redemption|withdraw|sell/.test(type))) total.newMoney += amount;
      return total;
    }, { newMoney: 0, withdrawals: 0 });
    const openingValue = Number(priorMonthSnapshot.summary?.currentValue || 0);
    const closingValue = Number(snapshot.summary?.currentValue || summary.current || 0);
    const change = closingValue - openingValue;
    return {
      from,
      to,
      openingValue,
      closingValue,
      change,
      changePercentage: openingValue > 0 ? change / openingValue * 100 : 0,
      newMoney: flows.newMoney,
      withdrawals: flows.withdrawals,
      marketMovement: change - flows.newMoney + flows.withdrawals
    };
  }, [snapshot, snapshots, summary.current, transactions]);

  const intelligence = snapshot?.intelligence || null;
  const displayReconciliationStatus = useMemo(() => {
    const storedStatus = intelligence?.status || snapshot?.reconciliationStatus || PORTFOLIO_RECONCILIATION_STATUS.VERIFIED;
    if ([
      PORTFOLIO_RECONCILIATION_STATUS.MISMATCH,
      PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT,
      PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW
    ].includes(storedStatus)) return storedStatus;

    const sources = Array.isArray(snapshot?.sourceFreshness) ? snapshot.sourceFreshness : [];
    const hasMissingSource = sources.some((source) => !source?.valuationDate || Number(source?.missingDateCount || 0) > 0);
    if (hasMissingSource) return PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE;

    const hasStaleSource = sources.some((source) => {
      const age = freshnessAge(source?.oldestValuationDate || source?.valuationDate);
      return age !== null && age > PORTFOLIO_RECONCILIATION_THRESHOLDS.STALE_DAYS;
    });
    if (hasStaleSource) return PORTFOLIO_RECONCILIATION_STATUS.STALE;

    return storedStatus;
  }, [intelligence?.status, snapshot?.reconciliationStatus, snapshot?.sourceFreshness]);

  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
  const monthTrades = useMemo(() => trades.filter((item) => String(item.tradeDate || "").startsWith(currentMonth)), [currentMonth, trades]);
  const tradingSummary = useMemo(() => monthTrades.reduce((total, item) => {
    total.net += Number(item.netPnl || 0);
    total.gross += Number(item.grossPnl || 0);
    total.charges += Number(item.totalCharges || 0);
    if (Number(item.netPnl || 0) > 0) total.wins += 1;
    if (Number(item.netPnl || 0) < 0) total.losses += 1;
    return total;
  }, { net: 0, gross: 0, charges: 0, wins: 0, losses: 0 }), [monthTrades]);

  async function changeGoal(positionId, goalId) {
    setGoalBusyId(positionId);
    setError("");
    try {
      await updatePortfolioGoal(positionId, goalId);
      await loadPortfolio({ quiet: true });
    } catch (nextError) {
      setError(nextError.message || "Unable to update goal allocation.");
    } finally {
      setGoalBusyId("");
    }
  }

  if (loading) return <div className="grid gap-4"><div className="h-32 animate-pulse rounded-xl bg-slate-100" /><div className="h-64 animate-pulse rounded-xl bg-slate-100" /></div>;

  return (
    <>
      {portal ? <MobilePortfolioAppView summary={summary} positions={positions} snapshots={snapshots} snapshot={snapshot} movement={movement} monthComparison={monthComparison} goalHealth={goalHealth} intelligence={intelligence} tradingSummary={tradingSummary} error={error} /> : null}
      <div className={`${portal ? "hidden md:grid" : "grid"} gap-5`}>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Current Portfolio" value={formatCurrency(summary.current)} helper={snapshot?.snapshotDate ? `Verified ${formatDate(snapshot.snapshotDate)}` : "Latest available"} icon={WalletCards} tone="blue" />
        <Stat label="Total Invested" value={formatCurrency(summary.invested)} helper={`${positions.length} active holding${positions.length === 1 ? "" : "s"}`} icon={BadgeIndianRupee} tone="slate" />
        <Stat label="Gain / Loss" value={formatCurrency(summary.gain)} helper={summary.gainPartial ? "Excludes ULIP funds without fund-level cost basis" : summary.invested ? percent(summary.gain / summary.invested * 100) : "—"} icon={summary.gain >= 0 ? TrendingUp : TrendingDown} tone={summary.gain >= 0 ? "green" : "red"} />
        <Stat label="Monthly SIP" value={formatCurrency(summary.monthlySip)} helper="Active mutual fund contribution" icon={RefreshCcw} tone="green" />
      </div>

      {manualAccounts.length ? <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Manual Portfolio Management</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Managed portfolio accounts</h2>
              <p className="mt-1 text-sm text-slate-500">Holdings, cash, realised/unrealised P&amp;L, income, charges and return metrics calculated from the uploaded Manual Portfolio Management workbook.</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><WalletCards size={19} /></span>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 xl:grid-cols-2">
          {manualAccounts.map((account) => {
            const metrics = account.metrics || {};
            const absoluteReturn = metrics.absoluteReturnPercentage;
            const xirrValue = metrics.xirrPercentage;
            return <article key={account.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{account.accountName || account.accountCode || "Manual Portfolio"}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{[account.accountCode, account.strategy, account.provider].filter(Boolean).join(" · ") || "Manual account"}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${String(account.status || "active").toLowerCase() === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{account.status || "active"}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-blue-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-600">Current Value</p><p className="mt-1 text-sm font-black text-blue-950">{formatCurrency(metrics.currentPortfolioValue)}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Invested</p><p className="mt-1 text-sm font-black text-slate-950">{formatCurrency(metrics.investedAmount)}</p></div>
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Cash</p><p className="mt-1 text-sm font-black text-emerald-950">{formatCurrency(metrics.cashBalance)}</p></div>
                <div className="rounded-lg bg-violet-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">XIRR</p><p className="mt-1 text-sm font-black text-violet-950">{Number.isFinite(Number(xirrValue)) ? percent(Number(xirrValue)) : "—"}</p></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <p className="text-slate-500">Unrealised <strong className={Number(metrics.unrealizedGainLoss || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{formatCurrency(metrics.unrealizedGainLoss)}</strong></p>
                <p className="text-slate-500">Realised <strong className={Number(metrics.realizedPnl || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{formatCurrency(metrics.realizedPnl)}</strong></p>
                <p className="text-slate-500">Income <strong className="text-slate-900">{formatCurrency(metrics.incomeTotal)}</strong></p>
                <p className="text-slate-500">Charges <strong className="text-slate-900">{formatCurrency(metrics.chargesTotal)}</strong></p>
                <p className="text-slate-500">Absolute <strong className={Number(absoluteReturn || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{Number.isFinite(Number(absoluteReturn)) ? percent(Number(absoluteReturn)) : "—"}</strong></p>
                <p className="text-slate-500">Records <strong className="text-slate-900">{Number(metrics.holdingCount || 0)} holdings · {Number(metrics.transactionCount || 0)} txns</strong></p>
              </div>
              {account.latestReconciliation ? <div className={`mt-3 flex flex-col justify-between gap-2 rounded-lg border p-3 text-xs sm:flex-row sm:items-center ${String(account.latestReconciliation.status || "").toLowerCase() === "verified" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div><p className="font-bold text-slate-900">Reconciliation · {account.latestReconciliation.reconciliationDate ? formatDate(account.latestReconciliation.reconciliationDate) : "Latest"}</p><p className="mt-1 text-slate-600">Statement {formatCurrency(account.latestReconciliation.statementValue)} · System {formatCurrency(account.latestReconciliation.systemValue)} · Difference {formatCurrency(account.latestReconciliation.difference)}</p></div>
                <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase ${String(account.latestReconciliation.status || "").toLowerCase() === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{account.latestReconciliation.status || "review"}</span>
              </div> : null}
            </article>;
          })}
        </div>
      </Card> : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Portfolio Health</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Where your portfolio stands</h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Layers3 size={19} /></span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Goal allocated</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{goalHealth.allocationPercentage.toFixed(1)}%</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">General wealth</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{formatCurrency(goalHealth.generalWealth)}</p></div>
            <div className="rounded-xl bg-blue-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">General Wealth holdings</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{goalHealth.generalWealthCount}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Data sources</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{snapshot?.sourceFreshness?.length || 0}</p></div>
          </div>
          {snapshot?.sourceFreshness?.length ? <div className="mt-4 flex flex-wrap gap-2">{snapshot.sourceFreshness.map((source) => <SourceFreshnessPill key={source.source} source={source} />)}</div> : null}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Portfolio Movement</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">What changed</h2></div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity size={19} /></span>
          </div>
          {movement ? <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Since</p><p className="mt-1 text-sm font-bold text-slate-900">{formatDate(movement.from)}</p></div>
            <div className={`rounded-xl p-3 ${movement.portfolioChange >= 0 ? "bg-blue-50" : "bg-red-50"}`}><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Portfolio change</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{formatCurrency(movement.portfolioChange)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Fresh investment</p><p className="mt-1 font-heading text-lg font-bold text-emerald-950">{formatCurrency(movement.newMoney)}</p></div>
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Withdrawals</p><p className="mt-1 font-heading text-lg font-bold text-amber-950">{formatCurrency(movement.withdrawals)}</p></div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Market / valuation movement</p><p className={`mt-1 font-heading text-lg font-bold ${movement.marketMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(movement.marketMovement)}</p><p className="mt-1 text-[10px] text-slate-500">Estimated after separating known portfolio cash flows between verified snapshots.</p></div>
          </div> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">A movement comparison will appear after at least two verified daily portfolio snapshots are available.</div>}
        </Card>
      </div>

      {(intelligence || monthComparison) ? <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Portfolio Intelligence</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Changes, concentration and reconciliation</h2>
              <p className="mt-1 text-sm text-slate-500">Portfolio movement is separated from fresh money and withdrawals. Concentration indicators are informational and do not execute or recommend transactions automatically.</p>
            </div>
            <ReconciliationBadge status={displayReconciliationStatus} portal={portal} />
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:p-6">
          {/* Phone-first intelligence hierarchy: one lead movement card, then compact supporting facts. */}
          <div className="grid gap-3 md:hidden">
            <div className="gv-mobile-brand-panel rounded-[20px] border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--gv-blue)]">Monthly movement</p>
                  <p className={`mt-1 font-heading text-2xl font-bold ${Number(monthComparison?.change || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{monthComparison ? formatCurrency(monthComparison.change) : "—"}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{monthComparison ? `${percent(monthComparison.changePercentage)} vs ${formatDate(monthComparison.from)}` : "Available after a previous-month snapshot"}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-[var(--gv-blue)] shadow-sm"><TrendingUp size={17} /></span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="gv-mobile-cyan-soft rounded-[18px] border p-3.5">
                <p className="text-[9px] font-black uppercase tracking-[0.09em] text-[var(--gv-blue)]">Holding changes</p>
                <p className="mt-1.5 font-heading text-lg font-bold text-[var(--gv-ink)]">{Number(intelligence?.counts?.newHoldings || 0)} new · {Number(intelligence?.counts?.exitedHoldings || 0)} exited</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{Number(intelligence?.counts?.partialExits || 0)} partial exit/reduction{Number(intelligence?.counts?.partialExits || 0) === 1 ? "" : "s"}</p>
              </div>
              <div className="gv-mobile-brand-soft rounded-[18px] border p-3.5">
                <p className="text-[9px] font-black uppercase tracking-[0.09em] text-[var(--gv-blue)]">Largest asset class</p>
                <p className="gv-mobile-wrap mt-1.5 font-heading text-lg font-bold leading-tight text-[var(--gv-ink)]">{intelligence?.concentration?.largestAssetClass?.name || "—"}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{intelligence?.concentration?.largestAssetClass ? `${Number(intelligence.concentration.largestAssetClass.percentage || 0).toFixed(1)}% of portfolio` : "No allocation data"}</p>
              </div>
              <div className="col-span-2 rounded-[18px] border border-[var(--gv-border)] bg-white p-3.5">
                <p className="text-[9px] font-black uppercase tracking-[0.09em] text-slate-400">Largest holding</p>
                <p className="gv-mobile-wrap mt-1.5 font-heading text-base font-bold leading-5 text-[var(--gv-ink)]">{intelligence?.concentration?.largestHolding?.instrumentName || "—"}</p>
                <p className="mt-1 text-[11px] text-slate-500">{intelligence?.concentration?.largestHolding ? `${Number(intelligence.concentration.largestHolding.percentage || 0).toFixed(1)}% of portfolio` : "No concentration data"}</p>
              </div>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Month-on-Month</p><p className={`mt-2 font-heading text-xl font-bold ${Number(monthComparison?.change || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{monthComparison ? formatCurrency(monthComparison.change) : "—"}</p><p className="mt-1 text-xs text-slate-500">{monthComparison ? `${percent(monthComparison.changePercentage)} vs ${formatDate(monthComparison.from)}` : "Available after previous-month snapshot"}</p></div>
            <div className="rounded-xl bg-blue-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-600">Holding Changes</p><p className="mt-2 font-heading text-xl font-bold text-blue-950">{Number(intelligence?.counts?.newHoldings || 0)} new · {Number(intelligence?.counts?.exitedHoldings || 0)} exited</p><p className="mt-1 text-xs text-blue-700">{Number(intelligence?.counts?.partialExits || 0)} partial exit/reduction{Number(intelligence?.counts?.partialExits || 0) === 1 ? "" : "s"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Largest Holding</p><p className="mt-2 truncate font-heading text-lg font-bold text-slate-950">{intelligence?.concentration?.largestHolding?.instrumentName || "—"}</p><p className="mt-1 text-xs text-slate-500">{intelligence?.concentration?.largestHolding ? `${Number(intelligence.concentration.largestHolding.percentage || 0).toFixed(1)}% of portfolio` : "No concentration data"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Largest Asset Class</p><p className="mt-2 font-heading text-lg font-bold text-slate-950">{intelligence?.concentration?.largestAssetClass?.name || "—"}</p><p className="mt-1 text-xs text-slate-500">{intelligence?.concentration?.largestAssetClass ? `${Number(intelligence.concentration.largestAssetClass.percentage || 0).toFixed(1)}% of portfolio` : "No allocation data"}</p></div>
          </div>

          {monthComparison ? <div className="grid grid-cols-2 gap-2.5 md:hidden">
            <div className="rounded-[17px] border border-[var(--gv-border)] bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Previous value</p><p className="mt-1 text-sm font-bold text-[var(--gv-ink)]">{formatCurrency(monthComparison.openingValue)}</p></div>
            <div className="gv-mobile-cyan-soft rounded-[17px] border p-3"><p className="text-[9px] font-black uppercase tracking-wide text-[var(--gv-blue)]">Fresh investment</p><p className="mt-1 text-sm font-bold text-[var(--gv-ink)]">{formatCurrency(monthComparison.newMoney)}</p></div>
            <div className="gv-mobile-yellow-soft rounded-[17px] border p-3"><p className="text-[9px] font-black uppercase tracking-wide text-amber-700">Withdrawals</p><p className="mt-1 text-sm font-bold text-[var(--gv-ink)]">{formatCurrency(monthComparison.withdrawals)}</p></div>
            <div className="gv-mobile-brand-soft rounded-[17px] border p-3"><p className="text-[9px] font-black uppercase tracking-wide text-[var(--gv-blue)]">Investment movement</p><p className={`mt-1 text-sm font-bold ${monthComparison.marketMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(monthComparison.marketMovement)}</p></div>
          </div> : null}

          {monthComparison ? <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Previous Month Value</p><p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(monthComparison.openingValue)}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Fresh Investment</p><p className="mt-1 text-sm font-bold text-emerald-950">{formatCurrency(monthComparison.newMoney)}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Withdrawals</p><p className="mt-1 text-sm font-bold text-amber-950">{formatCurrency(monthComparison.withdrawals)}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Investment Movement</p><p className={`mt-1 text-sm font-bold ${monthComparison.marketMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(monthComparison.marketMovement)}</p></div>
          </div> : null}

          {intelligence?.priceMovements?.length ? <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">NAV / Price changes since previous verified snapshot</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {intelligence.priceMovements.slice(0, 6).map((item) => <div key={item.positionId} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="min-w-0"><p className="gv-mobile-wrap text-xs font-bold leading-4 text-slate-900 md:truncate">{item.instrumentName}</p><p className="mt-1 text-[10px] text-slate-500">{item.previousDate ? formatDate(item.previousDate) : "Previous"} → {item.currentDate ? formatDate(item.currentDate) : "Current"}</p></div><div className="shrink-0 text-right"><p className={`text-sm font-black ${Number(item.changePercentage || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{percent(item.changePercentage)}</p><p className="mt-1 text-[10px] text-slate-500">₹{Number(item.currentRate || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p></div></div>)}
            </div>
          </div> : null}

          {!portal && intelligence?.issues?.length ? <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Staff reconciliation notes</p>
            <div className="mt-2 grid gap-2">{intelligence.issues.slice(0, 6).map((item, index) => <p key={`${item.code}-${index}`} className={`text-xs leading-5 ${item.severity === "block" ? "font-semibold text-red-800" : "text-amber-900"}`}><strong>{item.title}:</strong> {item.description}</p>)}</div>
          </div> : null}

          {portal && intelligence && displayReconciliationStatus !== PORTFOLIO_RECONCILIATION_STATUS.VERIFIED ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">GrowVest is reviewing one or more source updates for this portfolio. The latest verified values remain visible; operational reconciliation details are handled by your GrowVest team.</div> : null}
        </div>
      </Card> : null}

      {ulipPolicies.length ? <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">ULIP Policy Tracking</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Policies and underlying funds</h2><p className="mt-1 text-sm text-slate-500">One policy can hold multiple ULIP funds. Policy premium and maturity details are tracked once; NAV, units, value and Goal/Bucket allocation remain fund-specific.</p></div>
        <div className="grid gap-3 p-5">{ulipPolicies.map((policy) => <UlipPolicyCard key={policy.id} policy={policy} funds={positions.filter((item) => item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && String(item.policyNumber || "") === String(policy.policyNumber || ""))} />)}</div>
      </Card> : null}

      {editable && addHolding ? <ManualHoldingForm investor={effectiveInvestor} onClose={() => setAddHolding(false)} onSaved={() => loadPortfolio({ quiet: true })} /> : null}
      {editable && salePosition ? <DeliverySaleForm position={salePosition} onClose={() => setSalePosition(null)} onSaved={() => loadPortfolio({ quiet: true })} /> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Investment Portfolio</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Latest holdings</h2><p className="mt-1 text-sm text-slate-500">See investment type, SIP/Lump Sum mode, latest NAV or market rate, source freshness and the Goal / Bucket List linked to each holding.</p></div>
          {editable ? <div className="flex flex-wrap gap-2">
            {canAdministerPortfolio ? <Link href={`/investors/${effectiveInvestor.id}/portfolio-admin`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Settings2 size={16} /> Portfolio Administration</Link> : null}
            <Button type="button" onClick={() => setAddHolding((value) => !value)}><Plus size={16} /> Add Holding</Button>
          </div> : null}
        </div>
        <div className="p-5">
          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px] xl:items-center">
            <div className="gv-mobile-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">{FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-bold ${filter === value ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className={inputClassName}>
              <option value="all">All Sources</option>
              {availableSources.map((source) => <option key={source} value={source}>{PORTFOLIO_SOURCE_LABELS[source] || source}</option>)}
            </select>
            <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)} className={inputClassName}>
              <option value="all">All Goals / Corpus</option>
              <option value="general">General Wealth (Default)</option>
              {goals.map((goal) => <option key={goal.id || goal.goalId} value={goal.id || goal.goalId}>{goal.name || goal.goalName || "Goal"}</option>)}
            </select>
          </div>

          {manageMode ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Portfolio cleanup mode</p><p className="mt-1 text-sm font-semibold text-slate-900">{selectedPositionIds.length} selected · {formatCurrency(selectedValue)}</p><p className="mt-1 text-xs text-slate-600">Select individual holdings, all currently filtered holdings, or the entire current portfolio. Published reports and Goals/Bucket Lists are preserved.</p></div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={selectVisible} disabled={!visible.length}>Select Visible</Button>
                <Button type="button" variant="secondary" onClick={selectAllPortfolio} disabled={!positions.length}>Select All Portfolio</Button>
                {selectedPositionIds.length ? <Button type="button" variant="secondary" onClick={() => setSelectedPositionIds([])}>Clear Selection</Button> : null}
                <Button type="button" variant="danger" onClick={() => setCleanupOpen(true)} disabled={!selectedPositionIds.length}><Trash2 size={16} /> Delete Selected</Button>
              </div>
            </div>
          </div> : null}

          <div className="grid gap-3">{visible.length ? visible.map((position) => <PositionCard key={position.id} position={position} investor={effectiveInvestor} editable={editable} portal={portal} busyId={goalBusyId} onGoalChange={changeGoal} onSell={setSalePosition} onSipReminder={setSipPosition} selectionMode={manageMode} selected={selectedSet.has(String(position.id))} onToggle={toggleSelection} />) : <EmptyState title="No portfolio holdings" description={portal ? "No holdings match this filter. Your verified portfolio appears here after GrowVest updates the Portfolio Master." : "Import portfolio data or add a holding manually."} />}</div>
        </div>
      </Card>

      {sipPosition ? <SipFundingScheduleDialog open={Boolean(sipPosition)} onClose={() => setSipPosition(null)} investor={effectiveInvestor} position={sipPosition} /> : null}

      {cleanupOpen ? <InvestorPortfolioBulkCleanupDialog
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        onCompleted={() => { setCleanupOpen(false); setManageMode(false); setSelectedPositionIds([]); loadPortfolio({ quiet: true }); }}
        investor={effectiveInvestor}
        positions={positions}
        selectedIds={selectedPositionIds}
      /> : null}

      {transactions.length ? <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Portfolio Activity</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Recent investment changes</h2><p className="mt-1 text-sm text-slate-500">Recent SIP, lump-sum, purchase, redemption and switch activity imported into the Portfolio Master.</p></div>
        <div className="divide-y divide-slate-100">{transactions.slice(0, 8).map((item) => {
          const flow = String(item.cashFlowType || "").toLowerCase();
          const withdrawal = flow === "withdrawal" || /redemption|withdraw/i.test(item.transactionType || "");
          return <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:items-center"><p className="text-xs font-semibold text-slate-500">{item.transactionDate ? formatDate(item.transactionDate) : "—"}</p><div><p className="font-semibold text-slate-900">{item.instrumentName || item.schemeName || "Investment"}</p><p className="mt-1 text-xs text-slate-500">{item.transactionType || item.investmentMode || "Portfolio update"} · {PORTFOLIO_SOURCE_LABELS[item.source] || item.provider || "GrowVest"}</p></div><p className={`font-heading text-sm font-bold ${withdrawal ? "text-amber-700" : flow === "internal" ? "text-slate-600" : "text-emerald-700"}`}>{flow === "internal" ? "Internal switch" : `${withdrawal ? "-" : "+"}${formatCurrency(Math.abs(Number(item.amount || 0)))}`}</p></div>;
        })}</div>
      </Card> : null}

      {editable && addTrade ? <IntradayForm investor={effectiveInvestor} onClose={() => setAddTrade(false)} onSaved={() => loadPortfolio({ quiet: true })} /> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Stock Intraday Trading</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Bajaj Broking trading activity</h2><p className="mt-1 text-sm text-slate-500">Intraday P&L is shown separately and does not automatically count toward Goals or Bucket List corpus.</p></div>
          {editable ? <Button type="button" variant="secondary" onClick={() => setAddTrade((value) => !value)}><CandlestickChart size={16} /> Add Intraday Trade</Button> : null}
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Trades This Month</p><p className="mt-2 font-heading text-xl font-bold text-slate-950">{monthTrades.length}</p></div>
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Gross P&L</p><p className="mt-2 font-heading text-xl font-bold text-emerald-950">{formatCurrency(tradingSummary.gross)}</p></div>
            <div className="rounded-xl bg-amber-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Charges</p><p className="mt-2 font-heading text-xl font-bold text-amber-950">{formatCurrency(tradingSummary.charges)}</p></div>
            <div className={`rounded-xl p-4 ${tradingSummary.net >= 0 ? "bg-blue-50" : "bg-red-50"}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${tradingSummary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>Net Realised P&L</p><p className="mt-2 font-heading text-xl font-bold text-slate-950">{formatCurrency(tradingSummary.net)}</p></div>
          </div>
          {trades.length ? <>
            <div className="grid gap-2.5 sm:hidden">
              {trades.slice(0, 30).map((trade) => <article key={trade.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">{trade.stockName || trade.symbol}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(trade.tradeDate)} · Qty {Number(trade.quantity || 0).toLocaleString("en-IN")}</p></div><p className={`shrink-0 font-heading text-base font-bold ${Number(trade.netPnl || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(trade.netPnl)}</p></div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Buy</p><p className="mt-1 font-semibold text-slate-800">{formatCurrency(trade.buyRate)}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Sell</p><p className="mt-1 font-semibold text-slate-800">{formatCurrency(trade.sellRate)}</p></div><div className="rounded-lg bg-amber-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Charges</p><p className="mt-1 font-semibold text-amber-950">{formatCurrency(trade.totalCharges)}</p></div></div>
              </article>)}
            </div>
            <div className="hidden overflow-x-auto sm:block"><table className="min-w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Buy</th><th className="px-3 py-3 text-right">Sell</th><th className="px-3 py-3 text-right">Charges</th><th className="px-3 py-3 text-right">Net P&L</th></tr></thead><tbody className="divide-y divide-slate-100">{trades.slice(0, 30).map((trade) => <tr key={trade.id}><td className="px-3 py-3 text-slate-600">{formatDate(trade.tradeDate)}</td><td className="px-3 py-3 font-semibold text-slate-900">{trade.stockName || trade.symbol}</td><td className="px-3 py-3 text-right">{Number(trade.quantity || 0).toLocaleString("en-IN")}</td><td className="px-3 py-3 text-right">{formatCurrency(trade.buyRate)}</td><td className="px-3 py-3 text-right">{formatCurrency(trade.sellRate)}</td><td className="px-3 py-3 text-right">{formatCurrency(trade.totalCharges)}</td><td className={`px-3 py-3 text-right font-bold ${Number(trade.netPnl || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(trade.netPnl)}</td></tr>)}</tbody></table></div>
          </> : <EmptyState title="No intraday trades recorded" description="Bajaj Trade Book import will populate this automatically once its exact file format is mapped. Manual entry is available to staff meanwhile." />}
        </div>
      </Card>
      </div>
    </>
  );
}

