"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DatabaseZap, Loader2, ShieldAlert, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { cleanVendorPortfolio, previewVendorPortfolioCleanup } from "@/services/portfolioService";
import { formatCurrency } from "@/lib/utils/format";

function CountPill({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{Number(value || 0)}</p>
    </div>
  );
}

export default function VendorPortfolioCleanupDialog({ open, investors = [], onClose, onCompleted }) {
  const [investorId, setInvestorId] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState(null);

  const selectedInvestor = useMemo(
    () => investors.find((item) => item.id === investorId) || null,
    [investorId, investors]
  );
  const selectedSource = useMemo(
    () => (preview?.sources || []).find((item) => item.source === source) || null,
    [preview, source]
  );

  useEffect(() => {
    if (!open) return;
    setInvestorId("");
    setSource("");
    setPreview(null);
    setReason("");
    setConfirmation("");
    setResult(null);
    setError("");
    setBusy("");
  }, [open]);

  useEffect(() => {
    if (!open || !investorId) {
      setPreview(null);
      setSource("");
      return;
    }

    let active = true;
    setBusy("preview");
    setError("");
    setResult(null);
    previewVendorPortfolioCleanup(investorId)
      .then((next) => {
        if (!active) return;
        setPreview(next);
        setSource((next.sources || [])[0]?.source || "");
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError?.message || "Unable to load vendor portfolio data.");
      })
      .finally(() => {
        if (active) setBusy("");
      });

    return () => { active = false; };
  }, [investorId, open]);

  if (!open) return null;

  async function submit() {
    if (!investorId || !source) return;
    setBusy("clean");
    setError("");
    try {
      const next = await cleanVendorPortfolio({ investorId, source, reason, confirmation });
      setResult(next);
      setPreview((current) => current ? {
        ...current,
        sources: (current.sources || []).filter((item) => item.source !== source)
      } : current);
      setSource("");
      setReason("");
      setConfirmation("");
      onCompleted?.(next);
    } catch (nextError) {
      setError(nextError?.message || "Unable to clean the selected vendor portfolio.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Clean vendor portfolio">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <section className="relative z-10 max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><DatabaseZap size={20} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">Admin recovery</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Clean selected vendor portfolio</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Remove all current portfolio data belonging to one selected source for one investor. Investor profile, Goals/Bucket Lists, documents, meetings and published Monthly Reports are not deleted.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={16} /></button>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        {result ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={20} />
              <div>
                <p className="font-bold text-emerald-950">{result.sourceLabel} portfolio cleaned for {result.investorName}</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">Removed {result.removed?.positions || 0} position(s), {result.removed?.transactions || 0} investment transaction(s), {result.removed?.trades || 0} trade(s) and released {result.importLocksReleased ?? result.removed?.fingerprints ?? 0} exact-file lock(s). A corrected Portfolio snapshot was created from the remaining sources.</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          <Field label="Investor" required>
            <select className={inputClassName} value={investorId} onChange={(event) => setInvestorId(event.target.value)} disabled={busy === "clean"}>
              <option value="">Select investor</option>
              {investors.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.name || "Investor"}{item.clientCode ? ` · ${item.clientCode}` : ""}</option>)}
            </select>
          </Field>

          {busy === "preview" ? (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600"><Loader2 className="mr-2 animate-spin" size={17} /> Checking vendor portfolio data...</div>
          ) : investorId && preview && !(preview.sources || []).length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">No imported/manual portfolio vendor data is available to clean for {selectedInvestor?.fullName || selectedInvestor?.name || "this investor"}.</div>
          ) : null}

          {(preview?.sources || []).length ? (
            <>
              <Field label="Vendor / Portfolio Source" required hint="Only this source will be removed. Other portfolio sources remain untouched.">
                <select className={inputClassName} value={source} onChange={(event) => { setSource(event.target.value); setConfirmation(""); }} disabled={busy === "clean"}>
                  {(preview.sources || []).map((item) => <option key={item.source} value={item.source}>{item.label}</option>)}
                </select>
              </Field>

              {selectedSource ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 shrink-0 text-red-700" size={20} />
                    <div>
                      <p className="font-bold text-slate-950">Cleanup preview · {selectedSource.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Current vendor value {formatCurrency(selectedSource.currentValue)}. The exact import locks for this source will also be released so corrected/new files can be uploaded again.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <CountPill label="Positions" value={selectedSource.counts?.positions} />
                    <CountPill label="Transactions" value={selectedSource.counts?.transactions} />
                    <CountPill label="Trades" value={selectedSource.counts?.trades} />
                    <CountPill label="Policies" value={selectedSource.counts?.policies} />
                    <CountPill label="Mappings" value={selectedSource.counts?.mappings} />
                    <CountPill label="File Locks" value={selectedSource.counts?.fingerprints} />
                    <CountPill label="Import Files" value={selectedSource.counts?.importFiles} />
                    <CountPill label="Batches" value={selectedSource.counts?.importBatches} />
                  </div>
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold leading-5 text-amber-900">
                    Historical audit records and already-published Monthly Reports are retained. Existing older portfolio snapshots remain historical; GrowVest creates/refreshes today&apos;s corrected snapshot from the sources that remain after cleanup.
                  </div>
                </div>
              ) : null}

              <Field label="Cleanup reason" required>
                <textarea rows={3} className={inputClassName} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Wrong Fundbazaar data was imported during testing." disabled={busy === "clean"} />
              </Field>

              <Field label='Type "CLEAN" to confirm' required hint="This is intentionally required because vendor cleanup is destructive.">
                <input className={inputClassName} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="CLEAN" autoComplete="off" disabled={busy === "clean"} />
              </Field>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          {selectedSource ? (
            <Button type="button" variant="danger" onClick={submit} disabled={busy === "clean" || reason.trim().length < 5 || confirmation.trim().toUpperCase() !== "CLEAN"}>
              {busy === "clean" ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Clean {selectedSource.label}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
