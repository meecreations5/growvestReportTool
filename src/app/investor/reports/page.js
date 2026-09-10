"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Download, FileBarChart2, FileText, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { downloadReportPdf } from "@/services/communicationService";
import { getMonthLabel } from "@/lib/constants/report";
import { getInvestorAppData } from "@/services/investorAppService";
import { compactCurrency } from "@/lib/utils/reportPresentation";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";
import { MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";
import { GrowVestActivityIndicator } from "@/components/investor/mobile/GrowVestMotionMark";


function MobileReportsApp({ reports, filtered, latest, latestValue, change, loading, error, search, setSearch, year, setYear, years, workingId, handleDownload }) {
  const previousValue = latestValue - change;
  const changePercent = previousValue > 0 ? change / previousValue * 100 : 0;
  const moneyAdded = Number(latest?.summary?.newMoneyAdded || latest?.summary?.contributions || 0);
  const investmentMovement = Number(latest?.summary?.investmentGain || latest?.summary?.marketMovement || 0);
  const withdrawals = Number(latest?.summary?.withdrawals || latest?.summary?.withdrawalAmount || 0);

  return (
    <div className="gv-mobile-app-stack md:hidden">
      <section className="px-0.5 pt-1">
        <div className="flex items-end justify-between gap-3">
          <div><h1 className="font-heading text-[1.55rem] font-bold leading-none text-[#0B0B0F]">Monthly Review</h1><p className="mt-2 text-[12px] leading-5 text-[#6B7280]">A simple, insightful recap of your month in wealth.</p></div>
          <select value={year} onChange={(event) => setYear(event.target.value)} className="min-h-9 shrink-0 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-semibold text-[#6B7280] outline-none"><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
      </section>

      {error ? <div className="rounded-[16px] border border-[#E53935]/20 bg-[#E53935]/5 p-4 text-xs font-semibold text-[#B42318]">{error}</div> : null}

      {latest ? (
        <section>
          <div className="mb-2 flex items-center justify-between"><div><h2 className="font-heading text-[1.25rem] font-bold text-[#0B0B0F]">{getMonthLabel(latest.reportMonth)} {latest.reportYear}</h2><p className="mt-0.5 text-[10px] text-[#6B7280]">Published {displayDate(latest.publishedAt)}</p></div><button type="button" onClick={() => handleDownload(latest.id)} disabled={workingId === latest.id} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-[#1F4ED8] disabled:opacity-50" aria-label="Download latest monthly review">{workingId === latest.id ? <GrowVestActivityIndicator className="h-4 w-4" label="Preparing your monthly review" /> : <Download size={17} strokeWidth={1.5} />}</button></div>

          <Link href={`/investor/reports/${latest.id}`} className="relative block overflow-hidden rounded-[20px] bg-[#0B0B0F] p-4 text-white active:opacity-95">
            <img src="/brand/growvest-icon.svg" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-7 w-32 opacity-[.07] brightness-0 invert" />
            <div className="relative">
              <p className="text-[11px] text-white/60">Portfolio Value</p>
              <p className="gv-private-value mt-1 font-heading text-[1.85rem] font-bold leading-none text-white">{compactCurrency(latestValue)}</p>
              <p className={`gv-private-value mt-2 text-[11px] font-semibold ${change >= 0 ? "text-[#9BB2FF]" : "text-red-300"}`}>{change >= 0 ? "+" : ""}{compactCurrency(change)}{changePercent ? ` · ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%` : ""} from previous review</p>

              <div className="mt-4 grid grid-cols-2 gap-y-3 border-t border-white/15 pt-4">
                <div className="border-r border-white/15 pr-3"><p className="text-[10px] text-white/45">Money Added</p><p className="gv-private-value mt-1 text-[12px] font-bold text-white">{compactCurrency(moneyAdded)}</p></div>
                <div className="pl-3"><p className="text-[10px] text-white/45">Investment Movement</p><p className={`gv-private-value mt-1 text-[12px] font-bold ${investmentMovement >= 0 ? "text-[#9BB2FF]" : "text-red-300"}`}>{investmentMovement >= 0 ? "+" : ""}{compactCurrency(investmentMovement)}</p></div>
                <div className="border-r border-white/15 pr-3"><p className="text-[10px] text-white/45">Withdrawals</p><p className="gv-private-value mt-1 text-[12px] font-bold text-white">{compactCurrency(withdrawals)}</p></div>
                <div className="pl-3"><p className="text-[10px] text-white/45">Net Change</p><p className={`gv-private-value mt-1 text-[12px] font-bold ${change >= 0 ? "text-[#9BB2FF]" : "text-red-300"}`}>{change >= 0 ? "+" : ""}{compactCurrency(change)}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3"><span className="text-[11px] font-semibold text-white/70">View your full one-minute review</span><ArrowRight size={16} strokeWidth={1.5} /></div>
            </div>
          </Link>
        </section>
      ) : null}

      <label className="relative block"><Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search monthly reviews" className="min-h-11 w-full rounded-[14px] border border-slate-200 bg-white pl-10 pr-3 text-[12px] font-medium text-[#0B0B0F] outline-none focus:border-[#1F4ED8]" /></label>

      {loading ? <div className="space-y-3"><div className="gv-skeleton h-20 rounded-[18px]" /><div className="gv-skeleton h-20 rounded-[18px]" /></div> : filtered.length ? (
        <section>
          <div className="mb-2.5 flex items-center justify-between"><div><h2 className="font-heading text-[1.12rem] font-bold text-[#0B0B0F]">Previous Reviews</h2><p className="mt-0.5 text-[11px] text-[#6B7280]">Your review history</p></div><span className="text-[10px] text-[#6B7280]">{filtered.length} published</span></div>
          <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">{filtered.map((report, index) => <Link key={report.id} href={`/investor/reports/${report.id}`} className={`flex min-h-[68px] items-center gap-3 px-4 py-3 active:bg-[#F4F6F9] ${index ? "border-t border-slate-100" : ""}`}><FileBarChart2 size={19} strokeWidth={1.5} className="shrink-0 text-[#1F4ED8]" /><span className="min-w-0 flex-1"><span className="block font-heading text-[14px] font-bold text-[#0B0B0F]">{getMonthLabel(report.reportMonth)} {report.reportYear}</span><span className="mt-0.5 block text-[10px] text-[#6B7280]">Statement {displayDate(report.statementDate)}</span></span><span className="shrink-0 text-right"><span className="gv-private-value block font-heading text-[12px] font-bold text-[#0B0B0F]">{compactCurrency(report.summary?.totalCorpus)}</span><ChevronRight size={15} strokeWidth={1.5} className="ml-auto mt-1 text-slate-300" /></span></Link>)}</div>
        </section>
      ) : <MobileEmptyState icon={FileText} title={reports.length ? "No matching reviews" : "No published reports yet"} copy={reports.length ? "Try a different search or financial year." : "Your Monthly Reviews will appear here after GrowVest publishes them."} />}
    </div>
  );
}

function displayDate(value) {
  if (!value) return "—";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvestorReportsPage() {
  const { profile, isDemoInvestor } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");

  useEffect(() => {
    async function loadReports() {
      if (!profile?.id || !profile?.investorId) return;
      setLoading(true);
      setError("");
      try {
        const payload = await getInvestorAppData("reports");
        setReports((payload.reports || []).filter((item) => item.activePublishedVersionId));
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load published reports. Please refresh or contact GrowVest support.");
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [profile?.id, profile?.investorId]);

  const years = useMemo(() => [...new Set(reports.map((item) => String(item.reportYear)).filter(Boolean))], [reports]);
  const filtered = useMemo(() => reports.filter((item) => {
    const label = `${item.title || ""} ${getMonthLabel(item.reportMonth)} ${item.reportYear} ${item.reportCode || ""}`.toLowerCase();
    return label.includes(search.trim().toLowerCase()) && (year === "all" || String(item.reportYear) === year);
  }), [reports, search, year]);
  const latest = filtered[0] || null;
  const previous = latest ? reports.find((item) => item.id !== latest.id) : null;
  const latestValue = Number(latest?.summary?.totalCorpus || 0);
  const previousValue = Number(previous?.summary?.totalCorpus || 0);
  const change = previousValue ? latestValue - previousValue : Number(latest?.summary?.investmentGain || 0);

  async function handleDownload(reportId) {
    if (isDemoInvestor) {
      setError("PDF downloads are available after you become part of GrowVest. You can explore the complete sample review here.");
      return;
    }
    setWorkingId(reportId);
    setError("");
    try {
      await downloadReportPdf(reportId);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Portfolio communication" title="Monthly reports" description="Review your published wealth progress reports and download secure PDF copies." />
      {isDemoInvestor ? <DemoInvestorCta compact /> : null}
      <MobileReportsApp reports={reports} filtered={filtered} latest={latest} previous={previous} latestValue={latestValue} change={change} loading={loading} error={error} search={search} setSearch={setSearch} year={year} setYear={setYear} years={years} workingId={workingId} handleDownload={handleDownload} />

      <div className="hidden gap-5 md:grid md:gap-6">
      {latest ? (
        <section className="relative overflow-hidden rounded-[28px] bg-[var(--gv-ink)] p-5 text-white shadow-[var(--gv-shadow-card)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full border border-cyan-400/10" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300"><Sparkles size={15} /> Latest report</div>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white">{getMonthLabel(latest.reportMonth)} {latest.reportYear}</h2>
              <p className="mt-1 text-sm text-slate-400">Published {displayDate(latest.publishedAt)} · Version {latest.publishedVersion || 1}</p>
              <div className="mt-6 flex flex-wrap items-end gap-4">
                <div><p className="text-xs text-slate-400">Portfolio value</p><p className="mt-1 font-heading text-4xl font-bold text-white">{compactCurrency(latestValue)}</p></div>
                <span className={`mb-1 rounded-full px-3 py-1.5 text-xs font-bold ${change >= 0 ? "bg-emerald-400/15 text-[#9BB2FF]" : "bg-red-400/15 text-red-300"}`}>{change >= 0 ? "+" : ""}{compactCurrency(change)} this month</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[220px] lg:grid-cols-1">
              <Link href={`/investor/reports/${latest.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[var(--gv-ink)]">Open report <ArrowRight size={16} /></Link>
              <button type="button" onClick={() => handleDownload(latest.id)} disabled={workingId === latest.id} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white disabled:opacity-60"><Download size={16} /> {workingId === latest.id ? "Preparing…" : "Download PDF"}</button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-3 shadow-[var(--gv-shadow-card)] sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
          <label className="relative block"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" className="min-h-11 w-full rounded-xl border border-slate-200 bg-[var(--gv-surface)] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--gv-blue)] focus:bg-white" /></label>
          <select value={year} onChange={(event) => setYear(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-[var(--gv-blue)]"><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2"><div className="gv-skeleton h-48 rounded-2xl" /><div className="gv-skeleton h-48 rounded-2xl" /></section>
      ) : filtered.length === 0 ? (
        <section className="grid place-items-center rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white px-6 py-16 text-center shadow-[var(--gv-shadow-card)]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><FileText size={24} /></span>
          <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">No matching published reports</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Published monthly reports will appear here with secure PDF downloads.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((report, index) => (
            <article key={report.id} className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><FileBarChart2 size={20} /></span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Version {report.publishedVersion || 1}</span>
              </div>
              <p className="mt-5 text-xs font-semibold text-slate-400">{report.reportCode || "GrowVest Monthly Report"}</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-[var(--gv-ink)]">{getMonthLabel(report.reportMonth)} {report.reportYear}</h2>
              <p className="mt-2 text-sm text-slate-500">Statement {displayDate(report.statementDate)}</p>
              <div className="mt-5 rounded-2xl bg-[var(--gv-surface)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Portfolio value</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[var(--gv-ink)]">{compactCurrency(report.summary?.totalCorpus)}</p>
                <p className="mt-1 text-xs text-slate-500">{report.downloadCount || 0} secure download(s)</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href={`/investor/reports/${report.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white text-xs font-bold text-blue-700">View</Link>
                <button type="button" onClick={() => handleDownload(report.id)} disabled={workingId === report.id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] text-xs font-bold text-white disabled:opacity-60"><Download size={15} /> {workingId === report.id ? "Preparing" : "PDF"}</button>
              </div>
              {index === 0 ? <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#1F4ED8]">Current published report</p> : null}
            </article>
          ))}
        </section>
      )}
      </div>
    </div>
  );
}
