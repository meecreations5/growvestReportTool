"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CandlestickChart,
  ExternalLink,
  Loader2,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import InvestorPortfolioBulkCleanupDialog from "@/components/portfolio/InvestorPortfolioBulkCleanupDialog";
import ManualPortfolioExcelPanel from "@/components/portfolio/ManualPortfolioExcelPanel";
import { subscribeInvestor } from "@/services/assessmentService";
import {
  deleteInvestorPortfolioHoldings,
  deleteInvestorTrading,
  fullPortfolioReset,
  previewFullPortfolioReset,
  previewInvestorPortfolioCleanup,
  previewInvestorTradingCleanup,
  subscribeInvestorPortfolio,
  subscribeInvestorTrading
} from "@/services/portfolioService";
import {
  PORTFOLIO_ADMIN_SCOPES,
  PORTFOLIO_ADMIN_SCOPE_LABELS,
  PORTFOLIO_PRODUCT_LABELS,
  PORTFOLIO_SOURCE_LABELS,
  portfolioAdministrationScope
} from "@/lib/constants/portfolio";
import { formatCurrency } from "@/lib/utils/format";
import { inputClassName } from "@/components/ui/Field";
import { ADMIN_ROLES } from "@/lib/constants/roles";

const HOLDING_SCOPE_KEYS = [
  PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR,
  PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY,
  PORTFOLIO_ADMIN_SCOPES.BROKER_DELIVERY,
  PORTFOLIO_ADMIN_SCOPES.ULIP,
  PORTFOLIO_ADMIN_SCOPES.MANUAL,
  PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER
];

function instrumentName(position = {}) {
  return position.instrumentName
    || position.schemeName
    || position.stockName
    || position.fundName
    || position.symbol
    || "Investment";
}

function GroupCard({ title, helper, positions, onDelete }) {
  const value = positions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  return <Card className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Portfolio Type</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{positions.length} holding{positions.length === 1 ? "" : "s"}</span></div><p className="mt-4 font-heading text-2xl font-bold text-slate-950">{formatCurrency(value)}</p><div className="mt-4 flex justify-end"><Button type="button" variant="danger" onClick={() => onDelete(positions)} disabled={!positions.length}><Trash2 size={15} /> Delete All</Button></div></Card>;
}

