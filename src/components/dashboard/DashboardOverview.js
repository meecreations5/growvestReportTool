"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  IndianRupee,
  MailCheck,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Upload,
  UsersRound,
  XCircle
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import { subscribeMonthlyReports } from "@/services/reportService";
import { REPORT_STATUS, getMonthLabel } from "@/lib/constants/report";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import Skeleton from "@/components/ui/Skeleton";

const SENT_EMAIL_STATES = new Set(["sent", "delivered", "opened", "clicked"]);
const FAILED_EMAIL_STATES = new Set(["failed", "bounced"]);

const STATUS_FILTERS = [
  { value: "ALL", label: "All reports" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "issues", label: "Needs attention" }
];

const WORKFLOW_STAGES = [
  { key: "selected", label: "Investor selected", shortLabel: "Selected" },
  { key: "dataAdded", label: "Data added", shortLabel: "Data" },
  { key: "generated", label: "Report generated", shortLabel: "Generated" },
  { key: "commentary", label: "Commentary added", shortLabel: "Commentary" },
  { key: "review", label: "Internal review", shortLabel: "Review" },
  { key: "approved", label: "Approved", shortLabel: "Approved" },
  { key: "pdf", label: "PDF created", shortLabel: "PDF" },
  { key: "sent", label: "Sent to Investor", shortLabel: "Sent" }
];

function dateFromValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "object" && Number.isFinite(value?.seconds)) return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeValue(value) {
  return dateFromValue(value)?.getTime() || 0;
}

function keyForDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function keyToDate(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  return new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), 1);
}

function shiftMonthKey(monthKey, offset) {
  const date = keyToDate(monthKey);
  date.setMonth(date.getMonth() + offset);
  return keyForDate(date);
}

function monthKeyLabel(monthKey) {
  const date = keyToDate(monthKey);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
}

function shortMonthLabel(monthKey) {
  const date = keyToDate(monthKey);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(date);
}

function financialYearStart(date) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function financialYearValue(date) {
  const start = financialYearStart(date);
  return `${start}-${String(start + 1).slice(-2)}`;
}

function financialYearLabel(value) {
  return `FY ${value}`;
}

function monthKeysForFinancialYear(value) {
  const startYear = Number(String(value).split("-")[0]);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(startYear, 3 + index, 1);
    return keyForDate(date);
  });
}

