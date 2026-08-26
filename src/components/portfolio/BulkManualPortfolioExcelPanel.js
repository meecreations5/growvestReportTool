"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, UsersRound, WalletCards } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/utils/format";
import {
  commitBulkManualPortfolioExcel,
  downloadBulkManualPortfolioTemplate,
  previewBulkManualPortfolioExcel
} from "@/services/portfolioService";

function Metric({ label, value }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{Number(value || 0).toLocaleString("en-IN")}</p></div>;
}

export default function BulkManualPortfolioExcelPanel({ onImported }) {
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [mode, setMode] = useState("merge");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function downloadTemplate() {
    setBusy("template"); setError(""); setNotice("");
    try {
      const blob = await downloadBulkManualPortfolioTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "GrowVest_Manual_Portfolio_Management_Multi_Investor_Template_v0.33.2.xlsx";
      document.body.appendChild(anchor);
      anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (nextError) {
      setError(nextError.message || "Unable to download the Manual Portfolio Management template.");
    } finally { setBusy(""); }
  }

  async function previewFile() {
    if (!file) return;
    setBusy("preview"); setError(""); setNotice(""); setPreview(null);
    try {
      const result = await previewBulkManualPortfolioExcel(file, mode);
      setPreview(result.preview || null);
    } catch (nextError) {
      setError(nextError.message || "Unable to preview the Manual Portfolio Management workbook.");
    } finally { setBusy(""); }
  }

  async function importFile() {
    if (!file || preview?.blockingIssueCount) return;
    setBusy("commit"); setError(""); setNotice("");
    try {
      const result = await commitBulkManualPortfolioExcel(file, mode);
      setNotice(`${result.investorCount || 0} investor(s), ${result.accountCount || 0} portfolio account(s), ${result.holdingCount || 0} holding(s) and ${result.transactionCount || 0} transaction(s) processed successfully.`);
      setPreview(null); setFile(null); setFileKey((value) => value + 1); onImported?.(result);
    } catch (nextError) {
      setError(nextError.message || "Unable to import the Manual Portfolio Management workbook.");
    } finally { setBusy(""); }
  }

  return <Card className="border-blue-200 p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><WalletCards size={20} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Manual Portfolio Management</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Manage multiple investors and PMS-style portfolio accounts from one Excel</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">The workbook now covers Portfolio Accounts, Holdings, Transactions, Cash Ledger, Income, Corporate Actions, Charges, Goal Allocation, Reconciliation and Notes. Current Manual holdings and computed cash feed the Portfolio Master; supporting ledgers remain separately auditable.</p>
        </div>
      </div>
      <Button type="button" variant="secondary" onClick={downloadTemplate} disabled={Boolean(busy)}>{busy === "template" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Download PMS Workbook</Button>
    </div>

    {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
    {notice ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="mt-0.5 shrink-0" size={16} /> {notice}</div> : null}

    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_310px_auto] lg:items-end">
      <label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Manual Portfolio Management Excel</span><input key={fileKey} type="file" accept=".xlsx,.xls" className={inputClassName} onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setNotice(""); }} /></label>
      <label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Update Mode</span><select className={inputClassName} value={mode} onChange={(event) => { setMode(event.target.value); setPreview(null); }}><option value="merge">Merge / Update Manual Portfolio Data</option><option value="replace">Replace Manual Portfolio Data for Investors in File</option></select></label>
      <Button type="button" variant="secondary" onClick={previewFile} disabled={!file || Boolean(busy)}>{busy === "preview" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Preview Workbook</Button>
    </div>

    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong>Investor matching:</strong> Investor ID, PAN and Client Code are strongest. Exact unique Investor Name is supported. A Portfolio Account Code is investor-specific, so two different investors may both use <strong>PMS-01</strong>.</div>
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900"><strong>Portfolio value:</strong> Holdings remain the current investment snapshot. The Cash Ledger is calculated separately and GrowVest creates a Manual Cash Balance position for each account, so uninvested cash is included in the current Portfolio Master and snapshot.</div>
    {mode === "replace" ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Replace is investor-wide for Manual data.</strong> For each investor present in this workbook, GrowVest removes existing source=Manual holdings plus their Manual Portfolio Management accounts/ledgers and recreates them from this file. Fundbazaar, Bajaj Broking, provider ULIP and other non-Manual sources are untouched.</div> : null}

    {preview ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Metric label="Investors" value={preview.investorCount} /><Metric label="Accounts" value={preview.accountCount} /><Metric label="Holdings" value={preview.holdingCount} /><Metric label="Transactions" value={preview.transactionCount} /><Metric label="Cash entries" value={preview.cashEntryCount} /><Metric label="Income" value={preview.incomeCount} />
        <Metric label="Corporate actions" value={preview.corporateActionCount} /><Metric label="Charges" value={preview.chargeCount} /><Metric label="Goal allocations" value={preview.goalAllocationCount} /><Metric label="Reconciliations" value={preview.reconciliationCount} /><Metric label="Notes" value={preview.noteCount} /><Metric label="Total rows" value={preview.totalRows} />
      </div>

      {preview.blockingIssueCount ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 shrink-0 text-red-700" size={16} /><div><p className="text-sm font-bold text-red-900">Correct blocking workbook rows before import</p><div className="mt-2 grid gap-1">{preview.issues?.slice(0, 25).map((item, index) => <p key={`${item.sheet}-${item.rowNumber}-${index}`} className="text-xs text-red-800">{item.sheet || "Workbook"}{item.rowNumber ? ` · Row ${item.rowNumber}` : ""}: {item.reason}</p>)}</div>{preview.issues?.length > 25 ? <p className="mt-2 text-xs font-semibold text-red-700">+ {preview.issues.length - 25} more blocking issue(s)</p> : null}</div></div></div> : null}
      {preview.warnings?.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-bold text-amber-900">Review warnings ({preview.warningCount || 0})</p><div className="mt-2 grid gap-1">{preview.warnings.slice(0, 15).map((item, index) => <p key={`${item.sheet}-${item.rowNumber}-${index}`} className="text-xs text-amber-800">{item.sheet || "Workbook"}{item.rowNumber ? ` · Row ${item.rowNumber}` : ""}: {item.reason}</p>)}</div></div> : null}

      <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[920px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3">Matched Investor</th><th className="p-3">Client Code</th><th className="p-3">Matched By</th><th className="p-3 text-right">Accounts</th><th className="p-3 text-right">Holdings</th><th className="p-3 text-right">Transactions</th><th className="p-3 text-right">Current Value + Cash</th><th className="p-3 text-right">Warnings</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.investors?.map((item) => <tr key={item.investorId}><td className="p-3 font-semibold text-slate-900">{item.investorName}</td><td className="p-3 text-slate-600">{item.clientCode || "-"}</td><td className="p-3 text-slate-600">{item.matchedBy || "Identity"}</td><td className="p-3 text-right font-semibold">{item.accountCount || 0}</td><td className="p-3 text-right font-semibold">{item.holdingCount || 0}</td><td className="p-3 text-right font-semibold">{item.transactionCount || 0}</td><td className="p-3 text-right font-semibold">{formatCurrency(item.currentValue)}</td><td className={`p-3 text-right font-bold ${item.warningCount ? "text-amber-700" : "text-emerald-700"}`}>{item.warningCount || 0}</td></tr>)}</tbody></table></div>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="max-w-3xl text-xs leading-5 text-slate-500">Goal-name mismatches and missing Holding Keys for allocation are review warnings. Investor identity conflicts, duplicate stable keys, missing required fields and goal allocations above 100% are blocking.</p><Button type="button" onClick={importFile} disabled={Boolean(busy) || Boolean(preview.blockingIssueCount) || !preview.investorCount}>{busy === "commit" ? <Loader2 size={16} className="animate-spin" /> : <UsersRound size={16} />} Import {preview.investorCount || 0} Investor{preview.investorCount === 1 ? "" : "s"}</Button></div>
    </div> : null}
  </Card>;
}
