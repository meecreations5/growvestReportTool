"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MailCheck,
  MailOpen,
  Paperclip,
  RefreshCcw,
  Search,
  Send,
  X
} from "lucide-react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import MetricCard from "@/components/ui/MetricCard";
import { inputClassName } from "@/components/ui/Field";
import EmailDeliveryStatusBadge from "@/components/email-delivery/EmailDeliveryStatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { DELIVERY_ATTENTION_STATES, DELIVERY_SUCCESS_STATES, normaliseDeliveryStatus } from "@/lib/constants/emailDelivery";
import { getMonthLabel } from "@/lib/constants/report";
import {
  listEmailDeliveries,
  scheduleReportDelivery,
  sendReportDelivery,
  sendReportDeliveryTest
} from "@/services/emailDeliveryService";
import { downloadReportPdf } from "@/services/communicationService";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function periodLabel(row) {
  if (row.reportMonth && row.reportYear) return `${getMonthLabel(row.reportMonth)} ${row.reportYear}`;
  return row.reportMonthKey || "—";
}

function latestStatus(row) {
  return normaliseDeliveryStatus(row.lastEmailStatus || row.latestDelivery?.status || "pending");
}

function eligibleForDelivery(row) {
  return row.reportStatus === "completed" && row.investorVisible === true;
}

function defaultSubject(row) {
  return `Your GrowVest Monthly Wealth Report — ${periodLabel(row)}`;
}

function defaultMessage(row) {
  return `Your GrowVest monthly wealth report for ${periodLabel(row)} is ready. Please review it through your secure Investor Portal. You may reply to this email or contact your Advisor if you would like to discuss any part of the report.`;
}

