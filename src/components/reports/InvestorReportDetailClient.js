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
  Printer
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeMonthlyReport,
  subscribePublishedInvestorReports,
  subscribeReportAcknowledgement,
  subscribeReportVersion
} from "@/services/reportService";
import {
  downloadReportPdf,
  submitReportAcknowledgement
} from "@/services/communicationService";
import { getMonthLabel } from "@/lib/constants/report";
import MonthlyWealthReport from "@/components/reports/MonthlyWealthReport";
import InvestorReportSectionNav from "@/components/investor/InvestorReportSectionNav";

export default function InvestorReportDetailClient({ reportId }) {
  const { profile } = useAuth();
  const [reportMeta, setReportMeta] = useState(null);
  const [publishedVersion, setPublishedVersion] = useState(null);
  const [history, setHistory] = useState([]);
  const [acknowledgement, setAcknowledgement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comment, setComment] = useState("");

  useEffect(
    () =>
      subscribeMonthlyReport(
        reportId,
        (item) => {
          if (item && (!item.investorVisible || item.status !== "completed" || !item.activePublishedVersionId)) {
            setError("This report has not been published to the Investor Portal.");
            setReportMeta(null);
          } else {
            setReportMeta(item);
            if (!item) setError("Monthly report was not found.");
          }
          setLoading(false);
        },
        (nextError) => {
          console.error(nextError);
          setError("You do not have access to this monthly report.");
          setLoading(false);
        }
      ),
    [reportId]
  );

  useEffect(() => {
    if (!reportMeta?.activePublishedVersionId) return undefined;
    return subscribeReportVersion(
      reportMeta.activePublishedVersionId,
      (item) => {
        setPublishedVersion(
          item
            ? {
                ...item,
                id: reportId,
                versionId: item.id,
                activePublishedVersionId: item.id
              }
            : null
        );
      },
      (nextError) => {
        console.error(nextError);
        setError("The published report version could not be loaded.");
      }
    );
  }, [reportId, reportMeta?.activePublishedVersionId]);

  useEffect(() => {
    if (!reportMeta?.investorId) return undefined;
    return subscribePublishedInvestorReports(reportMeta.investorId, setHistory, () => {});
  }, [reportMeta?.investorId]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeReportAcknowledgement(reportId, profile.id, setAcknowledgement, () => {});
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
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await submitReportAcknowledgement(report.id, { requestDiscussion, comment });
      setNotice(
        requestDiscussion
          ? "Your discussion request was sent to your Advisor."
          : "Report acknowledged successfully."
      );
      setComment("");
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

  return (
    <div className="grid gap-4 pb-24 lg:pb-0">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
            <Link
              href={`/report-print/${reportId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <Printer size={16} /> Print Preview
            </Link>
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

        {!acknowledgement?.acknowledged ? (
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

      <InvestorReportSectionNav />

      <div className="mx-auto w-full max-w-[1280px]">
        <MonthlyWealthReport report={report} history={history} viewer="investor" />
      </div>

      <section
        id="report-discussion"
        className="scroll-mt-32 rounded-xl border border-blue-200 bg-blue-50 p-5"
      >
        <div className="flex items-start gap-3">
          <MessageCircleMore className="mt-0.5 text-blue-700" size={21} />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl font-bold text-slate-950">
              Discuss this report with your Advisor
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Send a question or request a review. Your Advisor will receive it in their notification centre.
            </p>
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
              className="mt-3 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              Request Discussion
            </button>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/97 px-4 py-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={working}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] text-sm font-bold text-white disabled:opacity-60"
          >
            <Download size={16} /> {working ? "Preparing…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("report-discussion")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600"
          >
            <MessageCircleMore size={16} /> Discuss
          </button>
        </div>
      </div>
    </div>
  );
}
