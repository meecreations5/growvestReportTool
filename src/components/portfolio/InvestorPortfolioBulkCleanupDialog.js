"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Trash2,
  X
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/utils/format";
import {
  PORTFOLIO_PRODUCT_LABELS,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import {
  deleteInvestorPortfolioHoldings,
  previewInvestorPortfolioCleanup
} from "@/services/portfolioService";

function holdingName(item = {}) {
  return item.instrumentName || item.schemeName || item.stockName || item.fundName || item.symbol || "Investment";
}

function HoldingRow({ item }) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{holdingName(item)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {PORTFOLIO_PRODUCT_LABELS[item.productType] || "Investment"}
          {item.source ? ` · ${PORTFOLIO_SOURCE_LABELS[item.source] || item.source}` : ""}
          {item.folioNo ? ` · Folio ${item.folioNo}` : ""}
          {item.symbol ? ` · ${item.symbol}` : ""}
          {item.policyNumber ? ` · Policy ${item.policyNumber}` : ""}
        </p>
      </div>
      <p className="font-heading text-sm font-bold text-slate-950">{formatCurrency(item.currentValue)}</p>
    </div>
  );
}

export default function InvestorPortfolioBulkCleanupDialog({
  open,
  onClose,
  onCompleted,
  investor,
  positions = [],
  selectedIds = []
}) {
  const [transactionsMode, setTransactionsMode] = useState("imported");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState(null);

  const selectedPositions = useMemo(() => {
    const ids = new Set((selectedIds || []).map(String));
    return (positions || []).filter((item) => ids.has(String(item.id)));
  }, [positions, selectedIds]);

  useEffect(() => {
    if (!open || !investor?.id || !selectedIds.length) return;
    let active = true;
    setBusy("preview");
    setError("");
    setResult(null);
    previewInvestorPortfolioCleanup(investor.id, selectedIds, transactionsMode)
      .then((next) => {
        if (active) setPreview(next.preview || null);
      })
      .catch((nextError) => {
        if (active) setError(nextError?.message || "Unable to preview selected portfolio cleanup.");
      })
      .finally(() => {
        if (active) setBusy("");
      });
    return () => { active = false; };
  }, [investor?.id, open, selectedIds, transactionsMode]);

  if (!open) return null;

  async function submit() {
    if (!investor?.id || !selectedIds.length) return;
    setBusy("delete");
    setError("");
    try {
      const next = await deleteInvestorPortfolioHoldings(investor.id, {
        positionIds: selectedIds,
        transactionsMode,
        reason,
        confirmation
      });
      setResult(next);
      onCompleted?.(next);
    } catch (nextError) {
      setError(nextError?.message || "Unable to delete selected portfolio holdings.");
    } finally {
      setBusy("");
    }
  }

  const allSelected = selectedPositions.length > 0 && selectedPositions.length === positions.length;

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Delete selected investor portfolio holdings">
      <button type="button" className="absolute inset-0" onClick={busy ? undefined : onClose} aria-label="Close" />
      <section className="relative z-10 max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><Trash2 size={20} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">Investor portfolio cleanup</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{allSelected ? "Delete entire current portfolio" : "Delete selected investments"}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{investor?.fullName || investor?.name || "Investor"} · Remove only the selected current holdings. Investor profile, KYC, Goals/Bucket Lists, documents, meetings, actions and published Monthly Reports remain intact.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X size={16} /></button>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        {result ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={20} />
              <div>
                <p className="font-bold text-emerald-950">Portfolio cleanup completed</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">Removed {result.removed?.positions || 0} holding(s) and {result.removed?.transactions || 0} related transaction(s). Current portfolio value removed: {formatCurrency(result.removed?.currentValue)}. A corrected latest portfolio snapshot was created.</p>
              </div>
            </div>
          </div>
        ) : null}

        {busy === "preview" ? (
          <div className="mt-5 flex min-h-28 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600"><Loader2 className="mr-2 animate-spin" size={17} /> Checking selected holdings and related history...</div>
        ) : preview ? (
          <div className="mt-5 grid gap-4">
            <div className={`rounded-2xl border p-4 sm:p-5 ${allSelected ? "border-red-300 bg-red-50/60" : "border-amber-200 bg-amber-50/40"}`}>
              <div className="flex items-start gap-3">
                <ShieldAlert className={`mt-0.5 shrink-0 ${allSelected ? "text-red-700" : "text-amber-700"}`} size={20} />
                <div>
                  <p className="font-bold text-slate-950">Cleanup preview</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{preview.selected?.count || 0} holding(s) · {formatCurrency(preview.selected?.currentValue)} current value · {formatCurrency(preview.selected?.investedAmount)} recorded invested amount.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Holdings</p><p className="mt-1 text-lg font-black text-slate-950">{preview.selected?.count || 0}</p></div>
                <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Related Transactions</p><p className="mt-1 text-lg font-black text-slate-950">{preview.transactions?.total || 0}</p></div>
                <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">ULIP Policies Affected</p><p className="mt-1 text-lg font-black text-slate-950">{preview.affectedPolicies || 0}</p></div>
                <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">File Locks Releasable</p><p className="mt-1 text-lg font-black text-slate-950">{preview.releasableFileLocks || 0}</p></div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-600">After cleanup, GrowVest recalculates Goal/Bucket corpus and creates a corrected current snapshot. Historical snapshots and already-published reports are retained for audit.</div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Selected investments</p>
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">{selectedPositions.map((item) => <HoldingRow key={item.id} item={item} />)}</div>
            </div>

            <Field label="Related transaction cleanup" required>
              <select className={inputClassName} value={transactionsMode} onChange={(event) => { setTransactionsMode(event.target.value); setConfirmation(""); }} disabled={busy === "delete"}>
                <option value="imported">Remove selected holdings + related imported transactions</option>
                <option value="all">Remove selected holdings + ALL related transactions</option>
              </select>
            </Field>

            {transactionsMode === "all" && Number(preview.transactions?.manual || 0) > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-800"><AlertTriangle className="mr-1 inline" size={14} /> This selection includes {preview.transactions.manual} manually created transaction(s). They will also be permanently removed from the current transaction history.</div>
            ) : null}

            <Field label="Deletion reason" required>
              <textarea rows={3} className={inputClassName} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Wrong test portfolio was imported for this investor." disabled={busy === "delete"} />
            </Field>

            <Field label='Type "DELETE" to confirm' required hint={allSelected ? "You are deleting the investor's entire current portfolio. This confirmation is mandatory." : "This confirmation is required for bulk deletion."}>
              <input className={inputClassName} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="DELETE" autoComplete="off" disabled={busy === "delete"} />
            </Field>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={Boolean(busy)}>Close</Button>
          {!result && preview ? (
            <Button type="button" variant="danger" onClick={submit} disabled={busy === "delete" || reason.trim().length < 5 || confirmation.trim().toUpperCase() !== "DELETE"}>
              {busy === "delete" ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              {allSelected ? "Delete Entire Current Portfolio" : `Delete ${preview.selected?.count || selectedIds.length} Selected`}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
