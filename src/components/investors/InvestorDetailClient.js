"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeIndianRupee,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Edit3,
  FileBarChart,
  FileCheck2,
  Files,
  FolderLock,
  History,
  IdCard,
  LayoutDashboard,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";

import MeetingStatusBadge from "@/components/meetings/MeetingStatusBadge";
import InvestorDocumentsPanel from "@/components/investors/InvestorDocumentsPanel";
import InvestorPortalAccessCard from "@/components/investors/InvestorPortalAccessCard";
import InvestorLifecycleCard from "@/components/investors/InvestorLifecycleCard";
import InvestorPortfolioPanel from "@/components/portfolio/InvestorPortfolioPanel";
import ActionStatusBadge from "@/components/actions/ActionStatusBadge";
import InvestorReportsPanel from "@/components/reports/InvestorReportsPanel";
import ReportStatusBadge from "@/components/reports/ReportStatusBadge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import {
  calculateInvestmentPreferenceTotals,
  getInvestmentPreferenceRows,
  getPrimaryGoal
} from "@/lib/constants/assessment";
import { getMonthLabel } from "@/lib/constants/report";
import { formatDateTime } from "@/lib/utils/date";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { nextAnnualOccasion, turningAge } from "@/lib/utils/occasions";
import { subscribeAssessmentVersions, subscribeInvestor } from "@/services/assessmentService";
import { subscribeInvestorMeetings } from "@/services/meetingService";
import { subscribeInvestorReports } from "@/services/reportService";
import { subscribeInvestorActions } from "@/services/actionService";
import { ACTION_TERMINAL_STATUSES } from "@/lib/constants/actions";

function investorGoals(investor) {
  if (Array.isArray(investor?.bucketList) && investor.bucketList.length) return investor.bucketList;
  if (Array.isArray(investor?.goals)) return investor.goals;
  return [];
}

function initials(name) {
  return String(name || "Investor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dateValue(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function reportSortValue(report) {
  return dateValue(
    report?.statementDate
      || report?.publishedAt
      || report?.completedAt
      || report?.updatedAt
      || report?.createdAt
  );
}

function reportMonthText(report) {
  if (!report) return "No report yet";
  if (report.reportMonthKey) {
    const [year, month] = String(report.reportMonthKey).split("-");
    if (year && month) return `${getMonthLabel(Number(month))} ${year}`;
  }
  return `${getMonthLabel(report.reportMonth)} ${report.reportYear || ""}`.trim();
}

function monthlyReturn(report) {
  const explicit = Number(report?.summary?.monthlyReturn ?? report?.monthlyReturn);
  if (Number.isFinite(explicit) && explicit !== 0) return explicit;

  const closing = Number(report?.summary?.totalCorpus || 0);
  const gain = Number(report?.summary?.investmentGain || 0);
  const newMoney = Number(report?.summary?.newMoneyAdded || 0);
  const withdrawn = Number(report?.summary?.withdrawals || report?.summary?.amountWithdrawn || 0);
  const openingBase = closing - gain - newMoney + withdrawn;
  return openingBase > 0 ? (gain / openingBase) * 100 : 0;
}

function reportYear(report) {
  if (Number(report?.reportYear)) return Number(report.reportYear);
  if (report?.reportMonthKey) return Number(String(report.reportMonthKey).slice(0, 4));
  const timestamp = reportSortValue(report);
  return timestamp ? new Date(timestamp).getFullYear() : 0;
}

function formatPercent(value, digits = 1) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}%`;
}

function relationshipLabel(value) {
  if (!value) return "Date not added";
  return formatDate(value);
}

function birthdayReminderLabel(personal = {}) {
  if (!personal.dateOfBirth) return "Add date of birth first";
  if (personal.birthdayReminderEnabled === false) return "Disabled";
  const offsets = Array.isArray(personal.birthdayReminderOffsets) && personal.birthdayReminderOffsets.length
    ? personal.birthdayReminderOffsets
    : [Number(personal.birthdayReminderDaysBefore ?? 7)];
  return offsets.map((days) => Number(days) === 0 ? "On birthday" : `${days} day${Number(days) === 1 ? "" : "s"} before`).join(" · ");
}

function nextBirthdayLabel(personal = {}) {
  if (!personal.dateOfBirth) return "Add date of birth first";
  const next = nextAnnualOccasion(personal.dateOfBirth);
  if (!next) return "Invalid date";
  const age = turningAge(personal.dateOfBirth, next.eventYear);
  const when = next.daysUntil === 0 ? "Today" : next.daysUntil === 1 ? "Tomorrow" : `In ${next.daysUntil} days`;
  return `${formatDate(next.eventDate)} · ${when}${age !== null ? ` · Turning ${age}` : ""}`;
}

function monthlySurplusLabel(personal = {}) {
  const amount = formatCurrency(personal.monthlySurplus);
  if (personal.monthlySurplusMode !== "percentage") return amount;
  const percentage = Number(personal.monthlySurplusPercentage || 0);
  return `${amount} (${percentage}% of monthly income)`;
}

function portalStatus(investor) {
  if (investor?.portalEnabled === false || investor?.status === "inactive") return "Inactive";
  if (investor?.investorPortalUid || investor?.portalEnabled) return "Active";
  return "Not enabled";
}

function RiskBadge({ value }) {
  const normalized = String(value || "").toUpperCase();
  const styles = normalized === "CONSERVATIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized === "AGGRESSIVE"
      ? "border-red-200 bg-red-50 text-red-700"
      : normalized === "MODERATE"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-bold ${styles}`}>
      {value || "Risk pending"}
    </span>
  );
}

