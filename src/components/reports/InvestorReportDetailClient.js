"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircleMore,
  Printer,
  ArrowDownRight,
  ArrowUpRight,
  WalletCards
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvestorReportDetail } from "@/services/investorAppService";
import {
  downloadReportPdf,
  submitReportAcknowledgement
} from "@/services/communicationService";
import { getMonthLabel } from "@/lib/constants/report";
import MonthlyWealthReport from "@/components/reports/MonthlyWealthReport";
import InvestorReportSectionNav from "@/components/investor/InvestorReportSectionNav";
import { reportTemplateNavItems } from "@/lib/constants/reportTemplates";
import { formatCurrency } from "@/lib/utils/format";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";


export default function InvestorReportDetailClient({ reportId }) {
  const { profile, isDemoInvestor } = useAuth();
  const [reportMeta, setReportMeta] = useState(null);
  const [publishedVersion, setPublishedVersion] = useState(null);
  const [history, setHistory] = useState([]);
  const [acknowledgement, setAcknowledgement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comment, setComment] = useState("");
  const [mobileExpanded, setMobileExpanded] = useState(false);

  async function refreshReportDetail() {
    if (!profile?.id || !reportId) return;
    const payload = await getInvestorReportDetail(reportId);
    setReportMeta(payload.reportMeta || null);
    setPublishedVersion(payload.publishedVersion || null);
    setHistory(payload.history || []);
    setAcknowledgement(payload.acknowledgement || null);
  }

  useEffect(() => {
    if (!profile?.id || !reportId) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    getInvestorReportDetail(reportId)
      .then((payload) => {
        if (!active) return;
        setReportMeta(payload.reportMeta || null);
        setPublishedVersion(payload.publishedVersion || null);
        setHistory(payload.history || []);
        setAcknowledgement(payload.acknowledgement || null);
      })
      .catch((nextError) => {
        if (!active) return;
        console.error(nextError);
        setError(nextError?.message || "You do not have access to this monthly report.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile?.id, reportId]);

  const report = publishedVersion ? { ...publishedVersion, id: reportId } : null;
  const adjacent = useMemo(() => {
    const index = history.findIndex((item) => item.id === reportId);
    return {
      newer: index > 0 ? history[index - 1] : null,
      older: index >= 0 && index < history.length - 1 ? history[index + 1] : null
    };
  }, [history, reportId]);

  async function handleDownload() {
    if (isDemoInvestor) {
      setNotice("This is an illustrative Monthly Review. Secure PDF downloads are available once you become part of GrowVest.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await downloadReportPdf(reportId);
      setNotice("Your secure PDF download has started.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleAcknowledgement(requestDiscussion = false) {
    if (!report || !profile?.id) return;
    if (isDemoInvestor) {
      setNotice(requestDiscussion
        ? "Your personal GrowVest Partner becomes available when you become part of GrowVest."
        : "This sample review does not need acknowledgement. It is here for you to explore.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await submitReportAcknowledgement(report.id, { requestDiscussion, comment });
      setNotice(
        requestDiscussion
          ? "Your discussion request was sent to your GrowVest Partner."
          : "Report acknowledged successfully."
      );
      setComment("");
      await refreshReportDetail().catch(() => {});
    } catch (nextError) {
      setError(nextError.message || "Unable to update your report acknowledgement.");
    } finally {
      setWorking(false);
    }
  }

  if (loading || (reportMeta && !publishedVersion)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading your published monthly report…
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (!report) return null;

  const reportPeriod = `${getMonthLabel(report.reportMonth)} ${report.reportYear}`;
  const mobileSummary = report.summary || {};
  const mobileValue = Number(mobileSummary.totalCorpus || 0);
  const mobileGain = Number(mobileSummary.investmentGain || mobileSummary.gainLoss || 0);
  const mobileNewMoney = Number(mobileSummary.newMoneyAdded || 0);
  const mobileWithdrawals = Number(mobileSummary.totalWithdrawals || 0);
  const mobileMonthChange = mobileNewMoney - mobileWithdrawals + mobileGain;

  return (
    <div className="grid gap-4 pb-4 lg:pb-0">
      {isDemoInvestor ? <DemoInvestorCta compact /> : null}
      <header className="hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:block sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/investor/reports"
              className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"
            >
              <ArrowLeft size={16} /> Back to monthly reports
            </Link>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Monthly wealth report
            </p>
            <h1 className="mt-1 font-heading text-2xl font-bold text-slate-950 sm:text-3xl">
              {reportPeriod}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{report.reportCode}</span>
              <span aria-hidden="true">·</span>
              <span>Published version {report.publishedVersion || 1}</span>
              {acknowledgement?.acknowledged ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={14} /> Acknowledged
                </span>
              ) : null}
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {adjacent.older ? (
              <Link
                href={`/investor/reports/${adjacent.older.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft size={16} /> Previous
              </Link>
            ) : null}
            {adjacent.newer ? (
              <Link
                href={`/investor/reports/${adjacent.newer.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Next <ChevronRight size={16} />
              </Link>
            ) : null}
            {!isDemoInvestor ? (
              <Link
                href={`/report-print/${reportId}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <Printer size={16} /> Print Preview
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleDownload}
              disabled={working}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              <Download size={16} /> {working ? "Preparing…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("report-discussion")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700"
            >
              <MessageCircleMore size={16} /> Discuss
            </button>
          </div>
        </div>

        {!isDemoInvestor && !acknowledgement?.acknowledged ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Please review the report and acknowledge that you have received it.
            </p>
            <button
              type="button"
              onClick={() => handleAcknowledgement(false)}
              disabled={working}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 disabled:opacity-60"
            >
              Acknowledge Report
            </button>
          </div>
        ) : null}
      </header>

      {/* Phone-only one-minute review. Full report is available on demand below. */}
      <section className="md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#6B7280]">Your {reportPeriod} in 60 seconds</p>
            <h2 className="mt-0.5 font-heading text-[1.55rem] font-bold text-[#0B0B0F]">{reportPeriod}</h2>
            <p className="mt-1 text-[11px] text-[#6B7280]">Monthly Review · Updated review {report.publishedVersion || 1}</p>
          </div>
          <button type="button" onClick={handleDownload} disabled={working} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-[#1F4ED8] disabled:opacity-50" aria-label="Download monthly review">
            <Download size={17} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 rounded-[18px] bg-[#0B0B0F] p-5 text-white">
          <p className="text-[11px] font-medium text-white/55">Portfolio Value</p>
          <p className="gv-private-value mt-1 font-heading text-[2rem] font-bold leading-none text-white">{formatCurrency(mobileValue)}</p>
          <p className={`gv-private-value mt-2 text-[12px] font-semibold ${mobileMonthChange >= 0 ? "text-[#9BB2FF]" : "text-red-300"}`}>{mobileMonthChange >= 0 ? "+" : ""}{formatCurrency(mobileMonthChange)} net change</p>

          <div className="mt-5 grid grid-cols-2 border-t border-white/15 pt-4">
            <div className="border-r border-white/15 pr-4"><p className="text-[10px] text-white/45">Money Added</p><p className="gv-private-value mt-1 font-heading text-[15px] font-bold text-white">{formatCurrency(mobileNewMoney)}</p></div>
            <div className="pl-4"><p className="text-[10px] text-white/45">Investment Movement</p><p className={`gv-private-value mt-1 font-heading text-[15px] font-bold ${mobileGain >= 0 ? "text-[#9BB2FF]" : "text-red-300"}`}>{mobileGain >= 0 ? "+" : ""}{formatCurrency(mobileGain)}</p></div>
            <div className="mt-4 border-r border-t border-white/15 pr-4 pt-4"><p className="text-[10px] text-white/45">Withdrawals</p><p className="gv-private-value mt-1 font-heading text-[15px] font-bold text-white">{formatCurrency(mobileWithdrawals)}</p></div>
            <div className="mt-4 border-t border-white/15 pl-4 pt-4"><p className="text-[10px] text-white/45">Net Change</p><p className={`gv-private-value mt-1 font-heading text-[15px] font-bold ${mobileMonthChange >= 0 ? "text-[#9BB2FF]" : "text-red-300"}`}>{mobileMonthChange >= 0 ? "+" : ""}{formatCurrency(mobileMonthChange)}</p></div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-heading text-[1.1rem] font-bold text-[#0B0B0F]">What changed this month?</h3>
          <div className="mt-2 overflow-hidden border-y border-slate-200 bg-white">
            {[
              ["Money added", mobileNewMoney, "Confirmed investment inflow", WalletCards, "#1F4ED8"],
              ["Investment movement", mobileGain, "Portfolio performance", mobileGain >= 0 ? ArrowUpRight : ArrowDownRight, mobileGain >= 0 ? "#1F4ED8" : "#E53935"],
              ["Money withdrawn", mobileWithdrawals, "Confirmed withdrawal", ArrowDownRight, "#F5B301"]
            ].map(([label, value, helper, Icon, color], index) => (
              <div key={label} className={`flex min-h-[66px] items-center gap-3 py-3 ${index ? "border-t border-slate-100" : ""}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#F4F6F9]" style={{ color }}><Icon size={18} strokeWidth={1.5} /></span>
                <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-[#0B0B0F]">{label}</p><p className="mt-0.5 text-[11px] text-[#6B7280]">{helper}</p></div>
                <p className={`gv-private-value shrink-0 font-heading text-[13px] font-bold ${label === "Investment movement" && Number(value) < 0 ? "text-[#E53935]" : "text-[#0B0B0F]"}`}>{label === "Investment movement" && Number(value) >= 0 ? "+" : ""}{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 rounded-[15px] bg-[#F4F6F9] px-4 py-3 text-[12px] leading-5 text-[#6B7280]">Detailed insights, goal progress, protection updates and GrowVest next steps are included in your full monthly review.</p>

        <div className="mt-5 grid gap-2">
          <button type="button" onClick={() => setMobileExpanded((current) => !current)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#1F4ED8] px-4 text-[13px] font-bold text-white">
            {mobileExpanded ? "Hide full review" : "View full review"} <ChevronRight size={16} strokeWidth={1.5} className={mobileExpanded ? "rotate-90" : ""} />
          </button>
          <button type="button" onClick={() => document.getElementById("report-discussion")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[#0B0B0F]">
            <MessageCircleMore size={17} strokeWidth={1.5} className="text-[#1F4ED8]" /> Discuss with GrowVest
          </button>
        </div>

        {!isDemoInvestor && !acknowledgement?.acknowledged ? <button type="button" onClick={() => handleAcknowledgement(false)} disabled={working} className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-[12px] font-semibold text-[#1F4ED8] disabled:opacity-60">Acknowledge report received</button> : null}
        {(adjacent.older || adjacent.newer) ? <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          {adjacent.older ? <Link href={`/investor/reports/${adjacent.older.id}`} className="inline-flex min-h-9 items-center gap-1 text-[11px] font-semibold text-[#6B7280]"><ChevronLeft size={14} strokeWidth={1.5} /> Previous</Link> : <span />}
          {adjacent.newer ? <Link href={`/investor/reports/${adjacent.newer.id}`} className="inline-flex min-h-9 items-center gap-1 text-[11px] font-semibold text-[#6B7280]">Next <ChevronRight size={14} strokeWidth={1.5} /></Link> : null}
        </div> : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} /> {notice}
        </div>
      ) : null}

      <div className={`${mobileExpanded ? "grid gap-4" : "hidden"} md:grid md:gap-4`}>
        <InvestorReportSectionNav items={reportTemplateNavItems(report)} />
        <div className="mx-auto w-full max-w-[1280px]">
          <MonthlyWealthReport report={report} history={history} viewer="investor" />
        </div>
      </div>

      <section
        id="report-discussion"
        className="scroll-mt-32 rounded-[16px] bg-[#F4F6F9] p-4 md:rounded-xl md:border md:border-blue-200 md:bg-blue-50 md:p-5"
      >
        <div className="flex items-start gap-3">
          <MessageCircleMore className="mt-0.5 text-[#1F4ED8]" size={21} strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl font-bold text-slate-950">
              Discuss this report with your GrowVest Partner
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Send a question or request a review. Your GrowVest Partner will receive it in their notification centre.
            </p>
            {isDemoInvestor ? (
              <div className="mt-4">
                <DemoInvestorCta compact />
              </div>
            ) : (
              <>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  placeholder="Optional question or comment"
                  className="mt-4 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleAcknowledgement(true)}
                  disabled={working}
                  className="mt-3 rounded-[12px] bg-[#1F4ED8] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  Request Discussion
                </button>
              </>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
