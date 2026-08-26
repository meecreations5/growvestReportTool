"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CandlestickChart,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2,
  UsersRound,
  WalletCards,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import BulkManualPortfolioExcelPanel from "@/components/portfolio/BulkManualPortfolioExcelPanel";
import PageHeader from "@/components/ui/PageHeader";
import { inputClassName } from "@/components/ui/Field";
import { ADMIN_ROLES } from "@/lib/constants/roles";
import {
  PORTFOLIO_ADMIN_SCOPES,
  PORTFOLIO_ADMIN_SCOPE_LABELS
} from "@/lib/constants/portfolio";
import { formatCurrency } from "@/lib/utils/format";
import {
  bulkFullPortfolioReset,
  deleteInvestorPortfolioHoldings,
  deleteInvestorTrading,
  getPortfolioAdministrationSummary,
  previewBulkFullPortfolioReset,
  previewInvestorPortfolioCleanup,
  previewInvestorTradingCleanup
} from "@/services/portfolioService";

const MAX_BULK_INVESTORS = 50;
const MAX_BULK_FULL_RESET = 25;

const POSITION_SCOPE_KEYS = [
  PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR,
  PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY,
  PORTFOLIO_ADMIN_SCOPES.BROKER_DELIVERY,
  PORTFOLIO_ADMIN_SCOPES.ULIP,
  PORTFOLIO_ADMIN_SCOPES.MANUAL,
  PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER
];

