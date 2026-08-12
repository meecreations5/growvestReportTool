"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  BadgeIndianRupee,
  CandlestickChart,
  ChevronDown,
  CircleAlert,
  Layers3,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Field, inputClassName } from "@/components/ui/Field";
import { formatCurrency, formatDate } from "@/lib/utils/format";
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
import {
  createManualIntradayTrade,
  createManualPortfolioPosition,
  recordDeliverySale,
  subscribeInvestorPortfolio,
  subscribeInvestorTrading,
  subscribeInvestorUlipPolicies,
  subscribePortfolioSnapshotHistory,
  subscribeRecentInvestmentTransactions,
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
  return PORTFOLIO_PRODUCT_LABELS[position.productType] || "Investment";
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

function PositionCard({ position, investor, editable, portal, busyId, onGoalChange, onSell }) {
  const goal = positionGoal(position);
  const positive = Number(position.gainLoss || 0) >= 0;
  const goals = goalRows(investor);
  const valuationDate = sourceDate(position);
  const navDelta = position.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? navMovement(position) : null;
  const sourceLabel = PORTFOLIO_SOURCE_LABELS[position.source] || position.provider || "GrowVest Portfolio";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
                  <option value="">General Wealth / Unassigned</option>
                  {goals.map((item) => <option key={item.id || item.goalId} value={item.id || item.goalId}>{item.name || item.goalName || "Goal"}</option>)}
                </select>
                {busyId === position.id ? <Loader2 size={15} className="absolute right-9 top-1/2 -translate-y-1/2 animate-spin text-blue-600" /> : <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
              </div>
            </div>
            <p className="text-xs text-slate-500">This assignment is saved on the permanent holding and will carry forward to future portfolio uploads until staff changes it.</p>
            {position.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY && Number(position.quantity || 0) > 0 ? <div className="flex justify-end"><Button type="button" variant="secondary" onClick={() => onSell?.(position)}>Record Delivery Sale</Button></div> : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"><Target size={14} className="text-blue-700" /> {goal?.goalName || "General Wealth Corpus"}</p>
            {portal ? <Link href={`/investor/actions?new=1&requestType=${encodeURIComponent("Discuss Investment")}&positionId=${encodeURIComponent(position.id)}&positionName=${encodeURIComponent(position.instrumentName || "Investment")}`} className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100">Discuss with Advisor</Link> : null}
          </div>
        )}
      </div>
    </article>
  );
}

function DeliverySaleForm({ position, onClose }) {
  const [form, setForm] = useState({ sellDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function save() {
    setBusy(true); setError("");
    try {
      await recordDeliverySale(position.id, form);
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

  return <Card className="border-blue-200 bg-blue-50/20 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Manual portfolio entry</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Add investment holding</h3></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500"><X size={16} /></button></div>{error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Investment type"><select className={inputClassName} value={type} onChange={(event) => { const next = event.target.value; setType(next); setForm((current) => ({ ...current, provider: next === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? "Bajaj Broking" : current.provider })); }}><option value={PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY}>Stock - Delivery</option><option value={PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND}>Mutual Fund</option><option value={PORTFOLIO_PRODUCT_TYPES.ULIP}>ULIP</option><option value={PORTFOLIO_PRODUCT_TYPES.PMS}>PMS</option><option value={PORTFOLIO_PRODUCT_TYPES.BOND}>Bond</option><option value={PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT}>Fixed Deposit</option><option value={PORTFOLIO_PRODUCT_TYPES.GOLD}>Gold</option><option value={PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE}>Real Estate</option><option value={PORTFOLIO_PRODUCT_TYPES.OTHER}>Other</option></select></Field><Field label="Investment / instrument"><input className={inputClassName} value={form.instrumentName || ""} onChange={(e) => set("instrumentName", e.target.value)} /></Field><Field label="Provider"><input className={inputClassName} value={form.provider || ""} onChange={(e) => set("provider", e.target.value)} /></Field><Field label="Goal / Corpus"><select className={inputClassName} value={form.goalId || ""} onChange={(e) => set("goalId", e.target.value)}><option value="">General Wealth / Unassigned</option>{goals.map((goal) => <option key={goal.id || goal.goalId} value={goal.id || goal.goalId}>{goal.name || goal.goalName}</option>)}</select></Field>
      {type === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? <><Field label="Symbol"><input className={inputClassName} value={form.symbol || ""} onChange={(e) => set("symbol", e.target.value)} /></Field><Field label="Exchange"><select className={inputClassName} value={form.exchange || "NSE"} onChange={(e) => set("exchange", e.target.value)}><option>NSE</option><option>BSE</option></select></Field><Field label="Buy / Avg Rate"><input type="number" className={inputClassName} value={form.averageBuyRate || ""} onChange={(e) => set("averageBuyRate", e.target.value)} /></Field><Field label="Quantity"><input type="number" className={inputClassName} value={form.quantity || ""} onChange={(e) => set("quantity", e.target.value)} /></Field><Field label="Current Rate"><input type="number" className={inputClassName} value={form.currentRate || ""} onChange={(e) => set("currentRate", e.target.value)} /></Field><Field label="Price Date"><input type="date" className={inputClassName} value={form.priceDate || ""} onChange={(e) => set("priceDate", e.target.value)} /></Field></> : null}
      {type === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? <><Field label="Investment mode"><select className={inputClassName} value={form.investmentMode || "SIP"} onChange={(e) => set("investmentMode", e.target.value)}>{MUTUAL_FUND_INVESTMENT_MODES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="ISIN"><input className={inputClassName} value={form.isin || ""} onChange={(e) => set("isin", e.target.value)} /></Field><Field label="Folio"><input className={inputClassName} value={form.folioNo || ""} onChange={(e) => set("folioNo", e.target.value)} /></Field><Field label="Total Invested"><input type="number" className={inputClassName} value={form.totalInvested || ""} onChange={(e) => set("totalInvested", e.target.value)} /></Field><Field label="Units"><input type="number" step="0.0001" className={inputClassName} value={form.totalUnits || ""} onChange={(e) => set("totalUnits", e.target.value)} /></Field><Field label="Current NAV"><input type="number" step="0.0001" className={inputClassName} value={form.currentNav || ""} onChange={(e) => set("currentNav", e.target.value)} /></Field><Field label="NAV Date"><input type="date" className={inputClassName} value={form.navDate || ""} onChange={(e) => set("navDate", e.target.value)} /></Field><Field label="Monthly SIP"><input type="number" className={inputClassName} value={form.monthlySip || ""} onChange={(e) => set("monthlySip", e.target.value)} /></Field></> : null}
      {type === PORTFOLIO_PRODUCT_TYPES.ULIP ? <><Field label="Insurance Company"><input className={inputClassName} value={form.insurer || form.provider || ""} onChange={(e) => { set("insurer", e.target.value); set("provider", e.target.value); }} /></Field><Field label="Policy Number"><input className={inputClassName} value={form.policyNumber || ""} onChange={(e) => set("policyNumber", e.target.value)} /></Field><Field label="Plan Name"><input className={inputClassName} value={form.planName || ""} onChange={(e) => set("planName", e.target.value)} /></Field><Field label="Fund Name"><input className={inputClassName} value={form.fundName || ""} onChange={(e) => { set("fundName", e.target.value); if (!form.instrumentName) set("instrumentName", e.target.value); }} /></Field><Field label="Fund Code"><input className={inputClassName} value={form.fundCode || ""} onChange={(e) => set("fundCode", e.target.value)} /></Field><Field label="Policy Start Date"><input type="date" className={inputClassName} value={form.policyStartDate || ""} onChange={(e) => set("policyStartDate", e.target.value)} /></Field><Field label="Units"><input type="number" step="0.0001" className={inputClassName} value={form.totalUnits || ""} onChange={(e) => set("totalUnits", e.target.value)} /></Field><Field label="NAV"><input type="number" step="0.0001" className={inputClassName} value={form.currentNav || ""} onChange={(e) => set("currentNav", e.target.value)} /></Field><Field label="NAV Date"><input type="date" className={inputClassName} value={form.navDate || ""} onChange={(e) => set("navDate", e.target.value)} /></Field><Field label="Total Premium Paid"><input type="number" className={inputClassName} value={form.policyTotalPremiumPaid || ""} onChange={(e) => set("policyTotalPremiumPaid", e.target.value)} /></Field><Field label="Premium Amount"><input type="number" className={inputClassName} value={form.premiumAmount || ""} onChange={(e) => set("premiumAmount", e.target.value)} /></Field><Field label="Premium Frequency"><select className={inputClassName} value={form.premiumFrequency || ""} onChange={(e) => set("premiumFrequency", e.target.value)}><option value="">Select</option><option>Monthly</option><option>Quarterly</option><option>Half-Yearly</option><option>Annual</option><option>Single</option></select></Field><Field label="Maturity Date"><input type="date" className={inputClassName} value={form.maturityDate || ""} onChange={(e) => set("maturityDate", e.target.value)} /></Field><Field label="Sum Assured"><input type="number" className={inputClassName} value={form.sumAssured || ""} onChange={(e) => set("sumAssured", e.target.value)} /></Field></> : null}
      {![PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY, PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(type) ? <><Field label="Asset Class"><input className={inputClassName} value={form.assetClass || ""} onChange={(e) => set("assetClass", e.target.value)} placeholder="Equity, Debt, Gold, Real Estate…" /></Field><Field label="Invested Amount"><input type="number" className={inputClassName} value={form.totalInvested || ""} onChange={(e) => set("totalInvested", e.target.value)} /></Field><Field label="Current Value"><input type="number" className={inputClassName} value={form.currentValue || ""} onChange={(e) => set("currentValue", e.target.value)} /></Field><Field label="Valuation Date"><input type="date" className={inputClassName} value={form.valuationDate || ""} onChange={(e) => set("valuationDate", e.target.value)} /></Field></> : null}
    </div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save Holding</Button></div></Card>;
}

function IntradayForm({ investor, onClose }) {
  const [form, setForm] = useState({ provider: "Bajaj Broking", exchange: "NSE", tradeDate: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function save() { setBusy(true); setError(""); try { await createManualIntradayTrade({ investorId: investor.id, ...form }); onClose(); } catch (nextError) { setError(nextError.message || "Unable to save trade."); } finally { setBusy(false); } }
  return <Card className="border-amber-200 bg-amber-50/20 p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Bajaj Broking</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Add closed intraday trade</h3></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white"><X size={16} /></button></div>{error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Trade Date"><input type="date" className={inputClassName} value={form.tradeDate} onChange={(e) => set("tradeDate", e.target.value)} /></Field><Field label="Stock"><input className={inputClassName} value={form.stockName || ""} onChange={(e) => set("stockName", e.target.value)} /></Field><Field label="Symbol"><input className={inputClassName} value={form.symbol || ""} onChange={(e) => set("symbol", e.target.value)} /></Field><Field label="Quantity"><input type="number" className={inputClassName} value={form.quantity || ""} onChange={(e) => set("quantity", e.target.value)} /></Field><Field label="Buy Rate"><input type="number" className={inputClassName} value={form.buyRate || ""} onChange={(e) => set("buyRate", e.target.value)} /></Field><Field label="Sell Rate"><input type="number" className={inputClassName} value={form.sellRate || ""} onChange={(e) => set("sellRate", e.target.value)} /></Field><Field label="Brokerage"><input type="number" className={inputClassName} value={form.brokerage || ""} onChange={(e) => set("brokerage", e.target.value)} /></Field><Field label="STT"><input type="number" className={inputClassName} value={form.stt || ""} onChange={(e) => set("stt", e.target.value)} /></Field><Field label="Exchange Charges"><input type="number" className={inputClassName} value={form.exchangeCharges || ""} onChange={(e) => set("exchangeCharges", e.target.value)} /></Field><Field label="GST"><input type="number" className={inputClassName} value={form.gst || ""} onChange={(e) => set("gst", e.target.value)} /></Field><Field label="Stamp Duty"><input type="number" className={inputClassName} value={form.stampDuty || ""} onChange={(e) => set("stampDuty", e.target.value)} /></Field><Field label="Other Charges"><input type="number" className={inputClassName} value={form.otherCharges || ""} onChange={(e) => set("otherCharges", e.target.value)} /></Field></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save Trade</Button></div></Card>;
}

export default function InvestorPortfolioPanel({ investor, editable = false, portal = false }) {
  const { profile } = useAuth();
  const [positions, setPositions] = useState([]);
  const [ulipPolicies, setUlipPolicies] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState("all");
  const [goalBusyId, setGoalBusyId] = useState("");
  const [addHolding, setAddHolding] = useState(false);
  const [addTrade, setAddTrade] = useState(false);
  const [salePosition, setSalePosition] = useState(null);

  useEffect(() => subscribeInvestorPortfolio(
    investor?.id,
    profile,
    (items) => { setPositions(items); setLoading(false); },
    (nextError) => { console.error(nextError); setError("Unable to load portfolio positions."); setLoading(false); }
  ), [investor?.id, profile]);

  useEffect(() => subscribeInvestorUlipPolicies(
    investor?.id,
    profile,
    setUlipPolicies,
    (nextError) => console.error("Unable to load ULIP policies", nextError)
  ), [investor?.id, profile]);

  useEffect(() => subscribePortfolioSnapshotHistory(
    investor?.id,
    profile,
    setSnapshots,
    (nextError) => console.error("Unable to load portfolio snapshot history", nextError),
    70
  ), [investor?.id, profile]);

  useEffect(() => subscribeRecentInvestmentTransactions(
    investor?.id,
    profile,
    setTransactions,
    (nextError) => console.error("Unable to load portfolio transaction history", nextError),
    300
  ), [investor?.id, profile]);

  useEffect(() => subscribeInvestorTrading(
    investor?.id,
    profile,
    setTrades,
    (nextError) => console.error("Unable to load trading history", nextError)
  ), [investor?.id, profile]);

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
    const gain = positions.reduce((sum, item) => {
      if (item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && item.gainLossAvailable === false) return sum;
      return sum + Number(item.gainLoss || 0);
    }, 0);
    const gainPartial = positions.some((item) => item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && item.gainLossAvailable === false);
    const monthlySip = positions.reduce((sum, item) => sum + Number(item.monthlySip || 0), 0);
    return { current, invested, gain, gainPartial, monthlySip };
  }, [positions, ulipPolicies]);

  const goals = useMemo(() => goalRows(investor), [investor]);
  const visible = useMemo(() => positions.filter((item) => {
    const productMatches = filter === "all"
      ? true
      : filter === "other"
        ? ![PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(item.productType)
        : item.productType === filter;
    if (!productMatches) return false;
    const goal = positionGoal(item);
    if (goalFilter === "all") return true;
    if (goalFilter === "general") return !goal?.goalId;
    return String(goal?.goalId || "") === String(goalFilter);
  }), [filter, goalFilter, positions]);

  const goalHealth = useMemo(() => {
    const allocatedValue = positions.reduce((sum, position) => {
      const allocated = (position.goalAllocations || []).reduce((value, item) => value + Math.max(0, Math.min(100, Number(item.percentage || 0))), 0);
      return sum + Number(position.currentValue || 0) * Math.min(100, allocated) / 100;
    }, 0);
    const unassignedCount = positions.filter((position) => !positionGoal(position)?.goalId).length;
    return {
      allocatedValue,
      generalWealth: Math.max(0, summary.current - allocatedValue),
      allocationPercentage: summary.current > 0 ? allocatedValue / summary.current * 100 : 0,
      unassignedCount
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
    } catch (nextError) {
      setError(nextError.message || "Unable to update goal allocation.");
    } finally {
      setGoalBusyId("");
    }
  }

  if (loading) return <div className="grid gap-4"><div className="h-32 animate-pulse rounded-xl bg-slate-100" /><div className="h-64 animate-pulse rounded-xl bg-slate-100" /></div>;

  return (
    <div className="grid gap-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Current Portfolio" value={formatCurrency(summary.current)} helper={snapshot?.snapshotDate ? `Verified ${formatDate(snapshot.snapshotDate)}` : "Latest available"} icon={WalletCards} tone="blue" />
        <Stat label="Total Invested" value={formatCurrency(summary.invested)} helper={`${positions.length} active holding${positions.length === 1 ? "" : "s"}`} icon={BadgeIndianRupee} tone="slate" />
        <Stat label="Gain / Loss" value={formatCurrency(summary.gain)} helper={summary.gainPartial ? "Excludes ULIP funds without fund-level cost basis" : summary.invested ? percent(summary.gain / summary.invested * 100) : "—"} icon={summary.gain >= 0 ? TrendingUp : TrendingDown} tone={summary.gain >= 0 ? "green" : "red"} />
        <Stat label="Monthly SIP" value={formatCurrency(summary.monthlySip)} helper="Active mutual fund contribution" icon={RefreshCcw} tone="green" />
      </div>

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
            <div className={`rounded-xl p-3 ${goalHealth.unassignedCount ? "bg-amber-50" : "bg-emerald-50"}`}><p className={`text-[9px] font-bold uppercase tracking-wide ${goalHealth.unassignedCount ? "text-amber-700" : "text-emerald-700"}`}>Unassigned holdings</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{goalHealth.unassignedCount}</p></div>
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
        <div className="grid gap-4 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Month-on-Month</p><p className={`mt-2 font-heading text-xl font-bold ${Number(monthComparison?.change || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{monthComparison ? formatCurrency(monthComparison.change) : "—"}</p><p className="mt-1 text-xs text-slate-500">{monthComparison ? `${percent(monthComparison.changePercentage)} vs ${formatDate(monthComparison.from)}` : "Available after previous-month snapshot"}</p></div>
            <div className="rounded-xl bg-blue-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-600">Holding Changes</p><p className="mt-2 font-heading text-xl font-bold text-blue-950">{Number(intelligence?.counts?.newHoldings || 0)} new · {Number(intelligence?.counts?.exitedHoldings || 0)} exited</p><p className="mt-1 text-xs text-blue-700">{Number(intelligence?.counts?.partialExits || 0)} partial exit/reduction{Number(intelligence?.counts?.partialExits || 0) === 1 ? "" : "s"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Largest Holding</p><p className="mt-2 truncate font-heading text-lg font-bold text-slate-950">{intelligence?.concentration?.largestHolding?.instrumentName || "—"}</p><p className="mt-1 text-xs text-slate-500">{intelligence?.concentration?.largestHolding ? `${Number(intelligence.concentration.largestHolding.percentage || 0).toFixed(1)}% of portfolio` : "No concentration data"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Largest Asset Class</p><p className="mt-2 font-heading text-lg font-bold text-slate-950">{intelligence?.concentration?.largestAssetClass?.name || "—"}</p><p className="mt-1 text-xs text-slate-500">{intelligence?.concentration?.largestAssetClass ? `${Number(intelligence.concentration.largestAssetClass.percentage || 0).toFixed(1)}% of portfolio` : "No allocation data"}</p></div>
          </div>

          {monthComparison ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Previous Month Value</p><p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(monthComparison.openingValue)}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Fresh Investment</p><p className="mt-1 text-sm font-bold text-emerald-950">{formatCurrency(monthComparison.newMoney)}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Withdrawals</p><p className="mt-1 text-sm font-bold text-amber-950">{formatCurrency(monthComparison.withdrawals)}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Investment Movement</p><p className={`mt-1 text-sm font-bold ${monthComparison.marketMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(monthComparison.marketMovement)}</p></div>
          </div> : null}

          {intelligence?.priceMovements?.length ? <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">NAV / Price changes since previous verified snapshot</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {intelligence.priceMovements.slice(0, 6).map((item) => <div key={item.positionId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{item.instrumentName}</p><p className="mt-1 text-[10px] text-slate-500">{item.previousDate ? formatDate(item.previousDate) : "Previous"} → {item.currentDate ? formatDate(item.currentDate) : "Current"}</p></div><div className="text-right"><p className={`text-sm font-black ${Number(item.changePercentage || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{percent(item.changePercentage)}</p><p className="mt-1 text-[10px] text-slate-500">₹{Number(item.currentRate || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p></div></div>)}
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

      {editable && addHolding ? <ManualHoldingForm investor={investor} onClose={() => setAddHolding(false)} /> : null}
      {editable && salePosition ? <DeliverySaleForm position={salePosition} onClose={() => setSalePosition(null)} /> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Investment Portfolio</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Latest holdings</h2><p className="mt-1 text-sm text-slate-500">See investment type, SIP/Lump Sum mode, latest NAV or market rate, source freshness and the Goal / Bucket List linked to each holding.</p></div>
          {editable ? <Button type="button" onClick={() => setAddHolding((value) => !value)}><Plus size={16} /> Add Holding</Button> : null}
        </div>
        <div className="p-5">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
            <div className="flex flex-wrap gap-2">{FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 rounded-full px-3 text-xs font-bold ${filter === value ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div>
            <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)} className={inputClassName}>
              <option value="all">All Goals / Corpus</option>
              <option value="general">General Wealth / Unassigned</option>
              {goals.map((goal) => <option key={goal.id || goal.goalId} value={goal.id || goal.goalId}>{goal.name || goal.goalName || "Goal"}</option>)}
            </select>
          </div>
          <div className="grid gap-3">{visible.length ? visible.map((position) => <PositionCard key={position.id} position={position} investor={investor} editable={editable} portal={portal} busyId={goalBusyId} onGoalChange={changeGoal} onSell={setSalePosition} />) : <EmptyState title="No portfolio holdings" description={portal ? "No holdings match this filter. Your verified portfolio appears here after GrowVest updates the Portfolio Master." : "Import portfolio data or add a holding manually."} />}</div>
        </div>
      </Card>

      {transactions.length ? <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Portfolio Activity</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Recent investment changes</h2><p className="mt-1 text-sm text-slate-500">Recent SIP, lump-sum, purchase, redemption and switch activity imported into the Portfolio Master.</p></div>
        <div className="divide-y divide-slate-100">{transactions.slice(0, 8).map((item) => {
          const flow = String(item.cashFlowType || "").toLowerCase();
          const withdrawal = flow === "withdrawal" || /redemption|withdraw/i.test(item.transactionType || "");
          return <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:items-center"><p className="text-xs font-semibold text-slate-500">{item.transactionDate ? formatDate(item.transactionDate) : "—"}</p><div><p className="font-semibold text-slate-900">{item.instrumentName || item.schemeName || "Investment"}</p><p className="mt-1 text-xs text-slate-500">{item.transactionType || item.investmentMode || "Portfolio update"} · {PORTFOLIO_SOURCE_LABELS[item.source] || item.provider || "GrowVest"}</p></div><p className={`font-heading text-sm font-bold ${withdrawal ? "text-amber-700" : flow === "internal" ? "text-slate-600" : "text-emerald-700"}`}>{flow === "internal" ? "Internal switch" : `${withdrawal ? "-" : "+"}${formatCurrency(Math.abs(Number(item.amount || 0)))}`}</p></div>;
        })}</div>
      </Card> : null}

      {editable && addTrade ? <IntradayForm investor={investor} onClose={() => setAddTrade(false)} /> : null}

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
          {trades.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Buy</th><th className="px-3 py-3 text-right">Sell</th><th className="px-3 py-3 text-right">Charges</th><th className="px-3 py-3 text-right">Net P&L</th></tr></thead><tbody className="divide-y divide-slate-100">{trades.slice(0, 30).map((trade) => <tr key={trade.id}><td className="px-3 py-3 text-slate-600">{formatDate(trade.tradeDate)}</td><td className="px-3 py-3 font-semibold text-slate-900">{trade.stockName || trade.symbol}</td><td className="px-3 py-3 text-right">{Number(trade.quantity || 0).toLocaleString("en-IN")}</td><td className="px-3 py-3 text-right">{formatCurrency(trade.buyRate)}</td><td className="px-3 py-3 text-right">{formatCurrency(trade.sellRate)}</td><td className="px-3 py-3 text-right">{formatCurrency(trade.totalCharges)}</td><td className={`px-3 py-3 text-right font-bold ${Number(trade.netPnl || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(trade.netPnl)}</td></tr>)}</tbody></table></div> : <EmptyState title="No intraday trades recorded" description="Bajaj Trade Book import will populate this automatically once its exact file format is mapped. Manual entry is available to staff meanwhile." />}
        </div>
      </Card>
    </div>
  );
}