function DeliveryComposer({ row, profile, mode, onClose, onComplete }) {
  const previous = row.latestDelivery || {};
  const [form, setForm] = useState({
    recipientEmail: previous.recipientEmail || row.investorEmail || "",
    cc: Array.isArray(previous.cc) ? previous.cc.join(", ") : "",
    bcc: Array.isArray(previous.bcc) ? previous.bcc.join(", ") : "",
    subject: previous.subject || defaultSubject(row),
    message: previous.message || defaultMessage(row),
    attachPdf: Boolean(row.pdfStoragePath),
    scheduledFor: ""
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function run(action) {
    setBusy(action);
    setError("");
    try {
      const payload = {
        reportId: row.reportId,
        deliveryId: mode === "retry" && previous.id && !String(previous.id).startsWith("legacy-") ? previous.id : undefined,
        ...form,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : "",
        cc: form.cc,
        bcc: form.bcc
      };
      if (action === "test") await sendReportDeliveryTest(payload);
      if (action === "send") await sendReportDelivery(payload);
      if (action === "schedule") await scheduleReportDelivery(payload);
      onComplete(action === "test" ? `Test email sent to ${profile?.email}.` : action === "schedule" ? "Report delivery scheduled." : "Report email sent.");
      if (action !== "test") onClose();
    } catch (nextError) {
      setError(nextError.message || "Unable to complete the delivery action.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Report email composer">
      <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[22px]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="gv-eyebrow">Email delivery</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{mode === "retry" ? "Retry report delivery" : "Send monthly report"}</h2>
            <p className="mt-1 text-sm text-slate-500">{row.investorName} · {periodLabel(row)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close email composer"><X size={20} /></button>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:px-7">
          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
          {!eligibleForDelivery(row) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Complete and publish this report before sending it to the Investor.
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              Investor email
              <input className={inputClassName} type="email" value={form.recipientEmail} onChange={(event) => update("recipientEmail", event.target.value)} placeholder="investor@example.com" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              CC <span className="text-xs font-normal text-slate-400">Comma separated</span>
              <input className={inputClassName} value={form.cc} onChange={(event) => update("cc", event.target.value)} placeholder="advisor@growvest.info" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              BCC <span className="text-xs font-normal text-slate-400">Comma separated</span>
              <input className={inputClassName} value={form.bcc} onChange={(event) => update("bcc", event.target.value)} placeholder="archive@growvest.info" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Subject
            <input className={inputClassName} value={form.subject} onChange={(event) => update("subject", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Email message
            <textarea className={`${inputClassName} min-h-36 resize-y`} value={form.message} onChange={(event) => update("message", event.target.value)} />
            <span className="text-xs font-normal leading-5 text-slate-500">GrowVest branding, secure portal button and Advisor signature are added automatically.</span>
          </label>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-start gap-3">
              <Paperclip size={18} className="mt-0.5 text-blue-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Attach generated PDF</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{row.pdfFileName || "Generate a secure PDF before attaching it."}</p>
              </div>
            </div>
            <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={form.attachPdf} disabled={!row.pdfStoragePath} onChange={(event) => update("attachPdf", event.target.checked)} aria-label="Attach generated PDF" />
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Schedule date and time
            <input className={inputClassName} type="datetime-local" value={form.scheduledFor} onChange={(event) => update("scheduledFor", event.target.value)} />
          </label>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Button type="button" variant="quiet" onClick={() => run("test")} disabled={Boolean(busy)}>
            {busy === "test" ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Send test to me
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => run("schedule")} disabled={Boolean(busy) || !form.scheduledFor || !eligibleForDelivery(row)}>
              {busy === "schedule" ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />} Schedule
            </Button>
            <Button type="button" onClick={() => run("send")} disabled={Boolean(busy) || !eligibleForDelivery(row)}>
              {busy === "send" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryDetails({ row, deliveries, onClose, onSend, onDownload }) {
  const attempts = deliveries.filter((item) => item.reportId === row.reportId && !item.testMode);
  const latest = row.latestDelivery || attempts[0] || {};
  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/35" role="dialog" aria-modal="true" aria-label="Delivery details">
      <div className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
          <div>
            <p className="gv-eyebrow">Delivery history</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{row.investorName}</h2>
            <p className="mt-1 text-sm text-slate-500">{row.reportCode || periodLabel(row)} · {periodLabel(row)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close delivery details"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <EmailDeliveryStatusBadge status={row.lastEmailStatus} />
              <span className="text-xs text-slate-500">{formatDateTime(row.lastEmailAttemptAt)}</span>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Recipient</dt><dd className="mt-1 break-all font-semibold text-slate-900">{latest.recipientEmail || row.investorEmail || "—"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Advisor</dt><dd className="mt-1 font-semibold text-slate-900">{row.advisorName || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Subject</dt><dd className="mt-1 font-semibold text-slate-900">{latest.subject || defaultSubject(row)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Message</dt><dd className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 leading-6 text-slate-700">{latest.message || "The original message body is not available for this legacy delivery."}</dd></div>
            </dl>
            {row.lastEmailError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700"><strong>Failure reason:</strong> {row.lastEmailError}</div> : null}
          </div>
          <div className="mt-6">
            <h3 className="font-heading text-lg font-bold text-slate-950">Delivery attempts</h3>
            <div className="mt-3 grid gap-3">
              {attempts.length ? attempts.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><EmailDeliveryStatusBadge status={item.status} /><span className="text-xs text-slate-500">{formatDateTime(item.sentAt || item.scheduledFor || item.updatedAt)}</span></div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{item.subject || defaultSubject(row)}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{item.recipientEmail || row.investorEmail}</p>
                  {item.deliveredAt ? <p className="mt-2 text-xs text-emerald-700">Delivered {formatDateTime(item.deliveredAt)}</p> : null}
                  {item.openedAt ? <p className="mt-1 text-xs text-emerald-700">Opened {formatDateTime(item.openedAt)}</p> : null}
                  {item.failureReason ? <p className="mt-2 text-xs leading-5 text-red-700">{item.failureReason}</p> : null}
                </div>
              )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No detailed delivery attempts are stored for this report yet.</p>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4 sm:px-7">
          <Button type="button" onClick={onSend}><Send size={16} /> {DELIVERY_ATTENTION_STATES.has(latestStatus(row)) ? "Retry" : "Send report"}</Button>
          <Button type="button" variant="secondary" onClick={onDownload} disabled={!row.pdfStoragePath}><Download size={16} /> Download PDF</Button>
          <Link href={`/reports/${row.reportId}`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--gv-radius-md)] border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileText size={16} className="mr-2" /> Open report</Link>
        </div>
      </div>
    </div>
  );
}

export default function EmailDeliveryCentre() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");
  const [advisor, setAdvisor] = useState("all");
  const [composer, setComposer] = useState(null);
  const [details, setDetails] = useState(null);
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const result = await listEmailDeliveries();
      setRows(result.rows || []);
      setDeliveries(result.deliveries || []);
    } catch (nextError) {
      setError(nextError.message || "Unable to load Email & Delivery Centre.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const monthOptions = useMemo(() => [...new Set(rows.map((row) => row.reportMonthKey).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [rows]);
  const advisorOptions = useMemo(() => {
    const values = new Map();
    rows.forEach((row) => { if (row.advisorUid) values.set(row.advisorUid, row.advisorName || "Advisor"); });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const currentStatus = latestStatus(row);
      if (status !== "all") {
        if (status === "failed" && !DELIVERY_ATTENTION_STATES.has(currentStatus)) return false;
        else if (status === "sent" && !DELIVERY_SUCCESS_STATES.has(currentStatus)) return false;
        else if (!["failed", "sent"].includes(status) && currentStatus !== status) return false;
      }
      if (month !== "all" && row.reportMonthKey !== month) return false;
      if (advisor !== "all" && row.advisorUid !== advisor) return false;
      if (!term) return true;
      return [row.investorName, row.clientCode, row.investorEmail, row.reportCode, row.reportTitle, row.advisorName, row.reportMonthKey]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [advisor, month, rows, search, status]);

  const metrics = useMemo(() => {
    const statuses = rows.map(latestStatus);
    return {
      sent: statuses.filter((item) => DELIVERY_SUCCESS_STATES.has(item)).length,
      delivered: statuses.filter((item) => ["delivered", "opened", "clicked"].includes(item)).length,
      opened: statuses.filter((item) => ["opened", "clicked"].includes(item)).length,
      failed: statuses.filter((item) => DELIVERY_ATTENTION_STATES.has(item)).length,
      scheduled: statuses.filter((item) => item === "scheduled").length,
      pending: rows.filter((row) => eligibleForDelivery(row) && ["pending", "not_ready", "skipped"].includes(latestStatus(row))).length
    };
  }, [rows]);

  async function handleDownload(row) {
    setDownloading(row.reportId);
    setError("");
    try { await downloadReportPdf(row.reportId); }
    catch (nextError) { setError(nextError.message || "Unable to download the PDF."); }
    finally { setDownloading(""); }
  }

  function completeAction(message) {
    setNotice(message);
    load(true);
  }

  if (loading) {
    return <div className="grid gap-4"><div className="h-24 animate-pulse rounded-xl bg-slate-200" /><div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}</div><div className="h-96 animate-pulse rounded-xl bg-slate-200" /></div>;
  }

  return (
    <div className="grid gap-6 pb-24 lg:pb-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="gv-eyebrow">Report communication</p>
          <h1 className="gv-page-title mt-2">Email & Delivery Centre</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Send, schedule and track monthly Investor report emails, PDF attachments and delivery outcomes from one audit-friendly workspace.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => load(true)} disabled={refreshing}><RefreshCcw size={17} className={refreshing ? "animate-spin" : ""} /> Refresh delivery status</Button>
      </header>

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricCard label="Reports Sent" value={metrics.sent} helper="Sent or progressed further" icon={Send} tone="blue" />
        <MetricCard label="Delivered" value={metrics.delivered} helper="Confirmed by email provider" icon={MailCheck} tone="green" />
        <MetricCard label="Opened" value={metrics.opened} helper="Investor engagement" icon={MailOpen} tone="green" />
        <MetricCard label="Failed" value={metrics.failed} helper="Bounce, block or error" icon={AlertTriangle} tone="red" />
        <MetricCard label="Scheduled" value={metrics.scheduled} helper="Queued for future delivery" icon={CalendarClock} tone="cyan" />
        <MetricCard label="Pending" value={metrics.pending} helper="Published, not yet sent" icon={Clock3} tone="amber" />
      </div>

      <section className="gv-card overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px]">
          <label className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Investor, report, email or client code" /></label>
          <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="sent">Sent / delivered</option><option value="delivered">Delivered</option><option value="opened">Opened</option><option value="failed">Failed / bounced</option></select>
          <select className={inputClassName} value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">All report months</option>{monthOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className={inputClassName} value={advisor} onChange={(event) => setAdvisor(event.target.value)}><option value="all">All Advisors</option>{advisorOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        </div>

        {!visibleRows.length ? (
          <div className="p-6"><EmptyState icon={Inbox} title="No report deliveries found" description="Try changing the filters, or publish a completed monthly report before sending it to the Investor." /></div>
        ) : (
          <>
            <div className="grid gap-3 p-4 lg:hidden">
              {visibleRows.map((row) => {
                const currentStatus = latestStatus(row);
                return (
                  <article key={row.reportId} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{row.investorName || "Investor"}</h2><p className="mt-1 text-xs text-slate-500">{row.clientCode || row.reportCode || "—"}</p></div><EmailDeliveryStatusBadge status={row.lastEmailStatus} /></div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Report month</dt><dd className="mt-1 font-semibold text-slate-900">{periodLabel(row)}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last attempt</dt><dd className="mt-1 font-semibold text-slate-900">{formatDateTime(row.lastEmailAttemptAt)}</dd></div><div className="col-span-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 break-all font-semibold text-slate-900">{row.investorEmail || "Missing"}</dd></div></dl>
                    {row.lastEmailError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">{row.lastEmailError}</p> : null}
                    <div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" onClick={() => setComposer({ row, mode: DELIVERY_ATTENTION_STATES.has(currentStatus) ? "retry" : "send" })} disabled={!eligibleForDelivery(row)}><Send size={16} /> {DELIVERY_ATTENTION_STATES.has(currentStatus) ? "Retry" : "Send"}</Button><Button type="button" variant="secondary" onClick={() => setDetails(row)}><Eye size={16} /> View</Button></div>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Investor</th><th className="px-4 py-3">Report Month</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last Activity</th><th className="px-4 py-3">Advisor</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
                <tbody>{visibleRows.map((row) => {
                  const currentStatus = latestStatus(row);
                  return <tr key={row.reportId} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-950">{row.investorName || "Investor"}</p><p className="mt-1 text-xs text-slate-500">{row.clientCode || row.reportCode || "—"}</p></td><td className="px-4 py-4 font-semibold text-slate-700">{periodLabel(row)}</td><td className="px-4 py-4"><p className="max-w-[220px] truncate font-medium text-slate-700" title={row.investorEmail}>{row.investorEmail || "Missing email"}</p>{row.lastEmailError ? <p className="mt-1 max-w-[240px] truncate text-xs text-red-600" title={row.lastEmailError}>{row.lastEmailError}</p> : null}</td><td className="px-4 py-4"><EmailDeliveryStatusBadge status={row.lastEmailStatus} /></td><td className="px-4 py-4 text-slate-600">{formatDateTime(row.lastEmailAttemptAt)}</td><td className="px-4 py-4 text-slate-600">{row.advisorName || "—"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button type="button" size="sm" onClick={() => setComposer({ row, mode: DELIVERY_ATTENTION_STATES.has(currentStatus) ? "retry" : "send" })} disabled={!eligibleForDelivery(row)}>{DELIVERY_ATTENTION_STATES.has(currentStatus) ? <RefreshCcw size={15} /> : <Send size={15} />}{DELIVERY_ATTENTION_STATES.has(currentStatus) ? "Retry" : "Send"}</Button><Button type="button" size="sm" variant="secondary" onClick={() => setDetails(row)}><Eye size={15} /> View</Button><Button type="button" size="sm" variant="quiet" onClick={() => handleDownload(row)} disabled={!row.pdfStoragePath || downloading === row.reportId}>{downloading === row.reportId ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF</Button></div></td></tr>;
                })}</tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="gv-card p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Mail size={19} /></span><div><h2 className="font-heading text-lg font-bold text-slate-950">Delivery tracking</h2><p className="text-sm text-slate-500">Sent, delivered, opened and failed statuses</p></div></div><p className="mt-4 text-sm leading-6 text-slate-600">Configure the Brevo transactional webhook to receive real-time delivered, opened, clicked, bounced and blocked events. Without the webhook, successful sends remain marked as Sent.</p></div>
        <div className="gv-card p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><CalendarClock size={19} /></span><div><h2 className="font-heading text-lg font-bold text-slate-950">Scheduled delivery</h2><p className="text-sm text-slate-500">Process due emails through the protected cron endpoint</p></div></div><p className="mt-4 text-sm leading-6 text-slate-600">Call <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/cron/report-deliveries</code> with the configured cron secret on a regular schedule.</p></div>
      </section>

      {composer ? <DeliveryComposer row={composer.row} profile={profile} mode={composer.mode} onClose={() => setComposer(null)} onComplete={completeAction} /> : null}
      {details ? <DeliveryDetails row={details} deliveries={deliveries} onClose={() => setDetails(null)} onSend={() => { const row = details; setDetails(null); setComposer({ row, mode: DELIVERY_ATTENTION_STATES.has(latestStatus(row)) ? "retry" : "send" }); }} onDownload={() => handleDownload(details)} /> : null}
    </div>
  );
}
