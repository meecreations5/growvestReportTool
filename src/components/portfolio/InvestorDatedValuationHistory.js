"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, Loader2, RefreshCcw, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvestorDatedValuations, previewFundbazaarHistoricalMonthEnd, approveFundbazaarHistoricalMonthEnd } from "@/services/portfolioService";
import { formatCurrency, formatDate } from "@/lib/utils/format";

export default function InvestorDatedValuationHistory({ investorId }) {
  const { profile } = useAuth();
  const canApprove = ["admin", "super_admin"].includes(String(profile?.role || ""));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [navProofs, setNavProofs] = useState({});
  // Saturday NAVs are assessed from the saved Fundbazaar source; only Sundays
  // need exceptional official NAV proof in the staff UI.
  const isWeekendNAV = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  const proofKey = (holding) => `${holding.isin || holding.schemeName || holding.instrumentName || ""}|${holding.folioNo || ""}|${holding.navDate || ""}`;
  function weekendEvidence() {
    return (selected?.holdings || []).filter((item) => isWeekendNAV(item.navDate)).map((holding) => ({
      isin: holding.isin || "", folioNo: holding.folioNo || "", instrumentName: holding.instrumentName || holding.schemeName || "",
      navDate: holding.navDate,
      publishedNav: navProofs[proofKey(holding)]?.publishedNav || "",
      referenceUrl: navProofs[proofKey(holding)]?.referenceUrl || ""
    }));
  }

  async function reload() {
    if (!investorId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getInvestorDatedValuations(investorId);
      setItems(Array.isArray(data.valuations) ? data.valuations : []);
    } catch (err) {
      setError(err.message || "Dated valuation history could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [investorId]);

  async function toggle(item) {
    if (selected?.valuation?.id === item.id) { setSelected(null); setPreview(null); return; }
    setBusyId(item.id);
    setPreview(null); setConfirmed(false); setNavProofs({}); setError(""); setNotice("");
    try {
      const data = await getInvestorDatedValuations(investorId, item.id);
      setSelected(data);
    } catch (err) { setError(err.message || "Unable to load archived holding details."); }
    finally { setBusyId(""); }
  }

  async function review(item) {
    setBusyId(item.id); setConfirmed(false); setPreview(null); setError(""); setNotice("");
    try {
      const data = await previewFundbazaarHistoricalMonthEnd(investorId, item.id, item.valuationDate.slice(0, 7), weekendEvidence());
      setPreview({ ...data, id: item.id });
    } catch (err) { setError(err.message || "Unable to check historical month-end eligibility."); }
    finally { setBusyId(""); }
  }

  async function approve(item) {
    if (!confirmed || !preview?.ready || preview.id !== item.id) return;
    setBusyId(item.id); setError(""); setNotice("");
    try {
      const data = await approveFundbazaarHistoricalMonthEnd(investorId, item.id, item.valuationDate.slice(0, 7), weekendEvidence());
      setNotice(`Historical Portfolio Master snapshot approved using actual NAVs from ${data.valuationDate}. Refresh the Monthly Wealth Review. Current holdings have not been changed.`);
      setConfirmed(false); setPreview(null);
      await reload();
    } catch (err) { setError(err.message || "Approval failed. The monthly report remains blocked."); }
    finally { setBusyId(""); }
  }

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Dated portfolio history</p>
        <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Saved valuations by NAV date</h2>
        <p className="mt-1 text-sm text-slate-500">Each Fundbazaar export remains stored under its real NAV date. Approving an eligible historical source does not overwrite current holdings.</p>
      </div>
      <button type="button" onClick={reload} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCcw size={14} /> Refresh history</button>
    </div>
    {loading ? <p className="p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={15} /> Loading saved valuations...</p> : null}
    {error ? <p role="alert" className="m-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="m-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
    {!loading && !items.length ? <p className="p-5 text-sm text-slate-500">No dated valuations have been archived yet. In Import Correction & Recovery, use Save dated valuation; or run Archive past valuations from Portfolio Overview.</p> : null}
    {items.length ? <div className="divide-y divide-slate-100">
      {items.map((item) => <div key={item.id}>
        <button type="button" onClick={() => toggle(item)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 sm:px-6" aria-expanded={selected?.valuation?.id === item.id}>
          <div className="flex min-w-0 items-center gap-3"><History className="shrink-0 text-blue-700" size={18} /><div><p className="text-sm font-bold text-slate-900">Source valuations through {formatDate(item.valuationDate)}</p><p className="max-w-[32rem] truncate text-xs text-slate-500">{item.sourceFileName || "Fundbazaar"} · {item.summary?.holdingCount || 0} funds · {item.summary?.transactionCount || 0} source transactions</p></div></div>
          <div className="flex items-center gap-3"><div className="text-right"><p className="font-heading text-base font-bold text-slate-950">{formatCurrency(item.summary?.currentValue)}</p><p className={`text-[10px] font-semibold ${item.monthlyReportEligible ? "text-emerald-700" : "text-amber-700"}`}>{item.monthlyReportEligible ? `Approved for ${item.approvedMonthKey}` : "Historical source · Report verification pending"}</p></div>{busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : selected?.valuation?.id === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
        </button>
        {selected?.valuation?.id === item.id ? <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-6">
          {!item.uniformNavDate ? <p className="mb-3 text-xs font-semibold text-amber-800">This source has different underlying NAV dates. Reporting eligibility is checked separately for each holding; dates that do not reflect an actual eligible NAV remain blocked.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(selected.holdings || []).map((holding) => <div key={holding.id} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-900">{holding.instrumentName}</p><p className="mt-1 text-[10px] text-slate-500">NAV {formatDate(holding.navDate)} · Units {Number(holding.totalUnits || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</p><p className="mt-1 font-semibold text-blue-800">{formatCurrency(holding.currentValue)}</p></div>)}</div>
          {canApprove && !item.monthlyReportEligible ? <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-950">Historical monthly-report approval</p><p className="mt-1 text-xs text-slate-600">Review whether this NAV source covers the whole portfolio for {item.valuationDate.slice(0, 7)}. Mixed-source portfolios need a complete combined valuation.</p></div><button type="button" disabled={busyId === item.id} onClick={() => review(item)} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50"><ShieldCheck size={15}/> Check reporting eligibility</button></div>
            {preview?.id === item.id && preview.navVerification?.required > 0 ? <p role="status" className={`mt-3 text-xs font-medium ${preview.navVerification.verified === preview.navVerification.required ? "text-emerald-700" : "text-amber-800"}`}>
              {preview.navVerification.verified === preview.navVerification.required
                ? `GrowVest automatically matched ${preview.navVerification.verified} exceptional NAV(s) with AMFI. No NAV entry is needed.`
                : `Automatic AMFI NAV check verified ${preview.navVerification.verified} of ${preview.navVerification.required}. ${preview.navVerification.issue || "Exact official evidence was unavailable."}`}
            </p> : null}
            {(selected.holdings || []).some((holding) => isWeekendNAV(holding.navDate)) && preview?.id === item.id && preview.navVerification?.verified !== preview.navVerification?.required ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
              <p className="text-xs font-bold text-amber-900">Official NAV verification for exceptional date(s)</p>
              <p className="text-xs text-amber-800">GrowVest attempted the official AMFI check but could not complete an exact match. Only if necessary, an administrator may supply a separately verified official source record. The original NAV date is retained.</p>
              {(selected.holdings || []).filter((holding) => isWeekendNAV(holding.navDate)).map((holding) => <div key={proofKey(holding)} className="rounded-md bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-900">{holding.instrumentName || holding.schemeName} · {holding.navDate} · Archived NAV ₹{Number(holding.currentNav || 0).toFixed(4)}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs text-slate-700">Published NAV for this date<input inputMode="decimal" type="number" step="0.0001" min="0" className="mt-1 w-full rounded-md border border-slate-200 p-2" placeholder="Enter independently verified NAV" value={navProofs[proofKey(holding)]?.publishedNav || ""} onChange={(event) => { setNavProofs((prior) => ({ ...prior, [proofKey(holding)]: { ...prior[proofKey(holding)], publishedNav: event.target.value } })); setPreview(null); setConfirmed(false); }} /></label>
                  <label className="text-xs text-slate-700">Official reference URL (AMFI or SBI MF)<input type="url" className="mt-1 w-full rounded-md border border-slate-200 p-2" placeholder="https://www.amfiindia.com/..." value={navProofs[proofKey(holding)]?.referenceUrl || ""} onChange={(event) => { setNavProofs((prior) => ({ ...prior, [proofKey(holding)]: { ...prior[proofKey(holding)], referenceUrl: event.target.value } })); setPreview(null); setConfirmed(false); }} /></label>
                </div>
              </div>)}
              <p className="text-xs text-amber-900">Use <a className="underline" href="https://www.amfiindia.com/net-asset-value/nav-history" target="_blank" rel="noreferrer">AMFI NAV History</a> to check the original official source. Preserve the actual source NAV date.</p>
            </div> : null}
            {preview?.id === item.id ? <div className="mt-4 space-y-3">
              <p className={`flex items-center gap-2 text-xs font-bold ${preview.ready ? "text-emerald-700" : "text-red-700"}`}>{preview.ready ? <ShieldCheck size={14}/> : <AlertCircle size={14}/>} {preview.ready ? "Eligible for administrator approval" : "Not eligible for monthly reporting"}</p>
              {preview.eligibility?.blockers?.map((line, index) => <p key={index} className="text-xs text-red-700">{line}</p>)}
              {preview.eligibility?.notes?.map((line, index) => <p key={index} className="text-xs text-amber-800">{line}</p>)}
              {preview.ready ? <><label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1"/> I have verified this is the complete Fundbazaar-only portfolio for the reporting period, each underlying NAV date is the last applicable source valuation for that holding, the transaction ledger is complete, and the displayed report will disclose the actual NAV date.</label><button type="button" disabled={!confirmed || busyId === item.id} onClick={() => approve(item)} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Approve historical monthly source</button></> : null}
            </div> : null}
          </div> : null}
        </div> : null}
      </div>)}
    </div> : null}
  </section>;
}
