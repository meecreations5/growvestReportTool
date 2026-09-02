"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/utils/format";
import { commitManualPortfolioExcel, downloadManualPortfolioTemplate, previewManualPortfolioExcel } from "@/services/portfolioService";

export default function ManualPortfolioExcelPanel({ investorId, onImported }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("merge");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function downloadTemplate() {
    setBusy("template"); setError(""); setNotice("");
    try {
      const blob = await downloadManualPortfolioTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "GrowVest_Manual_Investment_Template_v0.33.2.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (nextError) { setError(nextError.message || "Unable to download the Manual Investment template."); }
    finally { setBusy(""); }
  }

  async function previewFile() {
    if (!file) return;
    setBusy("preview"); setError(""); setNotice("");
    try { const result = await previewManualPortfolioExcel(investorId, file, mode); setPreview(result.preview || null); }
    catch (nextError) { setError(nextError.message || "Unable to preview Excel file."); }
    finally { setBusy(""); }
  }

  async function importFile() {
    if (!file) return;
    setBusy("commit"); setError(""); setNotice("");
    try {
      const result = await commitManualPortfolioExcel(investorId, file, mode);
      setNotice(`${result.created || 0} new and ${result.updated || 0} updated holding(s).${result.removed ? ` ${result.removed} previous manual holding(s) removed.` : ""}`);
      setPreview(null); setFile(null); onImported?.(result);
    } catch (nextError) { setError(nextError.message || "Unable to import manual portfolio Excel."); }
    finally { setBusy(""); }
  }

  return <Card className="p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Manual account management</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Upload Manual Investment Excel</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Use this for investments GrowVest maintains manually instead of receiving through a provider import. The investor is already selected. Upload the simplified Manual Investments sheet; optional transaction history can be included in the Transactions (Optional) sheet.</p></div><Button type="button" variant="secondary" onClick={downloadTemplate} disabled={Boolean(busy)}>{busy === "template" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Download Manual Investment Template</Button></div>
    {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
    {notice ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}
    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto] lg:items-end">
      <label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Excel File</span><input type="file" accept=".xlsx,.xls" className={inputClassName} onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} /></label>
      <label className="grid gap-2"><span className="text-xs font-bold text-slate-700">Update Mode</span><select className={inputClassName} value={mode} onChange={(e) => { setMode(e.target.value); setPreview(null); }}><option value="merge">Merge / Update Manual Portfolio</option><option value="replace">Replace Manual Portfolio</option></select></label>
      <Button type="button" variant="secondary" onClick={previewFile} disabled={!file || Boolean(busy)}>{busy === "preview" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Preview</Button>
    </div>
    {mode === "replace" ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Replace Manual Portfolio</strong> removes only existing holdings whose source is Manual and are not in this Excel. Fundbazaar, Bajaj, ULIP-provider and other imported sources are untouched.</div> : null}
    {preview ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Holdings</p><p className="mt-1 text-xl font-black text-slate-950">{preview.holdingCount}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Invested</p><p className="mt-1 text-sm font-bold text-slate-950">{formatCurrency(preview.investedAmount)}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Current Value</p><p className="mt-1 text-sm font-bold text-slate-950">{formatCurrency(preview.currentValue)}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Warnings</p><p className={`mt-1 text-xl font-black ${preview.warningCount ? "text-amber-700" : "text-emerald-700"}`}>{preview.warningCount || 0}</p></div></div><div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3">Investment</th><th className="p-3">Type</th><th className="p-3 text-right">Current Value</th><th className="p-3">Goal</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.rows?.map((row) => <tr key={`${row.rowNumber}-${row.instrumentName}`}><td className="p-3 font-semibold text-slate-900">{row.instrumentName}</td><td className="p-3 text-slate-600">{row.productType}</td><td className="p-3 text-right font-semibold">{formatCurrency(row.currentValue)}</td><td className={`p-3 ${row.goalMatched ? "text-slate-600" : "font-semibold text-amber-700"}`}>{row.goalName || "General Wealth"}{!row.goalMatched ? " · not matched" : ""}</td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end"><Button type="button" onClick={importFile} disabled={Boolean(busy)}>{busy === "commit" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import Manual Investments</Button></div></div> : null}
  </Card>;
}