const DELETE_SCOPE_OPTIONS = [
  ...POSITION_SCOPE_KEYS,
  PORTFOLIO_ADMIN_SCOPES.TRADING,
  PORTFOLIO_ADMIN_SCOPES.ENTIRE
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function positionIdsFor(row, selectedScopes) {
  const keys = selectedScopes.includes(PORTFOLIO_ADMIN_SCOPES.ENTIRE)
    ? POSITION_SCOPE_KEYS
    : selectedScopes.filter((scope) => POSITION_SCOPE_KEYS.includes(scope));
  return unique(keys.flatMap((scope) => row?.scopes?.[scope]?.positionIds || []));
}

function includesTrading(selectedScopes) {
  return selectedScopes.includes(PORTFOLIO_ADMIN_SCOPES.ENTIRE)
    || selectedScopes.includes(PORTFOLIO_ADMIN_SCOPES.TRADING);
}

function scopeCount(row, scope) {
  if (scope === PORTFOLIO_ADMIN_SCOPES.TRADING) return Number(row?.tradeCount || 0);
  return Number(row?.scopes?.[scope]?.count || 0);
}

function scopeValue(row, scope) {
  if (scope === PORTFOLIO_ADMIN_SCOPES.TRADING) return Number(row?.tradingNetPnl || 0);
  return Number(row?.scopes?.[scope]?.currentValue || 0);
}

function makeBatchId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `portfolio_cleanup_${crypto.randomUUID()}`;
  }
  return `portfolio_cleanup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function Metric({ label, value, helper, icon: Icon }) {
  return <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 font-heading text-2xl font-bold text-slate-950">{value}</p>{helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}</div>{Icon ? <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon size={18} /></span> : null}</div></Card>;
}

function ScopeChip({ row, scope }) {
  const count = scopeCount(row, scope);
  if (!count) return null;
  const trading = scope === PORTFOLIO_ADMIN_SCOPES.TRADING;
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600"><span>{PORTFOLIO_ADMIN_SCOPE_LABELS[scope]}</span><span className="text-slate-400">{count}</span>{trading ? null : <span className="text-slate-400">· {formatCurrency(scopeValue(row, scope))}</span>}</span>;
}

function PreviewDialog({ open, busy, preview, reason, confirmation, onReason, onConfirmation, onClose, onDelete, result }) {
  if (!open) return null;
  const totals = preview?.totals || {};
  return <div className="fixed inset-0 z-[190] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Delete portfolio data for selected investors">
    <button type="button" className="absolute inset-0" onClick={busy ? undefined : onClose} aria-label="Close" />
    <section className="relative z-10 max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><ShieldAlert size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">Central Portfolio Administration</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Bulk portfolio deletion preview</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">This operation affects only the selected investors and selected portfolio categories. Investor profiles, KYC, documents, Goals/Bucket Lists, meetings, Advisor Follow-ups, Service Requests, published Monthly Reports and unrelated portfolio categories remain protected.</p></div></div><button type="button" onClick={onClose} disabled={Boolean(busy)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X size={16} /></button></div>

      {result ? <div className={`mt-5 rounded-xl border p-4 ${result.failed ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-start gap-3">{result.failed ? <AlertTriangle className="mt-0.5 text-amber-700" size={20} /> : <CheckCircle2 className="mt-0.5 text-emerald-700" size={20} />}<div><p className="font-bold text-slate-950">{result.failed ? "Bulk cleanup completed with exceptions" : "Bulk cleanup completed"}</p><p className="mt-1 text-sm leading-6 text-slate-700">{result.completed} investor(s) processed successfully. {result.failed ? `${result.failed} investor(s) need review.` : "All selected investor operations were completed."}</p>{result.errors?.length ? <div className="mt-2 grid gap-1">{result.errors.map((item) => <p key={item.investorId} className="text-xs font-semibold text-red-700">{item.name}: {item.error}</p>)}</div> : null}</div></div></div> : null}

      {busy === "preview" ? <div className="mt-5 flex min-h-36 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600"><Loader2 className="mr-2 animate-spin" size={17} /> Building a fresh impact preview for every selected investor...</div> : preview ? <div className="mt-5 grid gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Investors</p><p className="mt-1 text-lg font-black text-slate-950">{totals.investors || 0}</p></div>
          <div className="rounded-xl bg-red-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-red-600">Holdings</p><p className="mt-1 text-lg font-black text-red-950">{totals.holdings || 0}</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Transactions</p><p className="mt-1 text-lg font-black text-amber-950">{totals.transactions || 0}</p></div>
          <div className="rounded-xl bg-violet-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">Trading Records</p><p className="mt-1 text-lg font-black text-violet-950">{totals.trades || 0}</p></div>
          <div className="rounded-xl bg-blue-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Current Value</p><p className="mt-1 text-lg font-black text-blue-950">{formatCurrency(totals.currentValue)}</p></div>
        </div>

        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Affected investors</p><div className="grid max-h-72 gap-2 overflow-y-auto pr-1">{preview.details.map((item) => <div key={item.investorId} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-slate-950">{item.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.clientCode || "No client code"}</p></div><div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600"><span>{item.holdings} holding(s)</span><span>·</span><span>{item.transactions} transaction(s)</span>{item.trades ? <><span>·</span><span>{item.trades} trade(s)</span></> : null}<span>·</span><span>{formatCurrency(item.currentValue)}</span></div></div></div>)}</div></div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600"><strong>After deletion:</strong> GrowVest recalculates each affected investor's current portfolio, Goal/Bucket corpus and corrected latest snapshot. Historical audit records and already-published Monthly Reports are retained. Exact-file locks are released only where the existing cleanup engine determines the related import is fully removed.</div>

        {!result ? <><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Deletion reason <span className="text-red-600">*</span></span><textarea rows={3} className={inputClassName} value={reason} onChange={(event) => onReason(event.target.value)} placeholder="Example: Removing incorrect test portfolio data before re-importing the verified files." disabled={busy === "delete"} /></label><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Type DELETE to confirm <span className="text-red-600">*</span></span><input className={inputClassName} value={confirmation} onChange={(event) => onConfirmation(event.target.value)} placeholder="DELETE" autoComplete="off" disabled={busy === "delete"} /></label></> : null}
      </div> : null}

      <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="secondary" onClick={onClose} disabled={Boolean(busy)}>Close</Button>{preview && !result ? <Button type="button" variant="danger" onClick={onDelete} disabled={busy === "delete" || reason.trim().length < 5 || confirmation.trim().toUpperCase() !== "DELETE"}>{busy === "delete" ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Delete Selected Portfolio Data</Button> : null}</div>
    </section>
  </div>;
}

function FullResetDialog({ open, busy, preview, reason, confirmation, onReason, onConfirmation, onClose, onReset, result }) {
  if (!open) return null;
  const totals = preview?.totals || {};
  const expectedConfirmation = preview?.expectedConfirmation || "";
  const tradingTotal = Number(totals.tradingRecords || 0) + Number(totals.tradingSummaries || 0) + Number(totals.brokerAccounts || 0) + Number(totals.brokerAccountSnapshots || 0) + Number(totals.brokerDpTransactions || 0);
  const recoveryTotal = Number(totals.recoveryJournals || 0) + Number(totals.recoveryItems || 0);
  const sipTotal = Number(totals.sipSchedules || 0) + Number(totals.sipCycles || 0);

  return <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Full Portfolio Reset for selected investors">
    <button type="button" className="absolute inset-0" onClick={busy ? undefined : onClose} aria-label="Close" />
    <section className="relative z-10 max-h-[94dvh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800"><ShieldAlert size={20} /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">Full Portfolio Reset · Super Admin only</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Return selected investors to first-ever upload state</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">This is not normal cleanup. It permanently removes portfolio operational data and portfolio-specific internal history so the next upload starts from zero. No corrected snapshot or reset-history record is created.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} disabled={Boolean(busy)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X size={16} /></button>
      </div>

      {result ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-emerald-700" size={20} /><div><p className="font-bold text-emerald-950">Full Portfolio Reset completed</p><p className="mt-1 text-sm leading-6 text-emerald-900">{result.results?.length || preview?.details?.length || 0} investor(s) are now in a blank portfolio state. Their next portfolio upload will be treated as the first upload.</p></div></div></div> : null}

      {busy === "full_preview" ? <div className="mt-5 flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600"><Loader2 className="mr-2 animate-spin" size={17} /> Building permanent-reset impact preview...</div> : preview ? <div className="mt-5 grid gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Investors", totals.investors || 0],
            ["Holdings", totals.holdings || 0],
            ["Transactions", totals.transactions || 0],
            ["Snapshots", totals.snapshots || 0],
            ["Import files", totals.importFiles || 0],
            ["Import batches", totals.importBatches || 0],
            ["Mappings", totals.mappings || 0],
            ["Fingerprints", totals.fingerprints || 0],
            ["Trading", tradingTotal],
            ["Recovery", recoveryTotal],
            ["SIP workflow", sipTotal],
            ["Internal history", totals.portfolioHistory || 0]
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{Number(value || 0).toLocaleString("en-IN")}</p></div>)}
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-900"><strong>Permanent reset includes:</strong> current holdings, transactions, Fundbazaar/Bajaj/ULIP/manual/generic portfolio records, trading, snapshots, investor-specific import history, recovery journals, fingerprints, provider mappings, daily tracking state, linked SIP workflow records, linked portfolio actions/service requests/notifications and portfolio-specific internal activity history.</div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><strong>Preserved:</strong> investor profile, KYC, documents, DOB, Advisor assignment, family information, meetings, Goal/Bucket List definitions and published Monthly Reports. Old holding-to-goal allocations disappear with the deleted holdings. Published reports remain frozen historical documents and do not become the new Portfolio Master.</div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Selected investors</p><p className="text-[10px] font-bold text-red-700">{Number(totals.totalResetRecords || 0).toLocaleString("en-IN")} resettable record(s)</p></div>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">{preview.details.map((item) => {
            const counts = item.counts || {};
            const itemTrading = Number(counts.tradingRecords || 0) + Number(counts.tradingSummaries || 0) + Number(counts.brokerAccounts || 0) + Number(counts.brokerAccountSnapshots || 0) + Number(counts.brokerDpTransactions || 0);
            return <div key={item.investorId} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-start"><div><p className="text-sm font-bold text-slate-950">{item.investorName}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.clientCode || "No client code"} · Current value {formatCurrency(item.currentValue)}</p></div><div className="flex max-w-2xl flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-600"><span>{counts.holdings || 0} holdings</span><span>·</span><span>{counts.transactions || 0} transactions</span><span>·</span><span>{counts.snapshots || 0} snapshots</span><span>·</span><span>{counts.importFiles || 0} imports</span><span>·</span><span>{counts.mappings || 0} mappings</span><span>·</span><span>{itemTrading} trading</span></div></div></div>;
          })}</div>
        </div>

        {!result ? <div className="grid gap-4"><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Reset reason <span className="text-red-600">*</span></span><textarea rows={3} className={inputClassName} value={reason} onChange={(event) => onReason(event.target.value)} placeholder="Example: Rebuilding selected investor portfolios from verified source files after incorrect/test history." disabled={busy === "full_reset"} /></label><label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Type {expectedConfirmation} <span className="text-red-600">*</span></span><input className={inputClassName} value={confirmation} onChange={(event) => onConfirmation(event.target.value)} placeholder={expectedConfirmation} autoComplete="off" disabled={busy === "full_reset"} /></label></div> : null}
      </div> : null}

      <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="secondary" onClick={onClose} disabled={Boolean(busy)}>Close</Button>{preview && !result ? <Button type="button" variant="danger" onClick={onReset} disabled={busy === "full_reset" || reason.trim().length < 5 || confirmation.trim().toUpperCase() !== expectedConfirmation}>{busy === "full_reset" ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />} Full Portfolio Reset</Button> : null}</div>
    </section>
  </div>;
}