function StatusPill({ label, tone = "neutral" }) {
  const tones = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600"
  };

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-bold ${tones[tone] || tones.neutral}`}>
      {label}
    </span>
  );
}

function SummaryMetric({ label, value, helper, icon: Icon, tone = "blue", trend }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    cyan: "bg-cyan-50 text-cyan-700",
    slate: "bg-slate-100 text-slate-700"
  };

  const trendClass = Number(trend || 0) < 0 ? "text-red-600" : "text-emerald-600";
  const TrendIcon = Number(trend || 0) < 0 ? TrendingDown : TrendingUp;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone] || tones.blue}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        {trend !== undefined && trend !== null ? (
          <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${trendClass}`}>
            <TrendIcon size={13} aria-hidden="true" />
            {formatPercent(trend)}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 font-heading text-[24px] font-bold leading-tight text-slate-950 tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function InfoRow({ label, value, icon: Icon, href }) {
  const content = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
        <span className="mt-1 block break-words text-sm font-semibold text-slate-800">{value || "—"}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-200 hover:bg-blue-50/30">
        {content}
      </a>
    );
  }

  return <div className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3.5">{content}</div>;
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p>
        <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function GoalCard({ goal }) {
  const current = Number(goal.currentAmount || 0);
  const target = Number(goal.targetAmount || 0);
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  return (
    <article className={`rounded-xl border p-4 sm:p-5 ${goal.isPrimary ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-xl font-bold text-slate-950">{goal.name || "Untitled goal"}</h3>
            {goal.isPrimary ? <StatusPill label="Primary" tone="blue" /> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {[goal.type, goal.priority ? `${goal.priority} priority` : "", goal.status].filter(Boolean).join(" · ") || "Goal details pending"}
          </p>
        </div>
        <p className="shrink-0 font-heading text-xl font-bold text-blue-800 tabular-nums">{formatCurrency(target)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
        <span>{formatCurrency(current)} accumulated</span>
        <span>{progress.toFixed(1)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100" aria-label={`${goal.name} progress`}>
        <div className="h-full rounded-full bg-[#1F4ED8] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Timeline", goal.timeline || (goal.targetYear ? `By ${goal.targetYear}` : "—")],
          ["Monthly", formatCurrency(goal.monthlyContribution)],
          ["Goal type", goal.goalNature || goal.flexibility || "—"],
          ["Target year", goal.targetYear || "—"]
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>
      {goal.notes ? <p className="mt-4 rounded-lg bg-white/80 p-3 text-sm leading-6 text-slate-600">{goal.notes}</p> : null}
    </article>
  );
}

function MobileRecordCard({ title, subtitle, fields }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-heading text-lg font-bold text-slate-950">{title || "—"}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function DataTable({ columns, rows, emptyMessage }) {
  if (!rows.length) return <EmptyState title={emptyMessage} description="Add this information from Edit Profile." />;

  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <MobileRecordCard key={row.key || index} title={row.mobileTitle} subtitle={row.mobileSubtitle} fields={row.mobileFields} />
        ))}
      </div>
      <div className="gv-scrollbar hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 font-bold ${column.align === "right" ? "text-right" : ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.key || index} className="transition hover:bg-slate-50/70">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-slate-700 ${column.align === "right" ? "text-right" : ""} ${column.emphasis ? "font-semibold text-slate-950" : ""}`}>
                    {row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingProfile() {
  return (
    <div className="grid animate-pulse gap-5">
      <div className="h-52 rounded-xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 rounded-xl bg-slate-200" />)}
      </div>
      <div className="h-16 rounded-xl bg-slate-200" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 rounded-xl bg-slate-200" />
        <div className="h-96 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

export default function InvestorDetailClient({ investorId }) {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [versions, setVersions] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => subscribeInvestor(
    investorId,
    (item) => {
      setInvestor(item);
      setLoading(false);
      if (!item) setError("Investor profile was not found.");
    },
    (nextError) => {
      console.error(nextError);
      setError("You do not have access to this investor profile.");
      setLoading(false);
    }
  ), [investorId]);

  useEffect(() => {
    if (!investor?.id) return undefined;
    return subscribeInvestorMeetings(
      investor.id,
      setMeetings,
      (nextError) => console.error("Unable to load investor meetings", nextError)
    );
  }, [investor?.id]);

  useEffect(() => {
    if (!investor?.id) return undefined;
    return subscribeInvestorReports(
      investor.id,
      setReports,
      (nextError) => console.error("Unable to load investor reports", nextError)
    );
  }, [investor?.id]);

  useEffect(() => {
    if (!investor?.id || !profile) return undefined;
    return subscribeInvestorActions(
      investor.id,
      profile,
      setActions,
      (nextError) => console.error("Unable to load investor actions", nextError)
    );
  }, [investor?.id, profile]);

  useEffect(() => {
    if (!investor?.leadId) return undefined;
    return subscribeAssessmentVersions(
      investor.leadId,
      setVersions,
      (nextError) => console.error("Unable to load assessment history", nextError)
    );
  }, [investor?.leadId]);

  const goals = useMemo(() => investorGoals(investor), [investor]);
  const primaryGoal = useMemo(() => getPrimaryGoal(goals), [goals]);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => reportSortValue(b) - reportSortValue(a)),
    [reports]
  );
  const latestReport = sortedReports[0] || null;

  if (loading) return <LoadingProfile />;

  if (error || !investor) {
    return (
      <div className="grid gap-4 rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 text-red-700">
          <AlertTriangle size={22} />
          <p className="font-bold">{error || "Investor could not be loaded."}</p>
        </div>
        <Link href="/investors" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-red-700 hover:underline">
          <ArrowLeft size={16} /> Back to investors
        </Link>
      </div>
    );
  }

  const personal = investor.personalProfile || {};
  const preferences = getInvestmentPreferenceRows(investor.investmentPreferences);
  const preferenceTotals = calculateInvestmentPreferenceTotals(preferences);
  const risk = investor.riskAssessment || {};
  const qualification = investor.qualification || {};
  const notes = investor.advisorNotes || {};
  const investments = investor.existingInvestments || [];
  const liabilities = investor.liabilities || [];
  const upcomingMeeting = meetings
    .filter((meeting) => String(meeting.status || "").toLowerCase() === "scheduled")
    .sort((a, b) => dateValue(a.startAt) - dateValue(b.startAt))[0] || null;

  const totalGoalTarget = goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
  const totalGoalCurrent = goals.reduce((sum, goal) => sum + Number(goal.currentAmount || 0), 0);
  const totalInvestments = investments.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0);
  const currentPortfolio = Number(investor.latestPortfolioValue || latestReport?.summary?.totalCorpus || totalInvestments || 0);
  const latestGain = Number(latestReport?.summary?.investmentGain || 0);
  const latestNewMoney = Number(latestReport?.summary?.newMoneyAdded || 0);
  const latestWithdrawals = Number(latestReport?.summary?.withdrawals || latestReport?.summary?.amountWithdrawn || 0);
  const latestNetContribution = latestNewMoney - latestWithdrawals;
  const latestMonthlyReturn = monthlyReturn(latestReport);
  const latestYear = reportYear(latestReport);
  const yearReports = sortedReports.filter((report) => latestYear && reportYear(report) === latestYear);
  const ytdGain = yearReports.reduce((sum, report) => sum + Number(report?.summary?.investmentGain || 0), 0);
  const ytdBase = currentPortfolio - ytdGain;
  const ytdReturn = ytdBase > 0 ? (ytdGain / ytdBase) * 100 : 0;
  const goalProgress = totalGoalTarget > 0 ? Math.min(100, (totalGoalCurrent / totalGoalTarget) * 100) : 0;
  const investorStatus = String(investor.status || "active").toLowerCase() === "inactive" ? "Inactive" : "Active";

  const tabs = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "goals", label: "Goals & Bucket List", icon: Target, count: goals.length },
    { value: "portfolio", label: "Portfolio", icon: WalletCards },
    { value: "reports", label: "Monthly Reports", icon: FileBarChart, count: reports.length },
    { value: "actions", label: "Advisor Follow-up", icon: ListChecks, count: actions.filter((item) => !ACTION_TERMINAL_STATUSES.includes(item.status)).length },
    { value: "meetings", label: "Meetings & MOM", icon: CalendarDays, count: meetings.length },
    { value: "assessment", label: "Assessment", icon: ClipboardCheck },
    { value: "access", label: "Access & Documents", icon: FolderLock },
    { value: "activity", label: "Activity", icon: Activity }
  ];

  const investmentRows = investments.map((item, index) => ({
    key: item.id || index,
    type: item.type || "—",
    institution: item.institution || "—",
    currentValue: formatCurrency(item.currentValue),
    monthly: formatCurrency(item.monthlyContribution),
    mobileTitle: item.institution || item.type,
    mobileSubtitle: item.type,
    mobileFields: [
      ["Current value", formatCurrency(item.currentValue)],
      ["Monthly", formatCurrency(item.monthlyContribution)],
      ["Start date", formatDate(item.startDate)],
      ["Maturity", formatDate(item.maturityDate)]
    ]
  }));

  const liabilityRows = liabilities.map((item, index) => ({
    key: item.id || index,
    type: item.type || "—",
    lender: item.lender || "—",
    outstanding: formatCurrency(item.outstandingAmount),
    emi: formatCurrency(item.emiAmount),
    mobileTitle: item.type,
    mobileSubtitle: item.lender,
    mobileFields: [
      ["Outstanding", formatCurrency(item.outstandingAmount)],
      ["EMI", formatCurrency(item.emiAmount)],
      ["Interest", item.interestRate ? `${item.interestRate}%` : "—"],
      ["Tenure", item.remainingTenure || "—"]
    ]
  }));

  const activityItems = [
    ...sortedReports.slice(0, 8).map((report) => ({
      id: `report-${report.id}`,
      type: "report",
      icon: FileBarChart,
      tone: "bg-blue-50 text-blue-700",
      title: `Monthly report ${String(report.status || "draft").toLowerCase() === "completed" ? "completed" : "updated"}`,
      description: `${reportMonthText(report)} · ${formatCurrency(report.summary?.totalCorpus)}`,
      date: report.updatedAt || report.completedAt || report.createdAt,
      href: `/reports/${report.id}`
    })),
    ...meetings.slice(0, 8).map((meeting) => ({
      id: `meeting-${meeting.id}`,
      type: "meeting",
      icon: CalendarDays,
      tone: "bg-cyan-50 text-cyan-700",
      title: meeting.title || "Investor meeting",
      description: meeting.status ? `Meeting · ${meeting.status}` : "Investor meeting",
      date: meeting.startAt || meeting.updatedAt || meeting.createdAt,
      href: `/meetings/${meeting.id}`
    })),
    ...versions.slice(0, 8).map((version) => ({
      id: `assessment-${version.id}`,
      type: "assessment",
      icon: ClipboardCheck,
      tone: "bg-amber-50 text-amber-700",
      title: `Assessment version ${version.versionNumber || "updated"}`,
      description: `${version.riskAssessment?.finalProfile || "Risk pending"} · ${version.qualification?.status || "Qualification pending"}`,
      date: version.savedAt || version.updatedAt || version.createdAt,
      href: investor.leadId ? `/assessments/${investor.leadId}` : null
    }))
  ]
    .sort((a, b) => dateValue(b.date) - dateValue(a.date))
    .slice(0, 16);

  return (
    <div className="grid gap-5 pb-24 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link href="/investors" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950">
          <ArrowLeft size={16} /> Back to investors
        </Link>
        <p className="hidden text-xs font-semibold text-slate-400 sm:block">Investor record · {investor.clientCode || "Client code pending"}</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
        <div className="h-1.5 bg-[#1F4ED8]" />
        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#0B1220] font-heading text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-2xl">
              {initials(investor.fullName)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Investor Profile</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 font-heading text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">{investor.fullName}</h1>
                <StatusPill label={`${investorStatus} Investor`} tone={investorStatus === "Active" ? "active" : "neutral"} />
                <RiskBadge value={risk.finalProfile} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {investor.clientCode || "Client code pending"} · Relationship since {relationshipLabel(investor.investorSince)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                {investor.email ? <a href={`mailto:${investor.email}`} className="inline-flex items-center gap-1.5 hover:text-blue-700"><Mail size={15} /> {investor.email}</a> : null}
                {investor.contactNo ? <a href={`tel:${investor.contactNo}`} className="inline-flex items-center gap-1.5 hover:text-blue-700"><Phone size={15} /> {investor.contactNo}</a> : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Link href={`/investors/${investor.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <Edit3 size={16} /> Edit
            </Link>
            {["super_admin", "admin"].includes(profile?.role) ? <button type="button" onClick={() => setTab("access")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"><ShieldCheck size={16} /> Manage Status</button> : null}
            <Link href={`/meetings/create?investorId=${investor.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100">
              <CalendarPlus size={16} /> Meeting
            </Link>
            <Link href={`/reports/create?investorId=${investor.id}`} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white transition hover:bg-[#183FB3]">
              <FileBarChart size={16} /> Create Monthly Report
            </Link>
          </div>
        </div>

        <div className="grid border-t border-slate-200 bg-slate-50/70 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Assigned advisor", investor.assignedAdvisorName || "Unassigned", UserRound],
            ["Investor portal", portalStatus(investor), ShieldCheck],
            ["Latest report", reportMonthText(latestReport), FileCheck2],
            ["Next review", upcomingMeeting ? formatDate(upcomingMeeting.startAt) : "Not scheduled", CalendarDays]
          ].map(([label, value, Icon], index) => (
            <div key={label} className={`flex items-center gap-3 px-5 py-4 ${index ? "border-t border-slate-200 sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-t xl:border-t-0" : ""}`}>
              <Icon size={17} className="shrink-0 text-blue-700" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryMetric label="Current portfolio" value={formatCurrency(currentPortfolio)} helper={Number(investor.latestPortfolioValue || 0) > 0 ? "Latest verified portfolio snapshot" : latestReport ? `As of ${reportMonthText(latestReport)}` : "No portfolio snapshot available"} icon={WalletCards} tone="blue" />
        <SummaryMetric label="Monthly gain / loss" value={formatCurrency(latestGain)} helper={latestReport ? reportMonthText(latestReport) : "Awaiting report data"} icon={latestGain < 0 ? TrendingDown : TrendingUp} tone={latestGain < 0 ? "red" : "green"} />
        <SummaryMetric label="Monthly return" value={formatPercent(latestMonthlyReturn)} helper="Calculated from latest report" icon={Activity} tone={latestMonthlyReturn < 0 ? "red" : "cyan"} trend={latestMonthlyReturn} />
        <SummaryMetric label="YTD return" value={formatPercent(ytdReturn)} helper={latestYear ? `Calendar year ${latestYear}` : "Awaiting report history"} icon={Sparkles} tone={ytdReturn < 0 ? "red" : "green"} trend={ytdReturn} />
        <SummaryMetric label="Net contribution" value={formatCurrency(latestNetContribution)} helper={`${formatCurrency(latestNewMoney)} invested · ${formatCurrency(latestWithdrawals)} withdrawn`} icon={BadgeIndianRupee} tone="amber" />
        <SummaryMetric label="Reports generated" value={String(reports.length)} helper={latestReport ? `Latest: ${reportMonthText(latestReport)}` : "Create the first report"} icon={FileBarChart} tone="slate" />
      </section>

      <div className="sticky top-[70px] z-20 -mx-1 overflow-hidden bg-[var(--gv-surface)]/95 px-1 py-2 backdrop-blur">
        <SegmentedTabs items={tabs} value={tab} onChange={setTab} ariaLabel="Investor profile sections" />
      </div>

      {tab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-5">
            <Card className="p-5 sm:p-6">
              <SectionHeader
                eyebrow="Financial journey"
                title="Progress at a glance"
                description="The latest reported portfolio, primary goal and monthly contribution capacity in one view."
                action={<Link href={`/reports/create?investorId=${investor.id}`} className="text-sm font-semibold text-blue-700 hover:underline">Create this month&apos;s report</Link>}
              />

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(250px,0.75fr)]">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Primary financial goal</p>
                      <h3 className="mt-2 font-heading text-2xl font-bold text-slate-950">{primaryGoal?.name || "Primary goal not selected"}</h3>
                      <p className="mt-1 text-sm text-slate-500">{primaryGoal?.timeline || primaryGoal?.targetYear ? `Target ${primaryGoal.timeline || primaryGoal.targetYear}` : "Add the investor's priority goal and timeline."}</p>
                    </div>
                    <p className="font-heading text-xl font-bold text-blue-800 tabular-nums">{formatCurrency(primaryGoal?.targetAmount)}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{formatCurrency(primaryGoal?.currentAmount)} accumulated</span>
                    <span>{primaryGoal?.targetAmount ? `${Math.min(100, (Number(primaryGoal.currentAmount || 0) / Number(primaryGoal.targetAmount || 1)) * 100).toFixed(1)}%` : "0.0%"}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-[#1F4ED8]" style={{ width: `${primaryGoal?.targetAmount ? Math.min(100, (Number(primaryGoal.currentAmount || 0) / Number(primaryGoal.targetAmount || 1)) * 100) : 0}%` }} />
                  </div>
                  <button type="button" onClick={() => setTab("goals")} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
                    View all goals <ChevronRight size={15} />
                  </button>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Combined goal target</p>
                    <p className="mt-2 font-heading text-2xl font-bold text-slate-950 tabular-nums">{formatCurrency(totalGoalTarget)}</p>
                    <p className="mt-1 text-xs text-slate-500">{goals.length} goal{goals.length === 1 ? "" : "s"} · {goalProgress.toFixed(1)}% funded</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Monthly investment capacity</p>
                    <p className="mt-2 font-heading text-2xl font-bold text-slate-950 tabular-nums">{formatCurrency(preferenceTotals.sipAmount)}</p>
                    <p className="mt-1 text-xs text-slate-500">Across {preferences.length} preference plan{preferences.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionHeader
                eyebrow="Investor details"
                title="Personal and contact information"
                description="Core identity and financial profile information used across assessments, meetings and reports."
                action={<Link href={`/investors/${investor.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Edit3 size={15} /> Edit profile</Link>}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <InfoRow label="Email" value={investor.email} icon={Mail} href={investor.email ? `mailto:${investor.email}` : null} />
                <InfoRow label="Mobile number" value={investor.contactNo} icon={Phone} href={investor.contactNo ? `tel:${investor.contactNo}` : null} />
                <InfoRow label="PAN number" value={investor.panNumber || investor.panNormalized || "Not added"} icon={IdCard} />
                <InfoRow label="Aadhaar" value={investor.aadhaarConfigured ? `XXXX XXXX ${investor.aadhaarLast4 || "••••"}` : "Not added"} icon={ShieldCheck} />
                <InfoRow label="Date of birth" value={personal.dateOfBirth ? `${formatDate(personal.dateOfBirth)}${personal.age !== undefined && personal.age !== "" ? ` · ${personal.age} years` : ""}` : "Not added"} icon={CalendarDays} />
                <InfoRow label="Birthday reminder" value={birthdayReminderLabel(personal)} icon={Clock3} />
                <InfoRow label="Next birthday" value={nextBirthdayLabel(personal)} icon={CalendarPlus} />
                <InfoRow label="Occupation" value={personal.occupation} icon={UserRound} />
                <InfoRow label="Marital status" value={personal.maritalStatus} icon={UsersRound} />
                <InfoRow label="Annual income" value={formatCurrency(personal.annualIncome)} icon={CircleDollarSign} />
                <InfoRow label="Monthly surplus" value={monthlySurplusLabel(personal)} icon={BadgeIndianRupee} />
                <InfoRow label="City / location" value={personal.city || personal.location || investor.city} icon={MapPin} />
                <InfoRow label="Risk profile" value={risk.finalProfile || "Assessment pending"} icon={ShieldCheck} />
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionHeader
                eyebrow="Financial position"
                title="Investments and obligations"
                description="Profile-level investment records and liabilities captured during assessment."
                action={<button type="button" onClick={() => setTab("portfolio")} className="text-sm font-semibold text-blue-700 hover:underline">View portfolio details</button>}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Profile investments</p>
                  <p className="mt-2 font-heading text-2xl font-bold text-blue-950 tabular-nums">{formatCurrency(totalInvestments)}</p>
                  <p className="mt-1 text-xs text-blue-700">{investments.length} investment record{investments.length === 1 ? "" : "s"}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">Outstanding liabilities</p>
                  <p className="mt-2 font-heading text-2xl font-bold text-red-950 tabular-nums">{formatCurrency(totalLiabilities)}</p>
                  <p className="mt-1 text-xs text-red-700">{liabilities.length} liability record{liabilities.length === 1 ? "" : "s"}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Investable surplus</p>
                  <p className="mt-2 font-heading text-2xl font-bold text-emerald-950 tabular-nums">{formatCurrency(personal.monthlySurplus)}</p>
                  <p className="mt-1 text-xs text-emerald-700">{personal.monthlySurplusMode === "percentage" ? `${Number(personal.monthlySurplusPercentage || 0)}% of monthly income · auto-calculated` : "Fixed amount available per month"}</p>
                </div>
              </div>
            </Card>
          </div>

          <aside className="grid content-start gap-5">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Latest monthly report</p>
                  <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">{reportMonthText(latestReport)}</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><FileBarChart size={19} /></span>
              </div>
              {latestReport ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Portfolio</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(latestReport.summary?.totalCorpus)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Return</p>
                      <p className={`mt-1 text-sm font-bold tabular-nums ${latestMonthlyReturn < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatPercent(latestMonthlyReturn)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <ReportStatusBadge status={latestReport.status} />
                    <Link href={`/reports/${latestReport.id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">Open report <ChevronRight size={15} /></Link>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-500">No monthly report has been created for this investor.</div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Relationship advisor</p>
                  <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">{investor.assignedAdvisorName || "Unassigned"}</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><UserRound size={19} /></span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">Responsible for reviews, advisory communication and monthly report delivery.</p>
              {investor.assignedAdvisorEmail ? <a href={`mailto:${investor.assignedAdvisorEmail}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Mail size={15} /> Email advisor</a> : null}
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Next review</p>
                  <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">{upcomingMeeting?.title || "No review scheduled"}</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-700"><CalendarDays size={19} /></span>
              </div>
              {upcomingMeeting ? (
                <>
                  <p className="mt-3 text-sm text-slate-600">{formatDateTime(upcomingMeeting.startAt)}</p>
                  <Link href={`/meetings/${upcomingMeeting.id}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800">Open meeting</Link>
                </>
              ) : (
                <Link href={`/meetings/create?investorId=${investor.id}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1F4ED8] px-4 text-sm font-semibold text-white">Schedule review</Link>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Assessment status</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-heading text-2xl font-bold text-slate-950">{risk.finalProfile || "Pending"}</p>
                  <p className="mt-1 text-xs text-slate-500">Risk score {risk.totalScore ?? 0} / 20</p>
                </div>
                <StatusPill label={qualification.status || "Pending"} tone={qualification.status ? "warning" : "neutral"} />
              </div>
              <button type="button" onClick={() => setTab("assessment")} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">Open assessment <ChevronRight size={15} /></button>
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === "goals" ? (
        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Goals & Bucket List"
            title="Financial goals, corpus and life milestones"
            description="Track general wealth creation or specific goals. A Bucket List is optional."
            action={<Link href={`/investors/${investor.id}/edit`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800"><Edit3 size={16} /> Manage goals</Link>}
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {goals.length
              ? goals.map((goal, index) => <GoalCard key={goal.id || `${goal.name}-${index}`} goal={goal} />)
              : <div className="lg:col-span-2"><EmptyState title="General Wealth Corpus" description="No specific goal is required. Portfolio holdings can remain under General Wealth and be allocated to goals later." /></div>}
          </div>
        </Card>
      ) : null}

      {tab === "portfolio" ? (
        <div className="grid gap-5">
          <InvestorPortfolioPanel investor={investor} editable />

          {investments.length ? (
            <Card className="p-5 sm:p-6">
              <SectionHeader eyebrow="Assessment reference" title="Legacy profile investments" description="Holdings recorded during assessment are kept as reference until they are reconciled into the Portfolio Master." />
              <div className="mt-5">
                <DataTable columns={[{ key: "type", label: "Type", emphasis: true }, { key: "institution", label: "Fund / institution" }, { key: "currentValue", label: "Current value", align: "right", emphasis: true }, { key: "monthly", label: "Monthly", align: "right" }]} rows={investmentRows} emptyMessage="No assessment investments recorded" />
              </div>
            </Card>
          ) : null}

          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Obligations" title="Liabilities and EMIs" description="Outstanding obligations considered during suitability and cash-flow planning." />
            <div className="mt-5 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">Total outstanding liabilities</p>
              <p className="font-heading text-xl font-bold text-red-950 tabular-nums">{formatCurrency(totalLiabilities)}</p>
            </div>
            <div className="mt-5">
              <DataTable columns={[{ key: "type", label: "Type", emphasis: true }, { key: "lender", label: "Lender" }, { key: "outstanding", label: "Outstanding", align: "right", emphasis: true }, { key: "emi", label: "EMI", align: "right" }]} rows={liabilityRows} emptyMessage="No liabilities recorded" />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeader
              eyebrow="Contribution plans"
              title="Investment preferences"
              description={`${formatCurrency(preferenceTotals.sipAmount)} total SIP · ${formatCurrency(preferenceTotals.lumpSumAmount)} total lump sum`}
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preferences.length ? preferences.map((item, index) => (
                <article key={item.id || index} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Preference {index + 1}</p>
                      <h3 className="mt-1 font-heading text-lg font-bold text-slate-950">{item.investmentType || "—"}</h3>
                      <p className="mt-1 text-xs text-slate-500">{item.preferredFrequency || "Frequency pending"}</p>
                    </div>
                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-right text-xs font-bold text-blue-800">{formatCurrency(item.sipAmount)} SIP<br />{formatCurrency(item.lumpSumAmount)} lump sum</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(item.productsOfInterest || []).map((product) => <span key={product} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{product}</span>)}
                  </div>
                </article>
              )) : <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No preferences recorded" description="Add SIP, lump-sum and advisory preferences from Edit Profile." /></div>}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "reports" ? <InvestorReportsPanel investorId={investor.id} /> : null}

      {tab === "actions" ? (
        <Card className="p-5 sm:p-6">
          <SectionHeader eyebrow="Advisor workflow" title="Advisor Follow-up" description="Investment recommendations, investor decisions and advisory follow-up status for this investor." action={<Link href="/actions" className="inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-4 text-sm font-bold text-white">Open Advisor Follow-up</Link>} />
          <div className="mt-5 grid gap-3">
            {actions.length ? actions.slice(0, 12).map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-base font-bold text-slate-950">{item.title || "Advisor follow-up"}</h3><ActionStatusBadge status={item.status} /></div><p className="mt-1 text-xs font-semibold text-blue-700">{item.requestType || item.recommendationType || "Portfolio Review"}</p>{item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}</div><div className="shrink-0 text-xs text-slate-500"><p>Priority: <strong className="text-slate-700">{item.priority || "Planned"}</strong></p><p className="mt-1">Decision: <strong className="text-slate-700">{item.investorDecision || "Pending Discussion"}</strong></p></div></div></article>) : <EmptyState title="No advisor follow-up" description="Investment requests and report recommendations will appear here automatically." />}
          </div>
        </Card>
      ) : null}

      {tab === "meetings" ? (
        <Card className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Meetings & MOM"
            title="Reviews and discussions"
            description="Scheduled reviews, completed meetings and related minutes of meeting."
            action={<Link href={`/meetings/create?investorId=${investor.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-4 text-sm font-semibold text-white"><CalendarPlus size={16} /> Schedule meeting</Link>}
          />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {meetings.length ? meetings.map((meeting) => (
              <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-slate-950">{meeting.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(meeting.startAt)}</p>
                    <p className="mt-2 text-sm text-slate-600">{meeting.meetingProvider || meeting.meetingMode || "Meeting"}</p>
                  </div>
                  <MeetingStatusBadge status={meeting.status} />
                </div>
              </Link>
            )) : <div className="md:col-span-2"><EmptyState title="No meetings scheduled" description="Schedule the next investor review or portfolio discussion." /></div>}
          </div>
        </Card>
      ) : null}

      {tab === "assessment" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Suitability assessment" title="Risk, qualification and advisor context" description="Assessment outcomes and internal advisory notes used for suitability decisions." />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Final risk profile</p>
                <p className="mt-2 font-heading text-2xl font-bold text-cyan-300">{risk.finalProfile || "Pending"}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Risk score</p>
                <p className="mt-2 font-heading text-2xl font-bold text-blue-950">{risk.totalScore ?? 0} / 20</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Qualification</p>
                <p className="mt-2 font-heading text-2xl font-bold text-amber-950">{qualification.totalScore ?? 0} / 5</p>
                <p className="mt-1 text-xs text-amber-700">{qualification.status || "Pending"}</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Recommendation</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{risk.recommendedProfile || "No recommendation generated."}</p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[["Key concerns", notes.keyConcerns], ["Objections", notes.objections], ["Family dynamics", notes.familyDynamics], ["Additional context", notes.additionalContext]].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value || "—"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><History size={18} className="text-blue-700" /><h2 className="font-heading text-xl font-bold text-slate-950">Assessment history</h2></div>
            <div className="mt-4 grid gap-3">
              {versions.length ? versions.slice(0, 10).map((version) => (
                <article key={version.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between gap-3"><p className="font-semibold text-slate-900">Version {version.versionNumber}</p><span className="text-xs font-semibold text-slate-500">{version.status}</span></div>
                  <p className="mt-1 text-xs text-slate-500">{version.savedByName || "User"} · {formatDate(version.savedAt)}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">{version.riskAssessment?.finalProfile || "Risk pending"} · {version.qualification?.status || "Qualification pending"}</p>
                  {version.reassessmentReason ? <p className="mt-2 text-xs leading-5 text-slate-500">Reason: {version.reassessmentReason}</p> : null}
                </article>
              )) : <EmptyState title="No assessment history" description="Assessment versions will appear after the first save." />}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "access" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <InvestorLifecycleCard investor={investor} />
          <InvestorPortalAccessCard investor={investor} />
          <InvestorDocumentsPanel investor={investor} />
          <Card className="p-5 xl:col-span-2">
            <div className="flex items-start gap-3">
              <ReceiptText size={20} className="mt-0.5 text-blue-700" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Source and relationship dates</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{investor.leadCode ? `Converted from ${investor.leadCode}` : "Investor created directly"}</p>
                <p className="mt-1 text-xs text-slate-500">Investor since {formatDate(investor.investorSince)}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "activity" ? (
        <Card className="p-5 sm:p-6">
          <SectionHeader eyebrow="Investor activity" title="Relationship timeline" description="A combined audit view of report, meeting and assessment activity." />
          <div className="mt-6 grid gap-0">
            {activityItems.length ? activityItems.map((item, index) => {
              const Icon = item.icon;
              const content = (
                <div className="flex gap-4">
                  <div className="relative flex shrink-0 flex-col items-center">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${item.tone}`}><Icon size={17} /></span>
                    {index < activityItems.length - 1 ? <span className="mt-2 h-full w-px bg-slate-200" /> : null}
                  </div>
                  <div className="min-w-0 pb-6">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Clock3 size={13} /> {formatDateTime(item.date)}</p>
                  </div>
                </div>
              );

              return item.href ? <Link key={item.id} href={item.href} className="group">{content}</Link> : <div key={item.id}>{content}</div>;
            }) : <EmptyState title="No activity recorded" description="Reports, meetings and assessment updates will appear here." />}
          </div>
        </Card>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_1.35fr] gap-2">
          <Link href={`/meetings/create?investorId=${investor.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-800"><CalendarPlus size={17} /> Meeting</Link>
          <Link href={`/reports/create?investorId=${investor.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] text-sm font-semibold text-white"><FileBarChart size={17} /> Create Report</Link>
        </div>
      </div>
    </div>
  );
}