function HoldingRow({ item, checked, onToggle }) {
  const scope = portfolioAdministrationScope(item);
  return <label className={`grid cursor-pointer gap-3 rounded-xl border p-3 sm:grid-cols-[24px_minmax(0,1fr)_150px_150px] sm:items-center ${checked ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(item.id)} className="h-4 w-4 rounded border-slate-300 text-red-600" />
    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">{instrumentName(item)}</p><p className="mt-0.5 text-[11px] text-slate-500">{PORTFOLIO_PRODUCT_LABELS[item.productType] || item.productType || "Other"} · {PORTFOLIO_SOURCE_LABELS[item.source] || item.source || "Manual"}</p></div>
    <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Cleanup Group</p><p className="mt-1 text-xs font-bold text-slate-700">{PORTFOLIO_ADMIN_SCOPE_LABELS[scope] || "Other"}</p></div>
    <div className="sm:text-right"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Current Value</p><p className="mt-1 text-sm font-black text-slate-950">{formatCurrency(item.currentValue)}</p></div>
  </label>;
}

export default function InvestorPortfolioAdministration({ investorId }) {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [holdingScopeFilter, setHoldingScopeFilter] = useState("all");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [tradingDialog, setTradingDialog] = useState(false);
  const [tradingPreview, setTradingPreview] = useState(null);
  const [tradingReason, setTradingReason] = useState("");
  const [tradingConfirm, setTradingConfirm] = useState("");
  const [tradingBusy, setTradingBusy] = useState(false);
  const [fullDialog, setFullDialog] = useState(false);
  const [fullPreview, setFullPreview] = useState(null);
  const [fullReason, setFullReason] = useState("");
  const [fullConfirm, setFullConfirm] = useState("");
  const [fullBusy, setFullBusy] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);
  const [resetPreview, setResetPreview] = useState(null);
  const [resetStatus, setResetStatus] = useState(null);
  const [resetReason, setResetReason] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!investorId || !profile?.id) return undefined;
    const u1 = subscribeInvestor(investorId, setInvestor, (e) => setError(e.message));
    const u2 = subscribeInvestorPortfolio(investorId, profile, (rows) => { setPositions(rows); setLoading(false); }, (e) => { setError(e.message); setLoading(false); });
    const u3 = subscribeInvestorTrading(investorId, profile, setTrades, (e) => setError(e.message));
    return () => { u1?.(); u2?.(); u3?.(); };
  }, [investorId, profile]);

  useEffect(() => {
    const ids = new Set(positions.map((item) => String(item.id)));
    setSelected((current) => current.filter((id) => ids.has(String(id))));
  }, [positions]);

  useEffect(() => {
    if (!investorId || profile?.role !== "super_admin") return undefined;
    let active = true;
    previewFullPortfolioReset(investorId)
      .then((result) => { if (active) setResetStatus(result?.preview || null); })
      .catch((nextError) => { if (active) setError(nextError?.message || "Unable to load Full Portfolio Reset status."); });
    return () => { active = false; };
  }, [investorId, profile?.role]);

  const groups = useMemo(() => {
    const result = Object.fromEntries(HOLDING_SCOPE_KEYS.map((scope) => [scope, []]));
    positions.forEach((item) => {
      const scope = portfolioAdministrationScope(item);
      (result[scope] || result[PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER]).push(item);
    });
    return result;
  }, [positions]);

  const visiblePositions = useMemo(() => {
    const term = holdingSearch.trim().toLowerCase();
    return positions.filter((item) => {
      const scope = portfolioAdministrationScope(item);
      if (holdingScopeFilter !== "all" && scope !== holdingScopeFilter) return false;
      if (!term) return true;
      return `${instrumentName(item)} ${item.folioNo || ""} ${item.policyNumber || ""} ${item.symbol || ""}`.toLowerCase().includes(term);
    });
  }, [positions, holdingScopeFilter, holdingSearch]);

  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);
  const selectedValue = useMemo(() => positions.filter((item) => selectedSet.has(String(item.id))).reduce((sum, item) => sum + Number(item.currentValue || 0), 0), [positions, selectedSet]);
  const allVisibleSelected = visiblePositions.length > 0 && visiblePositions.every((item) => selectedSet.has(String(item.id)));

  function deleteGroup(rows) {
    setSelected(rows.map((item) => item.id));
    setCleanupOpen(true);
  }

  function toggleHolding(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visiblePositions.map((item) => String(item.id)));
      setSelected((current) => current.filter((id) => !visibleIds.has(String(id))));
      return;
    }
    setSelected((current) => [...new Set([...current, ...visiblePositions.map((item) => item.id)])]);
  }

  async function openTradingDelete() {
    setTradingBusy(true); setError("");
    try { const result = await previewInvestorTradingCleanup(investorId); setTradingPreview(result.preview); setTradingDialog(true); }
    catch (e) { setError(e.message); }
    finally { setTradingBusy(false); }
  }

  async function confirmTradingDelete() {
    setTradingBusy(true); setError("");
    try { await deleteInvestorTrading(investorId, tradingReason, tradingConfirm); setTradingDialog(false); setTradingReason(""); setTradingConfirm(""); }
    catch (e) { setError(e.message); }
    finally { setTradingBusy(false); }
  }

  async function openFullDelete() {
    setFullBusy(true); setError("");
    try {
      const [holdingResult, tradingResult] = await Promise.all([
        positions.length ? previewInvestorPortfolioCleanup(investorId, positions.map((item) => item.id), "imported") : Promise.resolve(null),
        trades.length ? previewInvestorTradingCleanup(investorId) : Promise.resolve(null)
      ]);
      setFullPreview({
        holdings: Number(holdingResult?.preview?.selected?.count || 0),
        transactions: Number(holdingResult?.preview?.transactions?.total || 0),
        currentValue: Number(holdingResult?.preview?.selected?.currentValue || 0),
        trades: Number(tradingResult?.preview?.trades || 0),
        summaries: Number(tradingResult?.preview?.summaries || 0)
      });
      setFullDialog(true);
    } catch (e) { setError(e.message); }
    finally { setFullBusy(false); }
  }

  async function confirmFullDelete() {
    setFullBusy(true); setError("");
    const cleanupBatchId = `portfolio_cleanup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      if (positions.length) {
        await deleteInvestorPortfolioHoldings(investorId, {
          positionIds: positions.map((item) => item.id),
          transactionsMode: "imported",
          reason: fullReason,
          confirmation: fullConfirm,
          cleanupBatchId,
          cleanupScopes: [PORTFOLIO_ADMIN_SCOPES.ENTIRE]
        });
      }
      if (trades.length) {
        await deleteInvestorTrading(investorId, fullReason, fullConfirm, {
          cleanupBatchId,
          cleanupScopes: [PORTFOLIO_ADMIN_SCOPES.ENTIRE]
        });
      }
      setFullDialog(false); setFullPreview(null); setFullReason(""); setFullConfirm(""); setSelected([]);
    } catch (e) { setError(e.message); }
    finally { setFullBusy(false); }
  }

  async function openFullReset() {
    setResetBusy(true); setError(""); setResetSuccess("");
    try {
      const result = await previewFullPortfolioReset(investorId);
      setResetPreview(result?.preview || null);
      setResetStatus(result?.preview || null);
      setResetReason("");
      setResetConfirm("");
      setResetDialog(true);
    } catch (e) { setError(e.message); }
    finally { setResetBusy(false); }
  }

  async function confirmFullReset() {
    setResetBusy(true); setError("");
    try {
      const result = await fullPortfolioReset(investorId, resetReason, resetConfirm);
      setResetDialog(false);
      setResetPreview(null);
      setResetReason("");
      setResetConfirm("");
      setSelected([]);
      setResetStatus({
        currentValue: 0,
        counts: result?.removed || {},
        hasResettableData: false,
        state: result?.state || {
          portfolioStatus: "no_portfolio_data",
          lastUpdate: null,
          dailyUpdate: "not_started",
          fundbazaarMapping: "not_mapped",
          importHistory: "no_imports",
          snapshots: "no_snapshots",
          trading: "no_trading_data"
        }
      });
      setResetSuccess("Full Portfolio Reset completed. The next portfolio upload will start as this investor's first portfolio upload.");
    } catch (e) { setError(e.message); }
    finally { setResetBusy(false); }
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (!ADMIN_ROLES.includes(profile?.role)) return <EmptyState title="Admin access required" description="Portfolio Administration is restricted to Super Admin and Admin users." />;
  if (!investor) return <EmptyState title="Investor not found" description="Return to Investors and select a valid investor profile." />;

  return <div className="grid gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/investors/${investorId}`} className="inline-flex items-center gap-1 text-sm font-bold text-blue-700"><ArrowLeft size={16} /> Back to Investor</Link><Link href="/portfolio/administration" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Central Portfolio Administration <ExternalLink size={14} /></Link></div>
    <PageHeader eyebrow="Portfolio administration" title={`${investor.fullName || "Investor"} · Portfolio Management`} description="Manage this investor in detail: delete a complete portfolio category, select individual holdings for cleanup, clean trading records separately, or upload the Manual Portfolio Excel." />
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
    {resetSuccess ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{resetSuccess}</div> : null}

    {profile?.role === "super_admin" && resetStatus ? <Card className="p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Portfolio status</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Current operational state</h2><p className="mt-1 text-sm leading-6 text-slate-500">Published Monthly Reports remain historical documents and are not used as the current Portfolio Master.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{resetStatus.state?.portfolioStatus === "no_portfolio_data" ? "No portfolio data" : "Portfolio data available"}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">{[["Portfolio Status", resetStatus.state?.portfolioStatus === "no_portfolio_data" ? "No portfolio data" : "Portfolio data available"], ["Last Update", resetStatus.state?.lastUpdate ? "Available" : "Never"], ["Daily Update", resetStatus.state?.dailyUpdate === "not_started" ? "Not started" : "Configured"], ["Fundbazaar Mapping", resetStatus.state?.fundbazaarMapping === "not_mapped" ? "Not mapped" : "Mapped"], ["Import History", resetStatus.state?.importHistory === "no_imports" ? "No imports" : "Available"], ["Snapshots", resetStatus.state?.snapshots === "no_snapshots" ? "No snapshots" : "Snapshots available"], ["Trading", resetStatus.state?.trading === "no_trading_data" ? "No trading data" : "Trading available"]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-950">{value}</p></div>)}</div></Card> : null}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <GroupCard title="Fundbazaar" helper="Mutual Fund holdings imported from Client Wise Valuation." positions={groups[PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR]} onDelete={deleteGroup} />
      <GroupCard title="Bajaj Delivery" helper="Long-term delivery stock holdings. Trading remains separate." positions={groups[PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY]} onDelete={deleteGroup} />
      <GroupCard title="Broker Delivery" helper="Delivery holdings from supported broker accounts such as Angel One. DP movement and intraday activity remain separate." positions={groups[PORTFOLIO_ADMIN_SCOPES.BROKER_DELIVERY]} onDelete={deleteGroup} />
      <Card className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Portfolio Type</p><h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Trading / Intraday</h3><p className="mt-1 text-xs leading-5 text-slate-500">Intraday trades and monthly trading summaries. These do not automatically form Goal/Bucket corpus.</p></div><CandlestickChart size={20} className="text-amber-700" /></div><p className="mt-4 font-heading text-2xl font-bold text-slate-950">{trades.length} trade{trades.length === 1 ? "" : "s"}</p><div className="mt-4 flex justify-end"><Button type="button" variant="danger" onClick={openTradingDelete} disabled={!trades.length || tradingBusy}><Trash2 size={15} /> Delete All Trading</Button></div></Card>
      <GroupCard title="ULIP" helper="Provider-imported ULIP policy/fund positions. Manual ULIP entries remain under Manual Portfolio." positions={groups[PORTFOLIO_ADMIN_SCOPES.ULIP]} onDelete={deleteGroup} />
      <GroupCard title="Manual Portfolio" helper="All holdings maintained directly by GrowVest staff through Manual Portfolio, regardless of investment type." positions={groups[PORTFOLIO_ADMIN_SCOPES.MANUAL]} onDelete={deleteGroup} />
      <GroupCard title="Generic / Other" helper="Other supported provider/import holdings that do not belong to the categories above." positions={groups[PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER]} onDelete={deleteGroup} />
    </section>

    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Holding-level cleanup</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Select multiple investments</h2><p className="mt-1 text-sm text-slate-500">Use this when only some holdings are wrong. Category-level Delete All buttons above remain the faster option for a complete source/type cleanup.</p></div><div className="rounded-xl bg-slate-50 px-3 py-2 text-right"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Selected</p><p className="text-sm font-black text-slate-950">{selected.length} · {formatCurrency(selectedValue)}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-9`} value={holdingSearch} onChange={(event) => setHoldingSearch(event.target.value)} placeholder="Search investment, folio, policy or symbol" /></label><select className={inputClassName} value={holdingScopeFilter} onChange={(event) => setHoldingScopeFilter(event.target.value)}><option value="all">All Holding Types</option>{HOLDING_SCOPE_KEYS.map((scope) => <option key={scope} value={scope}>{PORTFOLIO_ADMIN_SCOPE_LABELS[scope]}</option>)}</select><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={toggleVisible} disabled={!visiblePositions.length}>{allVisibleSelected ? "Unselect Visible" : "Select Visible"}</Button><Button type="button" variant="secondary" size="sm" onClick={() => setSelected(positions.map((item) => item.id))} disabled={!positions.length}>Select All Holdings</Button></div></div></div>
      <div className="grid gap-2 p-5">{visiblePositions.length ? visiblePositions.map((item) => <HoldingRow key={item.id} item={item} checked={selectedSet.has(String(item.id))} onToggle={toggleHolding} />) : <EmptyState title="No matching holdings" description="Change the holding filter or search term." />}</div>
      <div className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-slate-600">Published reports, investor profile, KYC, documents and Goal/Bucket definitions remain preserved. Goal corpus is recalculated after cleanup.</p><div className="flex shrink-0 flex-wrap gap-2">{selected.length ? <Button type="button" variant="secondary" onClick={() => setSelected([])}>Clear Selection</Button> : null}<Button type="button" variant="danger" onClick={() => setCleanupOpen(true)} disabled={!selected.length}><Trash2 size={16} /> Delete Selected</Button></div></div>
    </Card>

    <Card className="border-amber-200 bg-amber-50/30 p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Controlled cleanup</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Delete current portfolio data</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Normal cleanup removes the current holdings and Trading / Intraday data while retaining historical import/audit information and creating a corrected current snapshot. Use this only when history should remain.</p></div><Button type="button" variant="danger" onClick={openFullDelete} disabled={fullBusy || (!positions.length && !trades.length)}>{fullBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete Current Portfolio</Button></div></Card>

    {profile?.role === "super_admin" ? <Card className="border-red-300 bg-red-50 p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Super Admin · irreversible</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Full Portfolio Reset</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">Returns this investor to a first-ever-upload state. It removes current holdings, transactions, snapshots, imports, recovery journals, fingerprints, provider mappings, trading, SIP portfolio workflows and portfolio-specific internal history. Goal definitions and published Monthly Reports remain preserved.</p></div><Button type="button" variant="danger" onClick={openFullReset} disabled={resetBusy || resetStatus?.hasResettableData === false}>{resetBusy ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} Full Portfolio Reset</Button></div></Card> : null}

    <ManualPortfolioExcelPanel investorId={investorId} />

    {cleanupOpen ? <InvestorPortfolioBulkCleanupDialog open={cleanupOpen} onClose={() => setCleanupOpen(false)} onCompleted={() => { setCleanupOpen(false); setSelected([]); }} investor={investor} positions={positions} selectedIds={selected} /> : null}
    {fullDialog ? <div className="fixed inset-0 z-[180] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0" onClick={() => fullBusy ? null : setFullDialog(false)} /><section className="relative z-10 w-full max-w-2xl rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-red-700" /><div><p className="text-[10px] font-bold uppercase tracking-wide text-red-700">Controlled portfolio cleanup</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Delete current portfolio data</h2><p className="mt-2 text-sm leading-6 text-slate-500">{fullPreview?.holdings || 0} holding(s), {fullPreview?.transactions || 0} related imported transaction(s), {fullPreview?.trades || 0} trading record(s) and {fullPreview?.summaries || 0} trading summary record(s) will be removed. Current holding value affected: {formatCurrency(fullPreview?.currentValue)}.</p></div></div><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Published Monthly Reports stay frozen. GrowVest will create a corrected current snapshot and retain the cleanup/import history. Use Full Portfolio Reset instead when the investor must start completely fresh.</div><div className="mt-5 grid gap-4"><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Reason</span><textarea rows={3} className={inputClassName} value={fullReason} onChange={(e) => setFullReason(e.target.value)} /></label><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Type DELETE</span><input className={inputClassName} value={fullConfirm} onChange={(e) => setFullConfirm(e.target.value)} /></label></div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFullDialog(false)} disabled={fullBusy}>Cancel</Button><Button type="button" variant="danger" onClick={confirmFullDelete} disabled={fullBusy || fullReason.trim().length < 5 || fullConfirm.trim().toUpperCase() !== "DELETE"}>{fullBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete Current Portfolio</Button></div></section></div> : null}
    {resetDialog ? <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0" onClick={() => resetBusy ? null : setResetDialog(false)} /><section className="relative z-10 max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800"><ShieldAlert size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">Full Portfolio Reset · permanent</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Start this investor's portfolio from zero</h2><p className="mt-2 text-sm leading-6 text-slate-600">After this reset, GrowVest will treat the next upload as the first-ever portfolio upload for this investor. No corrected snapshot is created.</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Holdings", resetPreview?.counts?.holdings || 0], ["Transactions", resetPreview?.counts?.transactions || 0], ["Snapshots", resetPreview?.counts?.snapshots || 0], ["Imports", resetPreview?.counts?.importFiles || 0], ["Mappings", resetPreview?.counts?.mappings || 0], ["Fingerprints", resetPreview?.counts?.fingerprints || 0], ["Trading / Broker", (resetPreview?.counts?.tradingRecords || 0) + (resetPreview?.counts?.tradingSummaries || 0) + (resetPreview?.counts?.brokerAccounts || 0) + (resetPreview?.counts?.brokerAccountSnapshots || 0) + (resetPreview?.counts?.brokerDpTransactions || 0)], ["Recovery", (resetPreview?.counts?.recoveryJournals || 0) + (resetPreview?.counts?.recoveryItems || 0)], ["SIP workflow", (resetPreview?.counts?.sipSchedules || 0) + (resetPreview?.counts?.sipCycles || 0)], ["Portfolio history", resetPreview?.counts?.portfolioHistory || 0], ["Linked actions", resetPreview?.counts?.linkedActions || 0], ["Total records", resetPreview?.counts?.totalResetRecords || 0]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>)}</div><div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-900"><strong>Preserved:</strong> investor profile, KYC, documents, DOB, Advisor assignment, family information, meetings, Goal/Bucket List definitions and published Monthly Reports. Old holding-to-goal allocations are removed with the old holdings. Published reports stay frozen and do not repopulate the new Portfolio Master.</div><div className="mt-5 grid gap-4"><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Reset reason <span className="text-red-600">*</span></span><textarea rows={3} className={inputClassName} value={resetReason} onChange={(e) => setResetReason(e.target.value)} placeholder="Example: Rebuilding the investor portfolio from verified source files after test/incorrect history." /></label><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Type RESET PORTFOLIO <span className="text-red-600">*</span></span><input className={inputClassName} value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="RESET PORTFOLIO" autoComplete="off" /></label></div><div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="secondary" onClick={() => setResetDialog(false)} disabled={resetBusy}>Cancel</Button><Button type="button" variant="danger" onClick={confirmFullReset} disabled={resetBusy || resetReason.trim().length < 5 || resetConfirm.trim().toUpperCase() !== "RESET PORTFOLIO"}>{resetBusy ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} Permanently Reset Portfolio</Button></div></section></div> : null}
    {tradingDialog ? <div className="fixed inset-0 z-[170] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0" onClick={() => setTradingDialog(false)} /><section className="relative z-10 w-full max-w-xl rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start gap-3"><ShieldAlert className="text-red-700" /><div><p className="text-[10px] font-bold uppercase tracking-wide text-red-700">Trading cleanup</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Delete all trading records</h2><p className="mt-2 text-sm text-slate-500">{tradingPreview?.trades || 0} trade(s) and {tradingPreview?.summaries || 0} monthly summary record(s) will be removed. Long-term portfolio holdings remain untouched.</p></div></div><div className="mt-5 grid gap-4"><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Reason</span><textarea rows={3} className={inputClassName} value={tradingReason} onChange={(e) => setTradingReason(e.target.value)} /></label><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Type DELETE</span><input className={inputClassName} value={tradingConfirm} onChange={(e) => setTradingConfirm(e.target.value)} /></label></div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setTradingDialog(false)}>Cancel</Button><Button type="button" variant="danger" onClick={confirmTradingDelete} disabled={tradingBusy || tradingReason.trim().length < 5 || tradingConfirm.trim().toUpperCase() !== "DELETE"}>{tradingBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete Trading</Button></div></section></div> : null}
  </div>;
}