export default function CentralPortfolioAdministration() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ investors: 0, holdings: 0, currentValue: 0, trades: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [viewScope, setViewScope] = useState("all");
  const [selectedInvestorIds, setSelectedInvestorIds] = useState([]);
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState(null);
  const [fullResetOpen, setFullResetOpen] = useState(false);
  const [fullResetPreview, setFullResetPreview] = useState(null);
  const [fullResetReason, setFullResetReason] = useState("");
  const [fullResetConfirmation, setFullResetConfirmation] = useState("");
  const [fullResetResult, setFullResetResult] = useState(null);

  const canAdminister = ADMIN_ROLES.includes(profile?.role);
  const canFullReset = profile?.role === "super_admin";

  async function load({ quiet = false } = {}) {
    if (!canAdminister) {
      setLoading(false);
      return;
    }
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const payload = await getPortfolioAdministrationSummary();
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotals(payload.totals || { investors: 0, holdings: 0, currentValue: 0, trades: 0 });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load Portfolio Administration.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!canAdminister) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    getPortfolioAdministrationSummary()
      .then((payload) => {
        if (!active) return;
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setTotals(payload.totals || { investors: 0, holdings: 0, currentValue: 0, trades: 0 });
      })
      .catch((nextError) => {
        if (active) setError(nextError?.message || "Unable to load Portfolio Administration.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canAdminister]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (term && !`${row.fullName || ""} ${row.clientCode || ""}`.toLowerCase().includes(term)) return false;
      if (viewScope === "all") return true;
      return scopeCount(row, viewScope) > 0;
    });
  }, [rows, search, viewScope]);

  const selectedSet = useMemo(() => new Set(selectedInvestorIds.map(String)), [selectedInvestorIds]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedSet.has(String(row.id))), [rows, selectedSet]);
  const selectedPortfolioValue = useMemo(() => selectedRows.reduce((sum, row) => sum + Number(row.currentValue || 0), 0), [selectedRows]);
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedSet.has(String(row.id)));

  useEffect(() => {
    const currentIds = new Set(rows.map((row) => String(row.id)));
    setSelectedInvestorIds((current) => current.filter((id) => currentIds.has(String(id))));
  }, [rows]);

  function toggleInvestor(id) {
    setSelectedInvestorIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredRows.map((row) => String(row.id)));
      setSelectedInvestorIds((current) => current.filter((id) => !visibleIds.has(String(id))));
      return;
    }
    setSelectedInvestorIds((current) => unique([...current, ...filteredRows.map((row) => row.id)]));
  }

  function toggleDeleteScope(scope) {
    setPreview(null);
    setResult(null);
    setConfirmation("");
    setSelectedScopes((current) => {
      if (scope === PORTFOLIO_ADMIN_SCOPES.ENTIRE) {
        return current.includes(scope) ? [] : [scope];
      }
      const withoutEntire = current.filter((item) => item !== PORTFOLIO_ADMIN_SCOPES.ENTIRE);
      return withoutEntire.includes(scope) ? withoutEntire.filter((item) => item !== scope) : [...withoutEntire, scope];
    });
  }

  async function buildPreview() {
    if (!selectedRows.length) { setError("Select at least one investor."); return; }
    if (selectedRows.length > MAX_BULK_INVESTORS) { setError(`You can clean up to ${MAX_BULK_INVESTORS} investors in one audited batch. Reduce the selection and try again.`); return; }
    if (!selectedScopes.length) { setError("Select at least one portfolio category to delete."); return; }
    setError("");
    setBusy("preview");
    setPreviewOpen(true);
    setPreview(null);
    setResult(null);
    setReason("");
    setConfirmation("");
    try {
      const details = await Promise.all(selectedRows.map(async (row) => {
        const positionIds = positionIdsFor(row, selectedScopes);
        const wantsTrading = includesTrading(selectedScopes) && Number(row.tradeCount || 0) > 0;
        const [holdingResult, tradingResult] = await Promise.all([
          positionIds.length ? previewInvestorPortfolioCleanup(row.id, positionIds, "imported") : Promise.resolve(null),
          wantsTrading ? previewInvestorTradingCleanup(row.id) : Promise.resolve(null)
        ]);
        return {
          investorId: row.id,
          name: row.fullName || "Investor",
          clientCode: row.clientCode || "",
          positionIds,
          deleteTrading: wantsTrading,
          holdings: Number(holdingResult?.preview?.selected?.count || 0),
          transactions: Number(holdingResult?.preview?.transactions?.total || 0),
          currentValue: Number(holdingResult?.preview?.selected?.currentValue || 0),
          trades: Number(tradingResult?.preview?.trades || 0),
          tradingSummaries: Number(tradingResult?.preview?.summaries || 0)
        };
      }));
      const affected = details.filter((item) => item.holdings > 0 || item.trades > 0);
      if (!affected.length) throw new Error("The selected portfolio categories contain no data for the selected investors.");
      const nextTotals = affected.reduce((total, item) => {
        total.investors += 1;
        total.holdings += item.holdings;
        total.transactions += item.transactions;
        total.trades += item.trades;
        total.currentValue += item.currentValue;
        return total;
      }, { investors: 0, holdings: 0, transactions: 0, trades: 0, currentValue: 0 });
      nextTotals.currentValue = Number(nextTotals.currentValue.toFixed(2));
      setPreview({ details: affected, totals: nextTotals, scopes: [...selectedScopes] });
    } catch (nextError) {
      setError(nextError?.message || "Unable to preview the selected portfolio cleanup.");
      setPreviewOpen(false);
    } finally {
      setBusy("");
    }
  }

  async function executeDelete() {
    if (!preview?.details?.length) return;
    setBusy("delete");
    const cleanupBatchId = makeBatchId();
    const errors = [];
    let completed = 0;
    for (const item of preview.details) {
      try {
        if (item.positionIds.length) {
          await deleteInvestorPortfolioHoldings(item.investorId, {
            positionIds: item.positionIds,
            transactionsMode: "imported",
            reason,
            confirmation,
            cleanupBatchId,
            cleanupScopes: preview.scopes
          });
        }
        if (item.deleteTrading) {
          await deleteInvestorTrading(item.investorId, reason, confirmation, {
            cleanupBatchId,
            cleanupScopes: preview.scopes
          });
        }
        completed += 1;
      } catch (nextError) {
        errors.push({ investorId: item.investorId, name: item.name, error: nextError?.message || "Cleanup failed." });
      }
    }
    setResult({ completed, failed: errors.length, errors, cleanupBatchId });
    setBusy("");
    await load({ quiet: true });
    if (!errors.length) setSelectedInvestorIds([]);
  }

  async function buildFullResetPreview() {
    if (!canFullReset) { setError("Full Portfolio Reset is restricted to Super Admin users."); return; }
    if (!selectedRows.length) { setError("Select at least one investor."); return; }
    if (selectedRows.length > MAX_BULK_FULL_RESET) { setError(`You can fully reset up to ${MAX_BULK_FULL_RESET} investors at a time. Reduce the selection and try again.`); return; }
    setError("");
    setBusy("full_preview");
    setFullResetOpen(true);
    setFullResetPreview(null);
    setFullResetResult(null);
    setFullResetReason("");
    setFullResetConfirmation("");
    try {
      const payload = await previewBulkFullPortfolioReset(selectedRows.map((row) => row.id));
      setFullResetPreview(payload);
    } catch (nextError) {
      setError(nextError?.message || "Unable to preview Full Portfolio Reset.");
      setFullResetOpen(false);
    } finally {
      setBusy("");
    }
  }

  async function executeFullReset() {
    if (!fullResetPreview?.details?.length) return;
    setBusy("full_reset");
    setError("");
    try {
      const payload = await bulkFullPortfolioReset(
        fullResetPreview.details.map((item) => item.investorId),
        fullResetReason,
        fullResetConfirmation
      );
      setFullResetResult(payload);
      await load({ quiet: true });
      setSelectedInvestorIds([]);
    } catch (nextError) {
      setError(nextError?.message || "Full Portfolio Reset failed.");
    } finally {
      setBusy("");
    }
  }

  if (!profile) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (!canAdminister) return <EmptyState title="Admin access required" description="Central Portfolio Administration is restricted to Super Admin and Admin users." />;

  return <div className="grid gap-6">
    <PageHeader eyebrow="Portfolio management" title="Portfolio Administration" description="Upload Manual Portfolio holdings for multiple investors in one Excel, or select investors for controlled cleanup and Full Portfolio Reset with audited previews." action={<><Link href="/portfolio/daily-update" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Daily Portfolio Update</Link><Button type="button" variant="secondary" onClick={() => load({ quiet: true })} disabled={refreshing}>{refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} Refresh</Button></>} />

    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Portfolio Administration Investors" value={totals.investors || 0} helper="Live data and/or resettable history" icon={UsersRound} />
      <Metric label="Current Holdings" value={Number(totals.holdings || 0).toLocaleString("en-IN")} helper="Across all investors" icon={WalletCards} />
      <Metric label="Current Portfolio Value" value={formatCurrency(totals.currentValue)} helper="Trading P&L excluded" icon={WalletCards} />
      <Metric label="Trading Records" value={Number(totals.trades || 0).toLocaleString("en-IN")} helper="Tracked separately from goal corpus" icon={CandlestickChart} />
    </div>

    <BulkManualPortfolioExcelPanel onImported={() => load({ quiet: true })} />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Investor selection</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Choose investors to manage</h2></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={toggleAllVisible} disabled={!filteredRows.length}>{allVisibleSelected ? "Unselect Visible" : "Select Visible"}</Button>{selectedInvestorIds.length ? <Button type="button" variant="quiet" size="sm" onClick={() => setSelectedInvestorIds([])}>Clear</Button> : null}</div></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]"><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investor or client code" /></label><select className={inputClassName} value={viewScope} onChange={(event) => setViewScope(event.target.value)}><option value="all">All Portfolio Types</option>{[...POSITION_SCOPE_KEYS, PORTFOLIO_ADMIN_SCOPES.TRADING].map((scope) => <option key={scope} value={scope}>{PORTFOLIO_ADMIN_SCOPE_LABELS[scope]}</option>)}</select></div></div>

        {loading ? <div className="grid min-h-72 place-items-center text-sm font-semibold text-slate-500"><Loader2 className="mr-2 animate-spin" /> Loading investor portfolio inventory...</div> : filteredRows.length ? <div className="divide-y divide-slate-100">{filteredRows.map((row) => { const checked = selectedSet.has(String(row.id)); return <div key={row.id} className={`p-4 sm:p-5 ${checked ? "bg-blue-50/40" : "bg-white"}`}><div className="flex items-start gap-3"><label className="mt-1 grid h-5 w-5 shrink-0 place-items-center"><input type="checkbox" checked={checked} onChange={() => toggleInvestor(row.id)} className="h-4 w-4 rounded border-slate-300 text-blue-700" aria-label={`Select ${row.fullName}`} /></label><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-2 md:flex-row md:items-start"><div><p className="font-bold text-slate-950">{row.fullName}</p><p className="mt-0.5 text-xs text-slate-500">{row.clientCode || "No client code"} · {row.holdingCount || 0} holding(s) · {formatCurrency(row.currentValue)}</p>{row.historyCount ? <p className="mt-1 text-[11px] font-semibold text-amber-700">{row.historyCount} resettable history record(s) detected</p> : null}</div><Link href={`/investors/${row.id}/portfolio-admin`} className="inline-flex min-h-8 shrink-0 items-center gap-1 self-start rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Individual Admin <ExternalLink size={12} /></Link></div><div className="mt-3 flex flex-wrap gap-1.5">{[...POSITION_SCOPE_KEYS, PORTFOLIO_ADMIN_SCOPES.TRADING].map((scope) => <ScopeChip key={scope} row={row} scope={scope} />)}{!row.holdingCount && !row.tradeCount && row.hasResettableHistory ? <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">History only · Full Reset available</span> : null}</div></div></div></div>; })}</div> : <div className="p-6"><EmptyState title="No matching investor portfolio data" description="Change the search/filter, or upload portfolio data before using bulk administration." /></div>}
      </Card>

      <div className="grid gap-4 xl:sticky xl:top-5 xl:self-start"><Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Controlled cleanup</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Delete from selected investors</h2><p className="mt-2 text-sm leading-6 text-slate-500">Select one or more portfolio categories. This keeps the normal audit/import recovery behavior and does not create a fresh-start state.</p><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected</p><p className="mt-1 text-lg font-black text-slate-950">{selectedRows.length} investor{selectedRows.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-slate-500">Current portfolio value: {formatCurrency(selectedPortfolioValue)}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">Maximum {MAX_BULK_INVESTORS} investors per cleanup batch</p></div><div className="mt-4 grid gap-2">{DELETE_SCOPE_OPTIONS.map((scope) => { const active = selectedScopes.includes(scope); const entire = scope === PORTFOLIO_ADMIN_SCOPES.ENTIRE; return <button key={scope} type="button" onClick={() => toggleDeleteScope(scope)} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-bold transition ${active ? "border-red-300 bg-red-50 text-red-800" : entire ? "border-red-200 bg-white text-red-700 hover:bg-red-50" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><span>{PORTFOLIO_ADMIN_SCOPE_LABELS[scope]}{entire ? <span className="block text-[10px] font-semibold text-red-500">All holdings + trading</span> : null}</span><span className={`grid h-5 w-5 place-items-center rounded border text-[11px] ${active ? "border-red-600 bg-red-600 text-white" : "border-slate-300 text-transparent"}`}>✓</span></button>; })}</div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mr-1 inline" size={14} /> Published Monthly Reports remain frozen. This screen uses imported-transaction cleanup; manual historical transactions are not bulk-deleted here.</div><Button type="button" variant="danger" className="mt-4 w-full" onClick={buildPreview} disabled={!selectedRows.length || !selectedScopes.length || busy === "preview"}>{busy === "preview" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Preview Controlled Delete</Button></Card>

      {canFullReset ? <Card className="border-red-200 p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800"><RotateCcw size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Super Admin · irreversible</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Full Portfolio Reset</h2></div></div><p className="mt-3 text-sm leading-6 text-slate-600">Completely removes the selected investors&apos; portfolio master, imports, mappings, fingerprints, snapshots, trading, recovery data and portfolio-specific internal history. The next upload starts as first-ever.</p><div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-900"><strong>Use only for a true rebuild.</strong> Investor profile, KYC, family, meetings, Goal/Bucket List definitions and published Monthly Reports remain.</div><p className="mt-3 text-[10px] font-semibold text-slate-400">Maximum {MAX_BULK_FULL_RESET} investors per Full Reset</p><Button type="button" variant="danger" className="mt-4 w-full" onClick={buildFullResetPreview} disabled={!selectedRows.length || busy === "full_preview"}>{busy === "full_preview" ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Preview Full Portfolio Reset</Button></Card> : null}</div>
    </div>

    <PreviewDialog open={previewOpen} busy={busy} preview={preview} reason={reason} confirmation={confirmation} onReason={setReason} onConfirmation={setConfirmation} onClose={() => { if (!busy) { setPreviewOpen(false); setPreview(null); setResult(null); } }} onDelete={executeDelete} result={result} />
    <FullResetDialog open={fullResetOpen} busy={busy} preview={fullResetPreview} reason={fullResetReason} confirmation={fullResetConfirmation} onReason={setFullResetReason} onConfirmation={setFullResetConfirmation} onClose={() => { if (!busy) { setFullResetOpen(false); setFullResetPreview(null); setFullResetResult(null); } }} onReset={executeFullReset} result={fullResetResult} />
  </div>;
}
