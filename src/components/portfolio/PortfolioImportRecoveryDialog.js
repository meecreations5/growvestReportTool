"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Loader2, RefreshCcw, RotateCcw, UserRoundCog, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { commitPortfolioImport, getPortfolioImportRecovery, recoverPortfolioImport } from "@/services/portfolioService";
import { formatCurrency } from "@/lib/utils/format";

function reportTypeLabel(value = "") {
  const labels = {
    fundbazaar_portfolio_ledger: "Portfolio Ledger · Not Applicable",
    fundbazaar_client_valuation: "Client Wise Valuation",
    bajaj_delivery: "Bajaj Delivery Holdings",
    bajaj_intraday: "Bajaj Intraday / Trade Book",
    bajaj_combined: "Bajaj Delivery + Intraday"
  };
  return labels[value] || value || "Portfolio report";
}

export default function PortfolioImportRecoveryDialog({ batchId, investors = [], onClose, onCompleted }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [targetInvestorId, setTargetInvestorId] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedInvestor = useMemo(() => investors.find((item) => item.id === targetInvestorId) || null, [investors, targetInvestorId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDetails(await getPortfolioImportRecovery(batchId));
    } catch (nextError) {
      setError(nextError.message || "Unable to load recovery details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [batchId]);

  function begin(file, nextAction) {
    setSelectedFile(file);
    setAction(nextAction);
    setReason("");
    setNotice("");
    setError("");
    setTargetInvestorId(nextAction === "reprocess" ? file.matchedInvestorId || "" : "");
  }

  async function confirm() {
    if (!selectedFile || !action) return;
    if (reason.trim().length < 5) {
      setError("Enter a short reason for this correction.");
      return;
    }
    if (action === "correct_investor" && !targetInvestorId) {
      setError("Select the correct investor.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const recovery = await recoverPortfolioImport(batchId, {
        action,
        fileId: selectedFile.id,
        reason: reason.trim(),
        targetInvestorId
      });
      if (recovery.status === "ready_to_reprocess") {
        const committed = await commitPortfolioImport(recovery.batchId, [{ fileId: recovery.fileId, investorId: recovery.investorId }]);
        const imported = Number(committed.importedCount || 0);
        if (!imported) throw new Error(committed.results?.find((item) => item.error)?.error || "The replacement import was prepared but could not be applied.");
        setNotice(action === "correct_investor"
          ? `Import corrected and applied to ${selectedInvestor?.fullName || "the selected investor"}.`
          : "Import rolled back and reprocessed successfully.");
      } else {
        setNotice(recovery.status === "legacy_cleaned" ? "Legacy wrong import cleaned successfully. You can now upload the correct Client Wise Valuation Report (.xls/.xlsx)." : "Import rollback completed successfully.");
      }
      setSelectedFile(null);
      setAction("");
      setReason("");
      setTargetInvestorId("");
      await load();
      onCompleted?.();
    } catch (nextError) {
      setError(nextError.message || "Unable to complete the recovery action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Import Correction and Recovery">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Import Correction & Recovery</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Recover a portfolio import safely</h2>
            <p className="mt-1 text-sm text-slate-500">Rollback, reprocess, or correct an investor mapping. GrowVest blocks recovery if a newer portfolio update has already changed the same records.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={18} /></button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-5 sm:p-6">
          {error ? <div className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle size={18} className="shrink-0" /> {error}</div> : null}
          {notice ? <div className="mb-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} className="shrink-0" /> {notice}</div> : null}

          {loading ? <div className="grid min-h-48 place-items-center text-sm text-slate-500"><Loader2 className="animate-spin" size={22} /></div> : null}

          {!loading && details ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Files</p><p className="mt-1 font-bold text-slate-900">{details.batch.fileCount || 0}</p></div>
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Imported</p><p className="mt-1 font-bold text-slate-900">{details.batch.importedCount || 0}</p></div>
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Value</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(details.batch.totalCurrentValue)}</p></div>
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Recovery</p><p className="mt-1 font-bold text-slate-900">{details.batch.recoveryStatus || "Available per file"}</p></div>
              </div>

              {(details.files || []).map((file) => (
                <div key={file.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{file.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">{reportTypeLabel(file.reportType)} · {file.matchedInvestorName || "Investor not mapped"}{file.externalPan ? ` · PAN ${file.externalPan}` : ""}{file.externalClientCode ? ` · Client ${file.externalClientCode}` : ""}</p>
                      <p className="mt-2 text-xs text-slate-500">{file.summary?.positionCount || 0} holding(s){file.summary?.policyCount ? ` · ${file.summary.policyCount} policy/policies` : ""} · {file.summary?.transactionCount || 0} transaction(s) · {formatCurrency(file.summary?.currentValue)}</p>
                    </div>
                    {file.recovery?.reversible ? (
                      <div className="flex flex-wrap gap-2">
                        {file.reportType !== "fundbazaar_portfolio_ledger" ? <Button type="button" variant="secondary" onClick={() => begin(file, "reprocess")}><RefreshCcw size={15} /> Reprocess</Button> : null}
                        {file.reportType !== "fundbazaar_portfolio_ledger" ? <Button type="button" variant="secondary" onClick={() => begin(file, "correct_investor")}><UserRoundCog size={15} /> Correct investor</Button> : null}
                        <Button type="button" variant="secondary" onClick={() => begin(file, "rollback")}><RotateCcw size={15} /> {file.reportType === "fundbazaar_portfolio_ledger" ? "Remove Ledger Import" : "Rollback"}</Button>
                      </div>
                    ) : file.recovery?.legacyCleanupAvailable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"><History size={13} /> Legacy import</span>
                        <Button type="button" variant="secondary" onClick={() => begin(file, "clean_legacy")}><RotateCcw size={15} /> Clean wrong import</Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><History size={13} /> {file.recovery?.status === "legacy" ? "Legacy import · cleanup unavailable" : `Recovery ${file.recovery?.status || "unavailable"}`}</span>
                    )}
                  </div>
                </div>
              ))}

              {selectedFile ? (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 sm:p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Confirm correction</p>
                  <h3 className="mt-1 font-heading text-xl font-bold text-slate-950">
                    {action === "rollback" ? "Rollback this import" : action === "clean_legacy" ? "Clean this legacy wrong import" : action === "correct_investor" ? "Move this import to the correct investor" : "Rollback and reprocess this import"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{action === "clean_legacy" ? "Legacy cleanup removes only records that still point to this old import, releases its exact-file duplicate lock, removes its stale external mapping when safe, and rebuilds the current portfolio snapshot. Published monthly reports are not edited." : <>Affected journal: {selectedFile.recovery?.positionCount || 0} holding record(s){selectedFile.recovery?.policyCount ? `, ${selectedFile.recovery.policyCount} policy record(s)` : ""} and {selectedFile.recovery?.transactionCount || 0} transaction record(s). Published monthly reports are not edited by this recovery.</>}</p>

                  {action === "correct_investor" ? (
                    <div className="mt-4">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Correct investor</label>
                      <select className={`${inputClassName} mt-2`} value={targetInvestorId} onChange={(event) => setTargetInvestorId(event.target.value)}>
                        <option value="">Select investor</option>
                        {investors.map((investor) => <option key={investor.id} value={investor.id}>{investor.fullName} {investor.clientCode ? `(${investor.clientCode})` : ""}{investor.panNumber ? ` · ${investor.panNumber}` : ""}</option>)}
                      </select>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason</label>
                    <textarea className={`${inputClassName} mt-2 min-h-24 resize-y`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Test import mapped to the wrong investor" />
                  </div>

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => { setSelectedFile(null); setAction(""); setReason(""); setTargetInvestorId(""); }}>Cancel</Button>
                    <Button type="button" disabled={busy} onClick={confirm}>{busy ? <Loader2 className="animate-spin" size={16} /> : ["rollback", "clean_legacy"].includes(action) ? <RotateCcw size={16} /> : <RefreshCcw size={16} />} Confirm {action === "rollback" ? "Rollback" : action === "clean_legacy" ? "Cleanup" : action === "correct_investor" ? "Correction" : "Reprocess"}</Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
