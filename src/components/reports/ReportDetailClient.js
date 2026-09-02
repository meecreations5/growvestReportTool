"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  EyeOff,
  FileCheck2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Printer,
  RefreshCcw,
  Send,
  Trash2,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  setReportInvestorVisibility,
  subscribeInvestorReports,
  subscribeMonthlyReport,
  subscribeReportAcknowledgement
} from "@/services/reportService";
import {
  deleteMonthlyReport,
  downloadReportPdf,
  generateReportPdf,
  publishReportVersion
} from "@/services/communicationService";
import { openWhatsAppChat } from "@/lib/utils/whatsapp";
import { reportWhatsAppMessage } from "@/lib/utils/reportPresentation";
import { getMonthLabel } from "@/lib/constants/report";
import MonthlyWealthReport from "@/components/reports/MonthlyWealthReport";
import ReportStatusBadge from "@/components/reports/ReportStatusBadge";
import ReportVersionHistory from "@/components/reports/ReportVersionHistory";
import ReportPublicationPanel from "@/components/reports/ReportPublicationPanel";
import InvestorReportSectionNav from "@/components/investor/InvestorReportSectionNav";
import { reportTemplateNavItems } from "@/lib/constants/reportTemplates";

function MetaItem({ label, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-700";

  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-xs font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function ReportDetailClient({ reportId }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { accessLevel } = usePermissions();
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [acknowledgement, setAcknowledgement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(
    () =>
      subscribeMonthlyReport(
        reportId,
        (item) => {
          setReport(item);
          setLoading(false);
          if (!item) setError("Monthly report was not found.");
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
    if (!report?.investorId || !profile) return undefined;
    return subscribeInvestorReports(report.investorId, profile, setHistory, () => {});
  }, [report?.investorId, profile]);

  useEffect(() => {
    if (!report?.investorPortalUid) {
      setAcknowledgement(null);
      return undefined;
    }
    return subscribeReportAcknowledgement(
      report.id,
      report.investorPortalUid,
      setAcknowledgement,
      () => {}
    );
  }, [report?.id, report?.investorPortalUid]);

  const revisionInProgress = useMemo(
    () =>
      Boolean(
        report?.investorVisible &&
          report?.publishedSourceVersion &&
          Number(report.version || 0) > Number(report.publishedSourceVersion || 0)
      ),
    [report]
  );

  const reportAccessLevel = accessLevel("reports");
  const reportIsPublished = Boolean(
    report?.investorVisible
    || report?.publicationStatus === "published"
    || report?.activePublishedVersionId
    || Number(report?.publishedVersion || 0) > 0
  );
  const canDeleteReport = Boolean(
    report
    && (["super_admin", "admin"].includes(profile?.role)
      || (profile?.role === "advisor"
        && (reportIsPublished
          ? reportAccessLevel === "full"
          : ["manage", "full"].includes(reportAccessLevel))))
  );

  async function publishReport() {
    if (!report) return;
    if (report.status !== "completed") {
      setError("Complete the report before publishing it to the Investor Portal.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await publishReportVersion(report.id, { sendEmail: true });
      setNotice(
        `Published version ${result.publishedVersion}. Secure PDF generated${
          result.emailStatus === "sent"
            ? " and Investor email sent"
            : result.emailError
              ? `; email failed: ${result.emailError}`
              : ""
        }.`
      );
    } catch (nextError) {
      setError(nextError.message || "Unable to publish report.");
    } finally {
      setWorking(false);
    }
  }

  async function unpublishReport() {
    if (!profile?.id || !report) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await setReportInvestorVisibility(report.id, false, profile);
      setNotice("Report removed from the Investor Portal. Published version history has been preserved.");
    } catch (nextError) {
      setError(nextError.message || "Unable to unpublish report.");
    } finally {
      setWorking(false);
    }
  }

  async function handleGeneratePdf() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await generateReportPdf(report.id);
      setNotice("Secure PDF generated and stored successfully.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleDownloadPdf() {
    setWorking(true);
    setError("");
    try {
      await downloadReportPdf(report.id);
      setNotice("Secure PDF download started.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteReport() {
    if (!report || !canDeleteReport) return;
    const reason = deleteReason.trim();
    if (reason.length < 5) {
      setError("Enter a reason for deleting this report.");
      return;
    }
    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm report deletion.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await deleteMonthlyReport(report.id, { reason, confirmation: "DELETE" });
      setDeleteOpen(false);
      router.replace("/reports");
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to delete report.");
    } finally {
      setWorking(false);
    }
  }

  function openReportWhatsApp() {
    if (!report?.investorContactNo) {
      setError("Investor mobile number is missing.");
      return;
    }
    const viewUrl = `${window.location.origin}/investor/reports/${report.id}`;
    try {
      openWhatsAppChat({
        mobile: report.investorContactNo,
        message: reportWhatsAppMessage(report, viewUrl)
      });
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading monthly report…
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="grid gap-4 rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 text-red-700">
          <AlertTriangle size={22} />
          <p className="font-bold">{error}</p>
        </div>
        <Link
          href="/reports"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-red-700 hover:underline"
        >
          <ArrowLeft size={16} /> Back to reports
        </Link>
      </div>
    );
  }

  if (!report) return null;

  const reportPeriod = `${getMonthLabel(report.reportMonth)} ${report.reportYear}`;
  const emailSuccessful = ["sent", "delivered", "opened", "clicked"].includes(
    String(report.lastEmailStatus || "").toLowerCase()
  );

  return (
    <div className="grid gap-4 pb-24 lg:pb-0">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/reports"
              className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"
            >
              <ArrowLeft size={16} /> Back to reports
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Staff report preview
              </p>
              <ReportStatusBadge status={report.status} />
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  report.investorVisible
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {report.investorVisible
                  ? `Published v${report.publishedVersion || 1}`
                  : "Internal working report"}
              </span>
              {revisionInProgress ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  Revision in progress
                </span>
              ) : null}
            </div>

            <h1 className="mt-2 font-heading text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
              {reportPeriod} Monthly Report
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {report.investorName} · {report.clientCode || report.reportCode} · Working version {report.version || 1} · {report.templateSnapshot?.name || "Report template"} v{report.templateVersion || report.templateSnapshot?.version || 1}
            </p>
          </div>

          <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
            {report.status !== "locked" ? (
              <Link
                href={`/reports/${report.id}/edit`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800"
              >
                <Edit3 size={16} /> Edit Report
              </Link>
            ) : null}

            <Link
              href={`/report-print/${report.id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer size={16} /> Preview PDF
            </Link>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={working || !report.pdfStoragePath}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              <Download size={16} /> Download PDF
            </button>

            {!report.investorVisible ? (
              <button
                type="button"
                onClick={publishReport}
                disabled={working || report.status !== "completed"}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <Send size={16} /> {working ? "Publishing…" : "Publish"}
              </button>
            ) : null}

            <details className="relative">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <MoreHorizontal size={18} /> More
              </summary>
              <div className="absolute right-0 top-12 z-40 grid w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <Link
                  href={`/reports/create?investorId=${report.investorId}&copyFrom=${report.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy size={16} /> Copy Next Month
                </Link>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={working || report.status !== "completed"}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileCheck2 size={16} /> Generate / Regenerate PDF
                </button>
                {report.investorVisible ? (
                  <button
                    type="button"
                    onClick={openReportWhatsApp}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <MessageCircle size={16} /> Share on WhatsApp
                  </button>
                ) : null}
                {report.investorVisible && revisionInProgress ? (
                  <button
                    type="button"
                    onClick={publishReport}
                    disabled={working}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <RefreshCcw size={16} /> Publish Revision
                  </button>
                ) : null}
                {report.investorVisible ? (
                  <button
                    type="button"
                    onClick={unpublishReport}
                    disabled={working}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <EyeOff size={16} /> Unpublish Report
                  </button>
                ) : null}
                {canDeleteReport ? (
                  <button
                    type="button"
                    onClick={() => { setDeleteReason(""); setDeleteConfirmation(""); setDeleteOpen(true); }}
                    disabled={working}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} /> Delete Report
                  </button>
                ) : null}
              </div>
            </details>
          </div>
        </div>

        {(report.lastEmailStatus || report.pdfStoragePath || acknowledgement) ? (
          <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {report.lastEmailStatus ? (
              <MetaItem
                label="Email delivery"
                value={report.lastEmailError ? `${report.lastEmailStatus} — ${report.lastEmailError}` : report.lastEmailStatus}
                tone={emailSuccessful ? "success" : report.lastEmailStatus === "failed" ? "danger" : "default"}
              />
            ) : null}
            {report.pdfStoragePath ? (
              <MetaItem
                label="Secure PDF"
                value={`${report.pdfFileName || "Generated"} · ${report.downloadCount || 0} download(s)`}
                tone="success"
              />
            ) : null}
            {acknowledgement ? (
              <MetaItem
                label="Investor response"
                value={acknowledgement.requestDiscussion ? "Discussion requested" : "Report acknowledged"}
                tone={acknowledgement.requestDiscussion ? "warning" : "success"}
              />
            ) : null}
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      ) : null}

      {report.pdfIsStale ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">The working report changed after its previous PDF was generated.</p>
              <p className="mt-1 leading-6 text-amber-800">The HTML preview below uses {report.templateSnapshot?.name || "the selected template"} version {report.templateVersion || report.templateSnapshot?.version || 1}. Generate a new PDF before sending or publishing this revision.</p>
            </div>
          </div>
          <button type="button" onClick={handleGeneratePdf} disabled={working || report.status !== "completed"} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
            <RefreshCcw size={16} /> Regenerate PDF
          </button>
        </div>
      ) : null}

      <ReportPublicationPanel report={report} acknowledgement={acknowledgement} />
      <InvestorReportSectionNav items={reportTemplateNavItems(report)} />

      <div className="mx-auto w-full max-w-[1280px]">
        <MonthlyWealthReport
          key={`${report.id}-${report.version || 1}-${report.templateId || "template"}-${report.templateVersion || 1}-${report.templateAppliedAt || "initial"}`}
          report={report}
          history={history}
          viewer="staff"
        />
      </div>

      <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-700 sm:px-5">
          Version history and published snapshots
        </summary>
        <div className="border-t border-slate-200 p-4 sm:p-5">
          <ReportVersionHistory reportId={report.id} activeVersionId={report.activePublishedVersionId} />
        </div>
      </details>

      {canDeleteReport ? (
        <section className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-sm lg:hidden">
          <p className="text-sm font-bold text-red-900">Report management</p>
          <p className="mt-1 text-xs leading-5 text-red-800">Delete only this report. Portfolio Master, Bucket Lists, Investor Profile actions and financial transactions remain unchanged.</p>
          <button type="button" onClick={() => { setDeleteReason(""); setDeleteConfirmation(""); setDeleteOpen(true); }} disabled={working} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-50">
            <Trash2 size={16} /> Delete Report
          </button>
        </section>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Delete Monthly Report">
          <button type="button" className="absolute inset-0" aria-label="Close delete report dialog" onClick={() => working ? null : setDeleteOpen(false)} />
          <section className="relative z-10 w-full max-w-xl rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><Trash2 size={20} /></span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Controlled report deletion</p>
                  <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Delete {reportPeriod} Report?</h2>
                </div>
              </div>
              <button type="button" onClick={() => setDeleteOpen(false)} disabled={working} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              This removes the Monthly Report, its stored PDFs, published versions, acknowledgements/download records and Investor Portal visibility. Portfolio Master, Bucket Lists, Profile actions, completed withdrawals and financial transactions are preserved.
            </div>
            {reportIsPublished ? <p className="mt-3 text-xs font-semibold text-red-700">This report is published. Deleting it removes the live Investor Portal report immediately.</p> : null}
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-bold text-slate-700">Reason for deletion</span>
                <textarea rows={3} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Why is this report being deleted?" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold text-slate-700">Type DELETE to confirm</span>
                <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="DELETE" />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={() => setDeleteOpen(false)} disabled={working} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDeleteReport} disabled={working || deleteReason.trim().length < 5 || deleteConfirmation.trim().toUpperCase() !== "DELETE"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
                <Trash2 size={16} /> {working ? "Deleting..." : "Delete Report"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.10)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          {report.status !== "locked" ? (
            <Link
              href={`/reports/${report.id}/edit`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
            >
              <Edit3 size={16} /> Edit report
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={working || !report.pdfStoragePath}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              <Download size={16} /> Download
            </button>
          )}

          {report.investorVisible ? (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={working || !report.pdfStoragePath}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] text-sm font-bold text-white disabled:opacity-50"
            >
              <Download size={16} /> PDF
            </button>
          ) : (
            <button
              type="button"
              onClick={publishReport}
              disabled={working || report.status !== "completed"}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-50"
            >
              <RefreshCcw size={16} /> Publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