function formatPercent(value, digits = 1) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}%`;
}


function isEmailSent(report) {
  return SENT_EMAIL_STATES.has(String(report?.lastEmailStatus || "").toLowerCase());
}

function isEmailFailed(report) {
  return FAILED_EMAIL_STATES.has(String(report?.lastEmailStatus || "").toLowerCase());
}

function hasCoreReportData(report) {
  return Boolean(
    Number(report?.summary?.totalCorpus || 0) > 0
    && Number(report?.summary?.lifetimeTarget || 0) > 0
    && Array.isArray(report?.holdings)
    && report.holdings.length
  );
}

function hasCommentary(report) {
  return Boolean(
    String(report?.advisorInsights?.narrative || report?.advisorNote?.content || "").trim()
    || (Array.isArray(report?.monthlyHighlights) && report.monthlyHighlights.length)
  );
}

function reportDataIssues(report) {
  const issues = [];
  if (!report?.investorId || !report?.investorName) issues.push("Investor details are incomplete");
  if (!report?.statementDate) issues.push("Statement date is missing");
  if (Number(report?.summary?.totalCorpus || 0) <= 0) issues.push("Portfolio value is missing");
  if (Number(report?.summary?.lifetimeTarget || 0) <= 0) issues.push("Lifetime target is missing");
  if (!Array.isArray(report?.holdings) || !report.holdings.length) issues.push("Asset composition is missing");
  if (!Array.isArray(report?.funds) || !report.funds.length) issues.push("Detailed holdings are missing");
  if (!hasCommentary(report)) issues.push("Advisor commentary is missing");
  return issues;
}

function calculatedMonthlyReturn(report) {
  const explicit = Number(report?.summary?.monthlyReturn ?? report?.monthlyReturn);
  if (Number.isFinite(explicit) && explicit !== 0) return explicit;
  const closing = Number(report?.summary?.totalCorpus || 0);
  const gain = Number(report?.summary?.investmentGain || 0);
  const base = closing - gain - Number(report?.summary?.newMoneyAdded || 0);
  if (base <= 0) return 0;
  return (gain / base) * 100;
}

function reportDashboardStatus(report) {
  if (isEmailFailed(report)) return { key: "failed", label: "Delivery failed", classes: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" };
  if (isEmailSent(report)) return { key: "sent", label: "Sent", classes: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  if (report?.pdfStoragePath) return { key: "pdf", label: "PDF ready", classes: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-600" };
  if (report?.status === REPORT_STATUS.COMPLETED) return { key: "approved", label: "Approved", classes: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  if (report?.status === REPORT_STATUS.LOCKED) return { key: "review", label: "Under review", classes: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" };
  if (reportDataIssues(report).length) return { key: "issues", label: "Data pending", classes: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" };
  return { key: "draft", label: "Draft", classes: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400" };
}

function reportUpdatedAt(report) {
  return report?.lastEmailAttemptAt || report?.publishedAt || report?.completedAt || report?.updatedAt || report?.createdAt;
}

function latestPerInvestor(reports) {
  const map = new Map();
  [...reports]
    .sort((a, b) => dateTimeValue(reportUpdatedAt(b)) - dateTimeValue(reportUpdatedAt(a)))
    .forEach((report) => {
      const key = report.investorId || report.clientCode || report.id;
      if (!map.has(key)) map.set(key, report);
    });
  return [...map.values()];
}

function difference(current, previous) {
  return Number(current || 0) - Number(previous || 0);
}

function trendLabel(current, previous) {
  const delta = difference(current, previous);
  if (delta === 0) return "No change from previous month";
  return `${delta > 0 ? "+" : ""}${delta} from previous month`;
}

function DashboardStatusBadge({ report }) {
  const status = reportDashboardStatus(report);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.label}
    </span>
  );
}

function DashboardMetricCard({ label, value, helper, previous, icon: Icon, tone = "blue", href, priority = false }) {
  const tones = {
    blue: { icon: "bg-blue-50 text-blue-700", line: "bg-blue-600" },
    indigo: { icon: "bg-indigo-50 text-indigo-700", line: "bg-indigo-500" },
    emerald: { icon: "bg-emerald-50 text-emerald-700", line: "bg-emerald-500" },
    amber: { icon: "bg-amber-50 text-amber-700", line: "bg-amber-500" },
    red: { icon: "bg-red-50 text-red-700", line: "bg-red-500" },
    cyan: { icon: "bg-cyan-50 text-cyan-700", line: "bg-cyan-500" },
    slate: { icon: "bg-slate-100 text-slate-700", line: "bg-slate-400" }
  };
  const theme = tones[tone] || tones.blue;
  const delta = Number.isFinite(Number(previous)) ? difference(value, previous) : null;
  const TrendIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;

  const content = (
    <div className={`group relative h-full overflow-hidden rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${priority ? "border-slate-200 hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(31,78,216,0.08)]" : "border-slate-200/90 hover:border-slate-300"}`}>
      <span className={`absolute inset-x-0 top-0 h-[3px] ${theme.line}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-9 text-[11px] font-bold uppercase leading-[1.25] tracking-[0.08em] text-slate-500 sm:min-h-0">{label}</p>
          <p className="mt-2 font-heading text-[27px] font-bold leading-none tabular-nums text-slate-950 sm:text-[30px]">{value}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${theme.icon}`}><Icon size={18} aria-hidden="true" /></span>
      </div>
      <div className="mt-3 flex min-h-8 items-start gap-1.5 text-[11px] leading-4 text-slate-500">
        {delta !== null ? <TrendIcon size={14} className={`mt-0.5 shrink-0 ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`} aria-hidden="true" /> : null}
        <span>{helper || (delta !== null ? trendLabel(value, previous) : "Open details")}</span>
      </div>
    </div>
  );

  return href ? <Link href={href} className="block min-w-0 focus-visible:rounded-xl">{content}</Link> : content;
}

function DashboardHeader({ selectedMonthKey, onMonthChange, financialYear, onFinancialYearChange, financialYears }) {
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const monthOptions = monthKeysForFinancialYear(financialYear);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Monthly reporting workspace</p>
        <h1 className="mt-2 font-heading text-[34px] font-bold leading-none text-slate-950 sm:text-[42px]">Monthly Report Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
          Create, review and deliver professional monthly Investor reports from one focused workspace.
        </p>
        <p className="mt-2 text-xs font-medium text-slate-400">{today}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_190px_auto_auto]">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Financial year</span>
          <select value={financialYear} onChange={(event) => onFinancialYearChange(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
            {financialYears.map((value) => <option key={value} value={value}>{financialYearLabel(value)}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Reporting month</span>
          <select value={selectedMonthKey} onChange={(event) => onMonthChange(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
            {monthOptions.map((key) => <option key={key} value={key}>{monthKeyLabel(key)}</option>)}
          </select>
        </label>
        <Link href={`/reports/create?month=${selectedMonthKey}&mode=import`} className="hidden min-h-11 items-center justify-center gap-2 self-end rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:inline-flex">
          <Upload size={17} /> Import Data
        </Link>
        <Link href={`/reports/create?month=${selectedMonthKey}`} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 sm:col-span-2 lg:col-span-1">
          <Plus size={17} /> Generate New Report
        </Link>
      </div>
    </section>
  );
}

function WorkflowPanel({ stages, totalInvestors, completion, delayed, averagePreparation }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Monthly report workflow</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">From Investor selection to delivery</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Track how reports are progressing through the monthly preparation cycle.</p>
        </div>
        <Link href="/reports" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">View all reports <ArrowRight size={16} /></Link>
      </div>

      <div className="p-4 sm:p-5">
        <div className="hidden grid-cols-4 gap-2 lg:grid xl:grid-cols-8">
          {WORKFLOW_STAGES.map((stage, index) => {
            const count = stages[stage.key] || 0;
            const complete = index === 0 ? count > 0 : count >= (stages[WORKFLOW_STAGES[index - 1]?.key] || 0) && count > 0;
            const current = count > 0 && count < totalInvestors;
            return (
              <Link key={stage.key} href="/reports" className="group relative min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
                {index < WORKFLOW_STAGES.length - 1 ? <span className="absolute -right-2 top-1/2 z-10 hidden h-px w-2 bg-slate-300 xl:block" /> : null}
                <div className="flex items-center justify-between gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${complete ? "bg-emerald-100 text-emerald-700" : current ? "bg-blue-100 text-blue-700" : "bg-white text-slate-400"}`}>{index + 1}</span>
                  <span className="font-heading text-lg font-bold tabular-nums text-slate-950">{count}</span>
                </div>
                <p className="mt-3 min-h-8 text-[11px] font-semibold leading-4 text-slate-600">{stage.label}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <span className={`block h-full rounded-full ${complete ? "bg-emerald-500" : current ? "bg-blue-600" : "bg-slate-300"}`} style={{ width: `${totalInvestors ? Math.min(100, (count / totalInvestors) * 100) : 0}%` }} />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid gap-0 lg:hidden">
          {WORKFLOW_STAGES.map((stage, index) => {
            const count = stages[stage.key] || 0;
            const percentage = totalInvestors ? Math.min(100, (count / totalInvestors) * 100) : 0;
            return (
              <Link key={stage.key} href="/reports" className="group relative grid min-h-16 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
                <span className="relative grid h-7 w-7 place-items-center rounded-full border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700">
                  {index + 1}
                  {index < WORKFLOW_STAGES.length - 1 ? <span className="absolute left-1/2 top-full h-9 w-px -translate-x-1/2 bg-slate-200" /> : null}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{stage.label}</p><span className="text-xs font-bold text-slate-400">{percentage.toFixed(0)}%</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} /></div>
                </div>
                <span className="font-heading text-xl font-bold tabular-nums text-slate-950">{count}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/70 py-3">
          <div className="px-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Completion</p><p className="mt-1 font-heading text-lg font-bold text-blue-700">{completion.toFixed(0)}%</p></div>
          <div className="px-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Delayed</p><p className={`mt-1 font-heading text-lg font-bold ${delayed ? "text-red-600" : "text-emerald-600"}`}>{delayed}</p></div>
          <div className="px-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Avg. preparation</p><p className="mt-1 font-heading text-lg font-bold text-slate-950">{averagePreparation}</p></div>
        </div>
      </div>
    </section>
  );
}

function AttentionPanel({ items, selectedMonthKey }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Requires attention</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Priority report actions</h2>
          </div>
          {items.length ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{items.length}</span> : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">Highest-priority issues for {monthKeyLabel(selectedMonthKey)}.</p>
      </div>

      {items.length ? (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} className="group flex gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.tone === "red" ? "bg-red-50 text-red-600" : item.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold leading-5 text-slate-900">{item.title}</p><ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-blue-700" /></div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.context}</p>
                  <p className={`mt-1 text-[11px] font-semibold ${item.tone === "red" ? "text-red-600" : item.tone === "amber" ? "text-amber-700" : "text-blue-700"}`}>{item.helper}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-60 place-items-center px-6 py-10 text-center">
          <div>
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={21} /></span>
            <p className="mt-3 text-sm font-semibold text-slate-800">No urgent report issues</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Delivery failures, incomplete data and overdue reports will appear here.</p>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
        <Link href="/reports" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900">View complete report queue <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}

function RecentReports({ reports, search, onSearchChange, statusFilter, onStatusChange, selectedMonthKey }) {
  return (
    <section id="recent-monthly-reports" className="scroll-mt-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Monthly report register</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Recent reports · {monthKeyLabel(selectedMonthKey)}</h2>
            <p className="mt-1 text-xs text-slate-500">Open reports, review delivery status or continue incomplete work.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px] xl:w-[520px]">
            <label className="relative block">
              <span className="sr-only">Search recent reports</span>
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search Investor, code or Advisor" className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
              {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {reports.length ? (
        <>
          <div className="grid gap-3 p-4 md:hidden">
            {reports.slice(0, 8).map((report) => {
              const monthlyReturn = calculatedMonthlyReturn(report);
              return (
                <article key={report.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-heading text-lg font-bold text-slate-950">{report.investorName || "Investor"}</p><p className="mt-1 text-xs font-medium text-slate-500">{report.clientCode || report.reportCode || "—"}</p></div>
                    <DashboardStatusBadge report={report} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Portfolio value</p><p className="mt-1 text-sm font-bold tabular-nums text-slate-950">{formatCurrency(report.summary?.totalCorpus)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Monthly return</p><p className={`mt-1 text-sm font-bold tabular-nums ${monthlyReturn < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatPercent(monthlyReturn)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Advisor</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{report.advisorName || "Unassigned"}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Delivery</p><p className="mt-1 text-sm font-semibold capitalize text-slate-700">{report.lastEmailStatus || (report.investorVisible ? "Published" : "Pending")}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Updated {formatDateTime(reportUpdatedAt(report))}</p>
                  <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] gap-2">
                    <Link href={`/reports/create?investorId=${report.investorId}&copyFrom=${report.id}`} aria-label="Duplicate report" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600"><Copy size={16} /></Link>
                    <Link href={`/reports/${report.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">Open Report <ArrowRight size={15} /></Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Investor</th>
                  <th className="px-5 py-3 font-bold">Report month</th>
                  <th className="px-5 py-3 text-right font-bold">Portfolio value</th>
                  <th className="px-5 py-3 text-right font-bold">Monthly return</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Assigned user</th>
                  <th className="px-5 py-3 font-bold">Last updated</th>
                  <th className="px-5 py-3 font-bold">Delivery</th>
                  <th className="px-5 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.slice(0, 8).map((report) => {
                  const monthlyReturn = calculatedMonthlyReturn(report);
                  return (
                    <tr key={report.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-4"><Link href={`/reports/${report.id}`}><p className="font-semibold text-slate-950 hover:text-blue-700">{report.investorName || "Investor"}</p><p className="mt-1 text-xs text-slate-500">{report.clientCode || report.reportCode || "—"}</p></Link></td>
                      <td className="px-5 py-4"><p className="font-semibold text-slate-800">{getMonthLabel(report.reportMonth)} {report.reportYear}</p><p className="mt-1 text-xs text-slate-400">{report.reportCode || report.id}</p></td>
                      <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950">{formatCurrency(report.summary?.totalCorpus)}</td>
                      <td className={`px-5 py-4 text-right font-bold tabular-nums ${monthlyReturn < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatPercent(monthlyReturn)}</td>
                      <td className="px-5 py-4"><DashboardStatusBadge report={report} /></td>
                      <td className="px-5 py-4 text-slate-700">{report.advisorName || "Unassigned"}</td>
                      <td className="px-5 py-4 text-xs text-slate-500">{formatDateTime(reportUpdatedAt(report))}</td>
                      <td className="px-5 py-4"><span className={`text-xs font-semibold capitalize ${isEmailFailed(report) ? "text-red-600" : isEmailSent(report) ? "text-emerald-600" : "text-slate-500"}`}>{report.lastEmailStatus || (report.investorVisible ? "Published" : "Pending")}</span></td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/reports/${report.id}`} className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white">Open</Link>
                          <details className="relative">
                            <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><MoreHorizontal size={17} /></summary>
                            <div className="absolute right-0 top-11 z-20 grid w-44 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
                              <Link href={`/reports/${report.id}/edit`} className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit report</Link>
                              <Link href={`/report-print/${report.id}`} className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Preview report</Link>
                              <Link href={`/reports/create?investorId=${report.investorId}&copyFrom=${report.id}`} className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Duplicate report</Link>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-700"><FileText size={22} /></span>
            <h3 className="mt-4 font-heading text-xl font-bold text-slate-950">No reports found for {monthKeyLabel(selectedMonthKey)}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Generate a monthly report or adjust the current search and status filter.</p>
            <Link href={`/reports/create?month=${selectedMonthKey}`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white"><Plus size={16} /> Generate New Report</Link>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs font-medium text-slate-500 sm:px-5">
        <span>Showing {Math.min(reports.length, 8)} report{Math.min(reports.length, 8) === 1 ? "" : "s"}</span>
        <Link href="/reports" className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-900">View all <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}

function CompletionOverview({ range, onRangeChange, counts, total, onStatusSelect }) {
  const rows = [
    { key: "sent", label: "Sent", count: counts.sent, color: "bg-emerald-500", text: "text-emerald-700" },
    { key: "pdf", label: "PDF ready", count: counts.pdf, color: "bg-blue-600", text: "text-blue-700" },
    { key: "approved", label: "Approved", count: counts.approved, color: "bg-cyan-500", text: "text-cyan-700" },
    { key: "review", label: "Under review", count: counts.review, color: "bg-indigo-500", text: "text-indigo-700" },
    { key: "issues", label: "Correction required", count: counts.issues, color: "bg-red-500", text: "text-red-700" },
    { key: "draft", label: "Draft / pending", count: counts.draft, color: "bg-slate-400", text: "text-slate-600" }
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Report completion overview</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Preparation and delivery status</h2></div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {[{ value: "month", label: "Month" }, { value: "quarter", label: "Quarter" }, { value: "fy", label: "FY" }].map((item) => <button key={item.value} type="button" onClick={() => onRangeChange(item.value)} className={`min-h-8 rounded-md px-3 text-xs font-semibold transition ${range === item.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}
        </div>
      </div>

      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Report completion distribution">
        {rows.map((item) => total > 0 && item.count > 0 ? <button key={item.key} type="button" title={`${item.label}: ${item.count}`} onClick={() => onStatusSelect(item.key === "pdf" ? "ALL" : item.key)} className={`${item.color} h-full transition hover:opacity-80`} style={{ width: `${(item.count / total) * 100}%` }} /> : null)}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map((item) => {
          const percentage = total ? (item.count / total) * 100 : 0;
          return (
            <button key={item.key} type="button" onClick={() => onStatusSelect(item.key === "pdf" ? "ALL" : item.key)} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/30">
              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">{item.label}</p><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full ${item.color}`} style={{ width: `${percentage}%` }} /></div></div>
              <div className="text-right"><p className={`font-heading text-lg font-bold ${item.text}`}>{item.count}</p><p className="text-[10px] text-slate-400">{percentage.toFixed(0)}%</p></div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PortfolioSummary({ summary, selectedMonthKey }) {
  const gainPositive = summary.monthlyGain >= 0;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-[#0B1220] text-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Aggregated portfolio overview</p><h2 className="mt-1 font-heading text-xl font-bold !text-white">{monthKeyLabel(selectedMonthKey)}</h2><p className="mt-1 text-xs text-slate-400">Summary values from the latest report for each Investor.</p></div>
      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-400">Total portfolio value</p>
        <p className="mt-2 font-heading text-[34px] font-bold leading-none tabular-nums !text-white sm:text-[40px]">{formatCurrency(summary.totalCorpus)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${gainPositive ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{gainPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{formatCurrency(summary.monthlyGain)}</span>
          <span className={`text-xs font-semibold ${summary.monthlyReturn < 0 ? "text-red-300" : "text-emerald-300"}`}>{formatPercent(summary.monthlyReturn)} monthly return</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "YTD return", value: formatPercent(summary.ytdReturn), icon: RefreshCw },
            { label: "Amount invested", value: formatCurrency(summary.invested), icon: IndianRupee },
            { label: "Withdrawn", value: formatCurrency(summary.withdrawn), icon: Download },
            { label: "Net contribution", value: formatCurrency(summary.netContribution), icon: CircleDollarSign }
          ].map((item) => {
            const Icon = item.icon;
            return <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3"><span className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-cyan-300"><Icon size={14} /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">{item.value}</p></div>;
          })}
        </div>
      </div>
    </section>
  );
}

function RecentActivity({ items }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Recent activity</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Report audit trail</h2></div>
        <Link href="/reports" className="text-xs font-semibold text-blue-700 hover:text-blue-900">View reports</Link>
      </div>
      {items.length ? <div className="divide-y divide-slate-100">{items.map((item) => {
        const Icon = item.icon;
        return <Link key={item.id} href={item.href} className="group grid grid-cols-[34px_minmax(0,1fr)] gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5"><span className={`grid h-8 w-8 place-items-center rounded-lg ${item.tone}`}><Icon size={15} /></span><div className="min-w-0"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.title}</p><span className="shrink-0 text-[10px] text-slate-400">{formatDateTime(item.time)}</span></div><p className="mt-0.5 truncate text-xs text-slate-500">{item.description}</p><p className="mt-1 text-[11px] font-medium text-slate-400">{item.user}</p></div></Link>;
      })}</div> : <div className="p-8 text-center text-sm text-slate-500">Report activity will appear after the first report is created.</div>}
    </section>
  );
}

function DashboardLoading() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]"><Skeleton className="h-[420px]" /><Skeleton className="h-[420px]" /></div>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

export default function DashboardOverview() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [investorsLoading, setInvestorsLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [investorError, setInvestorError] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => keyForDate(new Date()));
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(() => financialYearValue(new Date()));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [analyticsRange, setAnalyticsRange] = useState("month");

  useEffect(() => {
    if (!profile?.id) return undefined;
    const unsubscribeReports = subscribeMonthlyReports(
      profile,
      (items) => { setReports(items); setReportsLoading(false); setReportError(""); },
      (error) => { console.error(error); setReportError("Monthly reports could not be loaded. The remaining dashboard sections are still available."); setReportsLoading(false); }
    );
    const unsubscribeInvestors = subscribeInvestors(
      profile,
      (items) => { setInvestors(items); setInvestorsLoading(false); setInvestorError(""); },
      (error) => { console.error(error); setInvestorError("Investor totals could not be loaded. Check the deployed Firestore indexes and retry."); setInvestorsLoading(false); }
    );
    return () => { unsubscribeReports?.(); unsubscribeInvestors?.(); };
  }, [profile]);

  const financialYears = useMemo(() => {
    const values = new Set([financialYearValue(new Date())]);
    reports.forEach((report) => {
      if (report.reportMonthKey) values.add(financialYearValue(keyToDate(report.reportMonthKey)));
      else if (report.reportYear && report.reportMonth) values.add(financialYearValue(new Date(Number(report.reportYear), Number(report.reportMonth) - 1, 1)));
    });
    return [...values].sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]));
  }, [reports]);

  function handleFinancialYearChange(value) {
    setSelectedFinancialYear(value);
    const options = monthKeysForFinancialYear(value);
    const currentKey = keyForDate(new Date());
    setSelectedMonthKey(options.includes(currentKey) ? currentKey : options[0]);
  }

  function handleMonthChange(value) {
    setSelectedMonthKey(value);
    setSelectedFinancialYear(financialYearValue(keyToDate(value)));
  }

  const currentMonthReports = useMemo(() => latestPerInvestor(reports.filter((item) => item.reportMonthKey === selectedMonthKey)), [reports, selectedMonthKey]);
  const previousMonthReports = useMemo(() => latestPerInvestor(reports.filter((item) => item.reportMonthKey === shiftMonthKey(selectedMonthKey, -1))), [reports, selectedMonthKey]);

  const monthlyMetrics = useMemo(() => {
    const count = (items, test) => items.filter(test).length;
    const currentInvestorIds = new Set(currentMonthReports.map((report) => report.investorId).filter(Boolean));
    const previousInvestorIds = new Set(previousMonthReports.map((report) => report.investorId).filter(Boolean));
    const totalInvestors = investors.length;
    const due = Math.max(totalInvestors - currentInvestorIds.size, 0);
    const previousDue = Math.max(totalInvestors - previousInvestorIds.size, 0);
    const draft = count(currentMonthReports, (report) => report.status === REPORT_STATUS.DRAFT);
    const previousDraft = count(previousMonthReports, (report) => report.status === REPORT_STATUS.DRAFT);
    const review = count(currentMonthReports, (report) => report.status === REPORT_STATUS.LOCKED || String(report.reviewStatus || "").toLowerCase() === "under_review");
    const previousReview = count(previousMonthReports, (report) => report.status === REPORT_STATUS.LOCKED || String(report.reviewStatus || "").toLowerCase() === "under_review");
    const approved = count(currentMonthReports, (report) => report.status === REPORT_STATUS.COMPLETED);
    const previousApproved = count(previousMonthReports, (report) => report.status === REPORT_STATUS.COMPLETED);
    const sent = count(currentMonthReports, isEmailSent);
    const previousSent = count(previousMonthReports, isEmailSent);
    const issues = count(currentMonthReports, (report) => reportDataIssues(report).length > 0 || isEmailFailed(report));
    const previousIssues = count(previousMonthReports, (report) => reportDataIssues(report).length > 0 || isEmailFailed(report));
    const pendingDelivery = count(currentMonthReports, (report) => report.status === REPORT_STATUS.COMPLETED && !isEmailSent(report));
    const previousPendingDelivery = count(previousMonthReports, (report) => report.status === REPORT_STATUS.COMPLETED && !isEmailSent(report));
    return { totalInvestors, due, previousDue, draft, previousDraft, review, previousReview, approved, previousApproved, sent, previousSent, issues, previousIssues, pendingDelivery, previousPendingDelivery };
  }, [currentMonthReports, investors.length, previousMonthReports]);

  const workflow = useMemo(() => {
    const stages = {
      selected: currentMonthReports.length,
      dataAdded: currentMonthReports.filter(hasCoreReportData).length,
      generated: currentMonthReports.filter((report) => hasCoreReportData(report) && Boolean(report.title)).length,
      commentary: currentMonthReports.filter(hasCommentary).length,
      review: currentMonthReports.filter((report) => report.status === REPORT_STATUS.LOCKED || report.status === REPORT_STATUS.COMPLETED).length,
      approved: currentMonthReports.filter((report) => report.status === REPORT_STATUS.COMPLETED).length,
      pdf: currentMonthReports.filter((report) => Boolean(report.pdfStoragePath)).length,
      sent: currentMonthReports.filter(isEmailSent).length
    };
    const total = monthlyMetrics.totalInvestors || currentMonthReports.length || 1;
    const completion = (stages.sent / total) * 100;
    const delayed = monthlyMetrics.due + monthlyMetrics.issues + currentMonthReports.filter((report) => isEmailFailed(report)).length;
    const preparationHours = currentMonthReports
      .filter((report) => report.status === REPORT_STATUS.COMPLETED)
      .map((report) => {
        const start = dateTimeValue(report.createdAt);
        const end = dateTimeValue(report.completedAt || report.publishedAt || report.updatedAt);
        return start && end && end >= start ? (end - start) / 3600000 : null;
      })
      .filter((value) => Number.isFinite(value));
    const averageHours = preparationHours.length ? preparationHours.reduce((sum, value) => sum + value, 0) / preparationHours.length : 0;
    const averagePreparation = averageHours >= 24 ? `${(averageHours / 24).toFixed(1)} days` : averageHours > 0 ? `${averageHours.toFixed(1)} hrs` : "—";
    return { stages, completion, delayed, averagePreparation };
  }, [currentMonthReports, monthlyMetrics]);

  const attentionItems = useMemo(() => {
    const items = [];
    const reportInvestorIds = new Set(currentMonthReports.map((report) => report.investorId).filter(Boolean));

    currentMonthReports.forEach((report) => {
      const issues = reportDataIssues(report);
      if (isEmailFailed(report)) items.push({ id: `email-${report.id}`, priority: 1, tone: "red", icon: XCircle, title: "Investor email delivery failed", context: `${report.investorName} · ${shortMonthLabel(selectedMonthKey)}`, helper: report.lastEmailError || "Retry delivery from the report page", href: `/reports/${report.id}` });
      if (issues.length) items.push({ id: `data-${report.id}`, priority: 2, tone: "amber", icon: ShieldAlert, title: issues[0], context: `${report.investorName} · ${report.clientCode || "Investor report"}`, helper: `${issues.length} validation item${issues.length === 1 ? "" : "s"} require attention`, href: `/reports/${report.id}/edit#report-summary` });
      if (report.status === REPORT_STATUS.COMPLETED && !report.pdfStoragePath) items.push({ id: `pdf-${report.id}`, priority: 3, tone: "amber", icon: FileClock, title: "Final PDF has not been generated", context: `${report.investorName} · ${shortMonthLabel(selectedMonthKey)}`, helper: "Generate the secure PDF before delivery", href: `/reports/${report.id}` });
      if (report.pdfStoragePath && !isEmailSent(report)) items.push({ id: `delivery-${report.id}`, priority: 4, tone: "blue", icon: MailCheck, title: "Report is ready for Investor delivery", context: `${report.investorName} · ${shortMonthLabel(selectedMonthKey)}`, helper: "PDF is ready but the delivery email is pending", href: `/reports/${report.id}` });
    });

    investors
      .filter((investor) => !reportInvestorIds.has(investor.id))
      .slice(0, 4)
      .forEach((investor) => items.push({ id: `due-${investor.id}`, priority: 5, tone: "amber", icon: CalendarDays, title: "Monthly report has not been started", context: `${investor.fullName} · ${investor.clientCode || "Investor"}`, helper: `Create the ${monthKeyLabel(selectedMonthKey)} report`, href: `/reports/create?investorId=${investor.id}&month=${selectedMonthKey}` }));

    return items.sort((a, b) => a.priority - b.priority).slice(0, 8);
  }, [currentMonthReports, investors, selectedMonthKey]);

  const filteredRecentReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return currentMonthReports
      .filter((report) => {
        const matchesSearch = !term || [report.investorName, report.clientCode, report.reportCode, report.advisorName].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
        const status = reportDashboardStatus(report).key;
        const matchesStatus = statusFilter === "ALL" || (statusFilter === "issues" ? reportDataIssues(report).length > 0 || isEmailFailed(report) : status === statusFilter);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => dateTimeValue(reportUpdatedAt(b)) - dateTimeValue(reportUpdatedAt(a)));
  }, [currentMonthReports, search, statusFilter]);

  const analyticsReports = useMemo(() => {
    let keys = [selectedMonthKey];
    if (analyticsRange === "quarter") keys = [selectedMonthKey, shiftMonthKey(selectedMonthKey, -1), shiftMonthKey(selectedMonthKey, -2)];
    if (analyticsRange === "fy") keys = monthKeysForFinancialYear(selectedFinancialYear);
    return latestPerInvestor(reports.filter((report) => keys.includes(report.reportMonthKey)));
  }, [analyticsRange, reports, selectedFinancialYear, selectedMonthKey]);

  const completionCounts = useMemo(() => {
    const counts = { sent: 0, pdf: 0, approved: 0, review: 0, issues: 0, draft: 0 };
    analyticsReports.forEach((report) => {
      const status = reportDashboardStatus(report).key;
      if (status === "sent") counts.sent += 1;
      else if (status === "pdf") counts.pdf += 1;
      else if (status === "approved") counts.approved += 1;
      else if (status === "review") counts.review += 1;
      else if (status === "issues" || status === "failed") counts.issues += 1;
      else counts.draft += 1;
    });
    return counts;
  }, [analyticsReports]);

  const portfolioSummary = useMemo(() => {
    const totalCorpus = currentMonthReports.reduce((sum, report) => sum + Number(report.summary?.totalCorpus || 0), 0);
    const monthlyGain = currentMonthReports.reduce((sum, report) => sum + Number(report.summary?.investmentGain || 0), 0);
    const invested = currentMonthReports.reduce((sum, report) => sum + Number(report.summary?.newMoneyAdded || 0), 0);
    const withdrawn = currentMonthReports.reduce((sum, report) => sum + Number(report.summary?.withdrawals || report.summary?.amountWithdrawn || 0), 0);
    const openingBase = totalCorpus - monthlyGain - invested + withdrawn;
    const monthlyReturn = openingBase > 0 ? (monthlyGain / openingBase) * 100 : 0;
    const selectedDate = keyToDate(selectedMonthKey);
    const calendarYearKeys = Array.from({ length: selectedDate.getMonth() + 1 }, (_, index) => keyForDate(new Date(selectedDate.getFullYear(), index, 1)));
    const yearReports = latestPerInvestor(reports.filter((report) => calendarYearKeys.includes(report.reportMonthKey)));
    const ytdGain = yearReports.reduce((sum, report) => sum + Number(report.summary?.investmentGain || 0), 0);
    const ytdBase = totalCorpus - ytdGain;
    const ytdReturn = ytdBase > 0 ? (ytdGain / ytdBase) * 100 : 0;
    return { totalCorpus, monthlyGain, monthlyReturn, ytdReturn, invested, withdrawn, netContribution: invested - withdrawn };
  }, [currentMonthReports, reports, selectedMonthKey]);

  const activityItems = useMemo(() => currentMonthReports
    .map((report) => {
      if (isEmailFailed(report)) return { id: `activity-failed-${report.id}`, time: report.lastEmailAttemptAt || reportUpdatedAt(report), icon: XCircle, tone: "bg-red-50 text-red-600", title: "Report email delivery failed", description: `${report.investorName} · ${shortMonthLabel(report.reportMonthKey)}`, user: report.updatedByName || report.advisorName || "GrowVest team", href: `/reports/${report.id}` };
      if (isEmailSent(report)) return { id: `activity-sent-${report.id}`, time: report.lastEmailAttemptAt || report.publishedAt || reportUpdatedAt(report), icon: Send, tone: "bg-emerald-50 text-emerald-600", title: "Monthly report sent", description: `${report.investorName} · ${shortMonthLabel(report.reportMonthKey)}`, user: report.publishedByName || report.updatedByName || report.advisorName || "GrowVest team", href: `/reports/${report.id}` };
      if (report.pdfStoragePath) return { id: `activity-pdf-${report.id}`, time: report.publishedAt || reportUpdatedAt(report), icon: FileCheck2, tone: "bg-blue-50 text-blue-700", title: "Secure PDF generated", description: `${report.investorName} · ${report.pdfFileName || shortMonthLabel(report.reportMonthKey)}`, user: report.publishedByName || report.updatedByName || report.advisorName || "GrowVest team", href: `/reports/${report.id}` };
      if (report.status === REPORT_STATUS.COMPLETED) return { id: `activity-approved-${report.id}`, time: report.completedAt || reportUpdatedAt(report), icon: CheckCircle2, tone: "bg-cyan-50 text-cyan-700", title: "Monthly report completed", description: `${report.investorName} · ${shortMonthLabel(report.reportMonthKey)}`, user: report.updatedByName || report.advisorName || "GrowVest team", href: `/reports/${report.id}` };
      return { id: `activity-draft-${report.id}`, time: reportUpdatedAt(report), icon: FileText, tone: "bg-slate-100 text-slate-600", title: "Report draft updated", description: `${report.investorName} · ${shortMonthLabel(report.reportMonthKey)}`, user: report.updatedByName || report.advisorName || "GrowVest team", href: `/reports/${report.id}` };
    })
    .sort((a, b) => dateTimeValue(b.time) - dateTimeValue(a.time))
    .slice(0, 8), [currentMonthReports]);

  const loading = reportsLoading || investorsLoading;

  const metricCards = [
    { label: "Total Investors", value: monthlyMetrics.totalInvestors, helper: "Active Investor profiles", icon: UsersRound, tone: "slate", href: "/investors", priority: false },
    { label: "Reports Due This Month", value: monthlyMetrics.due, previous: monthlyMetrics.previousDue, icon: CalendarDays, tone: monthlyMetrics.due ? "amber" : "emerald", href: "/investors", priority: true },
    { label: "Draft Reports", value: monthlyMetrics.draft, previous: monthlyMetrics.previousDraft, icon: FileText, tone: "slate", href: "/reports", priority: false },
    { label: "Reports Under Review", value: monthlyMetrics.review, previous: monthlyMetrics.previousReview, icon: Clock3, tone: "indigo", href: "/reports", priority: true },
    { label: "Approved Reports", value: monthlyMetrics.approved, previous: monthlyMetrics.previousApproved, icon: FileCheck2, tone: "cyan", href: "/reports", priority: true },
    { label: "Reports Sent", value: monthlyMetrics.sent, previous: monthlyMetrics.previousSent, icon: Send, tone: "emerald", href: "/reports", priority: true },
    { label: "Reports with Data Issues", value: monthlyMetrics.issues, previous: monthlyMetrics.previousIssues, icon: AlertTriangle, tone: monthlyMetrics.issues ? "red" : "emerald", href: "/reports", priority: false },
    { label: "Pending Investor Delivery", value: monthlyMetrics.pendingDelivery, previous: monthlyMetrics.previousPendingDelivery, icon: MailCheck, tone: monthlyMetrics.pendingDelivery ? "amber" : "emerald", href: "/reports", priority: false }
  ];

  return (
    <div className="grid gap-5 pb-24 lg:gap-6 lg:pb-0">
      <DashboardHeader selectedMonthKey={selectedMonthKey} onMonthChange={handleMonthChange} financialYear={selectedFinancialYear} onFinancialYearChange={handleFinancialYearChange} financialYears={financialYears} />

      {reportError || investorError ? <div className="grid gap-2">{reportError ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Report data unavailable</p><p className="mt-0.5 text-xs leading-5">{reportError}</p></div></div> : null}{investorError ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Investor totals unavailable</p><p className="mt-0.5 text-xs leading-5">{investorError}</p></div></div> : null}</div> : null}

      {loading ? <DashboardLoading /> : (
        <>
          <section aria-label="Monthly report metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metricCards.map((item) => <DashboardMetricCard key={item.label} {...item} />)}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <div className="order-2 xl:order-1"><WorkflowPanel stages={workflow.stages} totalInvestors={monthlyMetrics.totalInvestors || currentMonthReports.length} completion={workflow.completion} delayed={workflow.delayed} averagePreparation={workflow.averagePreparation} /></div>
            <div className="order-1 xl:order-2"><AttentionPanel items={attentionItems} selectedMonthKey={selectedMonthKey} /></div>
          </div>

          <RecentReports reports={filteredRecentReports} search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusChange={setStatusFilter} selectedMonthKey={selectedMonthKey} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <CompletionOverview range={analyticsRange} onRangeChange={setAnalyticsRange} counts={completionCounts} total={Math.max(analyticsReports.length, 1)} onStatusSelect={(value) => { setStatusFilter(value); document.getElementById("recent-monthly-reports")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            <PortfolioSummary summary={portfolioSummary} selectedMonthKey={selectedMonthKey} />
          </div>

          <RecentActivity items={activityItems} />
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-slate-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Link href={`/reports/create?month=${selectedMonthKey}&mode=import`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700"><Upload size={17} /> Import</Link>
        <Link href={`/reports/create?month=${selectedMonthKey}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white"><Plus size={17} /> Generate Report</Link>
      </div>
    </div>
  );
}
