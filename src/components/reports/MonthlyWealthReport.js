"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Download,
  Grid2X2,
  List,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  Target,
  TrendingUp
} from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import {
  allocationStatus,
  buildTrendData,
  compactCurrency,
  deriveAdvisorInsights,
  derivePortfolioHealth,
  deriveReportHighlights,
  deriveReportTransactions,
  goalDisplayStatus,
  goalTone,
  holdingColor,
  initials,
  investorFacingAdvisorDesignation,
  formatClientRelationship,
  previousReportFor
} from "@/lib/utils/reportPresentation";
const ReportTrendChart = dynamic(() => import("@/components/reports/ReportTrendChart"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100" /> });
const ReportDonutChart = dynamic(() => import("@/components/reports/ReportDonutChart"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-full bg-slate-100" /> });
import { getMonthLabel } from "@/lib/constants/report";
import { resolveReportTemplate } from "@/lib/constants/reportTemplates";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveReportBranding } from "@/lib/utils/reportBranding";

const toneClasses = {
  success: "border-emerald-100 bg-emerald-50 text-emerald-800",
  info: "border-cyan-100 bg-cyan-50 text-cyan-900",
  warning: "border-amber-100 bg-amber-50 text-amber-900",
  danger: "border-red-100 bg-red-50 text-red-800"
};

function templateCoverBackground(appearance = {}, branding = {}) {
  const primary = appearance.primaryColor || branding.primaryColor || "#1F4ED8";
  const secondary = appearance.secondaryColor || branding.secondaryColor || "#20B8CD";
  const dark = appearance.darkColor || branding.darkColor || "#111827";

  if (branding.coverBackgroundUrl) {
    return `linear-gradient(rgba(11,11,15,.86), rgba(11,11,15,.93)), url(${branding.coverBackgroundUrl})`;
  }

  switch (appearance.coverStyle) {
    case "performance-grid":
      return `linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(135deg, ${primary} 0%, ${dark} 76%)`;
    case "structured-dark":
      return `linear-gradient(118deg, ${dark} 0%, ${dark} 58%, ${primary} 140%)`;
    case "compact-gradient":
      return `linear-gradient(135deg, ${primary} 0%, ${secondary} 145%)`;
    case "minimal-light":
      return `linear-gradient(135deg, ${dark} 0%, #334155 100%)`;
    case "brand-light":
      return `linear-gradient(135deg, #0F172A 0%, ${primary} 118%)`;
    case "premium-dark":
    default:
      return `radial-gradient(circle at 88% 10%, ${primary}55 0%, transparent 34%), linear-gradient(135deg, ${dark} 0%, #070B14 100%)`;
  }
}


function ReportBrandMark({ branding, inverse = false, imageClassName = "" }) {
  const companyName = branding.companyName || "GrowVest";
  const src = inverse
    ? (branding.whiteLogoUrl || branding.primaryLogoUrl || branding.iconLogoUrl)
    : (branding.primaryLogoUrl || branding.iconLogoUrl);
  if (src) return <img src={src} alt={`${companyName} logo`} className={`block object-contain object-right ${imageClassName}`} />;
  return <span className="text-lg font-black tracking-tight text-white">{companyName}</span>;
}

const goalToneClasses = {
  primary: { badge: "bg-blue-50 text-blue-700", bar: "bg-blue-600", value: "text-blue-700" },
  success: { badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", value: "text-emerald-700" },
  cyan: { badge: "bg-cyan-50 text-cyan-700", bar: "bg-cyan-500", value: "text-cyan-700" },
  danger: { badge: "bg-red-50 text-red-600", bar: "bg-red-500", value: "text-red-600" },
  muted: { badge: "bg-slate-100 text-slate-500", bar: "bg-slate-300", value: "text-slate-400" }
};

function SectionCard({ children, className = "", id, style }) {
  return <section id={id} style={style} className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function downloadCsv(filename, headers, rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadReviewIcs(report, branding = {}) {
  if (!report.nextReview?.date) return;
  const startDate = new Date(`${report.nextReview.date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const date = String(report.nextReview.date).replaceAll("-", "");
  const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}`;
  const title = `${branding.companyName || "GrowVest"} Portfolio Review — ${report.investorName}`;
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${branding.companyName || "GrowVest"}//Monthly Wealth Report//EN`,
    "BEGIN:VEVENT",
    `UID:${report.id || report.reportCode}@growvest.info`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${String(report.nextReview.note || `Portfolio review with ${branding.companyName || "GrowVest"} Advisor`).replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `growvest-review-${report.nextReview.date}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function GoalCard({ goal, listMode = false }) {
  const tone = goalTone(goal);
  const colors = goalToneClasses[tone];
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-5 ${listMode ? "md:grid md:grid-cols-[minmax(220px,1fr)_1fr_180px] md:items-center md:gap-6" : ""}`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-950">{goal.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{goal.category || "Financial goal"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>{goalDisplayStatus(goal)}</span>
        </div>
        {!listMode ? null : <p className="mt-3 text-sm text-slate-500">{goal.type} goal · Target {goal.targetYear || "—"}</p>}
      </div>
      <div className={listMode ? "mt-5 md:mt-0" : "mt-5"}>
        <div className="flex justify-between gap-4 text-sm text-slate-400">
          <span>Current</span><span>Target</span>
        </div>
        <div className="mt-1 flex justify-between gap-4 font-black text-slate-950">
          <span>{compactCurrency(goal.currentAmount)}</span><span className="text-slate-500">{compactCurrency(goal.targetAmount)}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(100, Number(goal.progress || 0))}%` }} />
        </div>
        <div className={`mt-2 flex justify-between text-sm font-bold ${colors.value}`}>
          <span>{Number(goal.progress || 0).toFixed(1)}%</span>
          <span className="font-medium text-slate-400">{goal.targetYear ? `Target ${goal.targetYear}` : "No target year"}</span>
        </div>
      </div>
      <div className={`${listMode ? "mt-5 md:mt-0 md:text-right" : "mt-5 flex items-center justify-between border-t border-slate-100 pt-4"}`}>
        <p className="text-sm text-slate-400">SIP: <span className="font-bold text-slate-950">{Number(goal.monthlySip || 0) ? compactCurrency(goal.monthlySip) : "—"}</span> · <span className="text-blue-600">{goal.type}</span></p>
      </div>
    </article>
  );
}

export default function MonthlyWealthReport({ report, history = [], viewer = "staff" }) {
  const { branding: liveBranding } = useBranding();
  const branding = resolveReportBranding(report, liveBranding);
  const [goalSearch, setGoalSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState("All Goals");
  const [goalView, setGoalView] = useState("grid");
  const summary = report.summary || {};
  const goals = report.goals || [];
  const allocation = report.allocation || [];
  const funds = report.funds || [];
  const transactions = deriveReportTransactions(report);
  const holdings = report.holdings || [];
  const nextSteps = report.nextSteps || [];
  const insights = deriveAdvisorInsights(report);
  const monthlyHighlights = deriveReportHighlights(report);
  const health = derivePortfolioHealth(report);
  const trend = buildTrendData(report, history);
  const previous = previousReportFor(report, history);
  const previousValue = Number(previous?.summary?.totalCorpus || 0);
  const monthChange = Number(summary.totalCorpus || 0) - previousValue;
  const monthChangePercentage = previousValue > 0 ? (monthChange / previousValue) * 100 : 0;
  const advisorEmail = report.advisorEmail || "cwp@growvest.info";
  const advisorPhone = report.advisorPhone || "";
  const period = `${getMonthLabel(report.reportMonth)} ${report.reportYear}`;
  const journeyMonths = Number(report.journeyDurationMonths || 0);
  const advisorDesignation = investorFacingAdvisorDesignation(report.advisorDesignation);
  const advisorOrganization = branding.legalName || branding.companyName || "GrowVest Advisors Private Limited";
  const clientRelationship = formatClientRelationship(journeyMonths, branding.companyName || "GrowVest");
  const hasInverseLogo = Boolean(branding.whiteLogoUrl);
  const template = resolveReportTemplate(report);
  const templateAppearance = template.appearance || {};
  const templateDocument = templateAppearance.document || {};
  const sectionOrder = template.sectionOrder || [];
  const sectionVisibility = template.sectionVisibility || {};
  const sectionVisible = (key) => sectionVisibility[key] !== false;
  const sectionStyle = (key, offset = 0) => ({ order: Math.max(0, sectionOrder.indexOf(key)) * 10 + offset });

  const filteredGoals = useMemo(() => goals.filter((goal) => {
    const matchesSearch = !goalSearch || `${goal.name} ${goal.category}`.toLowerCase().includes(goalSearch.toLowerCase());
    if (!matchesSearch) return false;
    const display = goalDisplayStatus(goal);
    if (goalFilter === "All Goals") return true;
    if (goalFilter === "On Track") return display === "On Track" || display === "SIP Running" || display === "Completed";
    if (goalFilter === "Near Completion") return display === "Near Completion";
    if (goalFilter === "Attention Required") return display === "Attention Required";
    if (goalFilter === "Not Started") return display === "Not Started" || Number(goal.progress || 0) === 0;
    return true;
  }), [goals, goalFilter, goalSearch]);

  const activeGoals = goals.filter((goal) => goal.status !== "Completed" && goal.status !== "Paused").length;
  const attentionGoals = goals.filter((goal) => goalTone(goal) === "danger").length;
  const onTrackGoals = goals.filter((goal) => ["success", "cyan", "primary"].includes(goalTone(goal))).length;

  const templatePrimary = templateAppearance.primaryColor || branding.primaryColor || "#1F4ED8";
  const templateSecondary = templateAppearance.secondaryColor || branding.secondaryColor || "#20B8CD";

  return (
    <div
      className="monthly-wealth-report relative grid gap-6 overflow-hidden"
      data-report-template={template.id}
      data-report-template-version={template.version}
      style={{
        "--report-primary": templatePrimary,
        "--report-secondary": templateSecondary,
        "--report-dark": templateAppearance.darkColor || branding.darkColor || "#111827"
      }}
    >
      {branding.watermarkUrl ? <img src={branding.watermarkUrl} alt="" aria-hidden="true" style={{ opacity: Math.min(0.15, Math.max(0, Number(branding.watermarkOpacity || 4) / 100)) }} className="pointer-events-none absolute left-1/2 top-[42%] z-0 max-h-[520px] max-w-[70%] -translate-x-1/2 -translate-y-1/2 object-contain" /> : null}
      <section id="report-overview" style={{
        ...sectionStyle("cover"),
        backgroundColor: templateAppearance.darkColor || branding.darkColor || "#111827",
        backgroundImage: templateCoverBackground(templateAppearance, branding),
        backgroundSize: templateAppearance.coverStyle === "performance-grid" && !branding.coverBackgroundUrl ? "32px 32px, 32px 32px, cover" : "cover",
        backgroundPosition: "center"
      }} className={`scroll-mt-32 relative z-[1] overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:p-7 lg:p-8 ${sectionVisible("cover") ? "" : "hidden"}`}>
        <div className="pointer-events-none absolute -right-28 -top-52 h-[480px] w-[620px] rounded-full border border-cyan-400/10" />
        <div className="pointer-events-none absolute -right-10 -top-32 h-[360px] w-[500px] rounded-full border border-blue-400/10" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          {templateDocument.showConfidentialLabel !== false && branding.showConfidentialLabel !== false ? <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">{branding.confidentialLabel || "Confidential client report"}</span> : <span />}

          {templateDocument.showLogo !== false ? <div className="shrink-0">
            {hasInverseLogo ? (
              <ReportBrandMark branding={branding} inverse imageClassName="max-h-8 max-w-[145px] sm:max-h-9 sm:max-w-[165px]" />
            ) : branding.primaryLogoUrl ? (
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <ReportBrandMark branding={branding} imageClassName="max-h-7 max-w-[135px] sm:max-h-8 sm:max-w-[155px]" />
              </div>
            ) : (
              <ReportBrandMark branding={branding} inverse imageClassName="max-h-8 max-w-[145px]" />
            )}
          </div> : null}
        </div>

        <div className={`relative z-10 mt-7 grid gap-7 lg:items-end xl:gap-9 ${templateAppearance.advisorCardVisible === false ? "" : "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <span style={{ backgroundColor: templatePrimary }} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-black text-white shadow-[0_8px_24px_rgba(31,78,216,0.28)]">
                {initials(report.investorName)}
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">
                  Monthly Wealth Progress Report
                </p>
                <h1 className="mt-1 max-w-3xl font-heading text-[30px] font-bold leading-[1.08] tracking-[-0.025em] !text-white sm:text-4xl lg:text-[42px]">
                  {report.investorName}&apos;s Wealth Journey
                </h1>
              </div>
            </div>

            <p className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-base">
              A clear view of your portfolio progress, financial priorities and recommended next actions for {period}.
            </p>

            <dl className="mt-6 grid gap-3 min-[520px]:grid-cols-2">
              {[
                ["Reporting Period", period],
                ["Statement Date", formatDate(report.statementDate)],
                ...(templateDocument.showClientCode !== false ? [["Client ID", report.clientCode || "—"]] : []),
                ["Relationship", clientRelationship]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3">
                  <dt className="text-xs font-medium text-slate-400">{label}</dt>
                  <dd className="mt-1 break-words text-[15px] font-bold text-white sm:text-base">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {templateAppearance.advisorCardVisible !== false ? <aside className="rounded-2xl border border-white/15 bg-white/[0.065] p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">Your Advisor</p>

            <div className="mt-3 flex items-center gap-3">
              <span style={{ backgroundColor: templatePrimary }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black text-white">
                {initials(report.advisorName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{report.advisorName || `${branding.companyName || "GrowVest"} Advisor`}</p>
                <p className="mt-0.5 text-sm text-slate-300">{advisorDesignation}</p>
                <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-cyan-400">{advisorOrganization}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Personalised guidance and strategic financial planning for your wealth journey.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <a
                href={`mailto:${advisorEmail}`}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.07] px-2 py-2 text-xs font-bold text-white transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                <Mail size={16} className="text-cyan-400" />
                Email
              </a>
              <a
                href={advisorPhone ? `tel:${advisorPhone}` : `mailto:${advisorEmail}`}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.07] px-2 py-2 text-xs font-bold text-white transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                <Phone size={16} className="text-cyan-400" />
                Call
              </a>
              <Link
                href={viewer === "investor" ? "/investor/meetings" : `/meetings/create?investorId=${report.investorId}`}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.07] px-2 py-2 text-xs font-bold text-white transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                <CalendarDays size={16} className="text-cyan-400" />
                Schedule
              </Link>
            </div>
          </aside> : null}
        </div>
      </section>

      <SectionCard id="report-performance" style={sectionStyle("executiveSummary")} className={`scroll-mt-32 p-5 sm:p-6 ${sectionVisible("executiveSummary") ? "" : "hidden"}`}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Portfolio Value</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{compactCurrency(summary.totalCorpus)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-5 text-sm">
              <span className={monthChange >= 0 ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{monthChange >= 0 ? "+" : ""}{compactCurrency(monthChange)} this month</span>
              <span className="text-slate-500">Previous: <strong className="text-slate-950">{previousValue ? compactCurrency(previousValue) : "Not available"}</strong></span>
            </div>
            <div className="mt-5 flex items-center justify-between text-xs text-slate-400"><span>Overall Bucket List Progress — {Number(summary.overallProgress || 0).toFixed(1)}% of {compactCurrency(summary.lifetimeTarget)} lifetime target</span><strong className="text-blue-700">{Number(summary.overallProgress || 0).toFixed(1)}%</strong></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Number(summary.overallProgress || 0))}%` }} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-1">
            <span className={`mx-auto inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${monthChangePercentage >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><TrendingUp size={15} /> {monthChangePercentage >= 0 ? "+" : ""}{monthChangePercentage.toFixed(2)}%</span>
            <button type="button" onClick={() => document.getElementById("report-allocation")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl border border-blue-200 px-5 text-sm font-black text-blue-700 hover:bg-blue-50">View Portfolio Details <ArrowRight size={17} /></button>
          </div>
        </div>
      </SectionCard>

      <div style={sectionStyle("executiveSummary", 1)} className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${sectionVisible("executiveSummary") ? "" : "hidden"}`}>
        {[
          ["Monthly SIP", compactCurrency(summary.monthlySip), "Active this month", RefreshCcw, "text-blue-700 bg-blue-50"],
          ["New Money Added", compactCurrency(summary.newMoneyAdded), "Contributions received", ArrowRight, "text-cyan-700 bg-cyan-50"],
          ["Investment Gain", compactCurrency(summary.investmentGain), `Growth during ${getMonthLabel(report.reportMonth)}`, TrendingUp, "text-emerald-700 bg-emerald-50"],
          ["Active Bucket List Goals", activeGoals, `${onTrackGoals} on track · ${attentionGoals} need attention`, Target, "text-amber-700 bg-amber-50"]
        ].map(([label, value, hint, Icon, tone]) => (
          <SectionCard key={label} className="p-5">
            <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={`grid h-10 w-10 place-items-center rounded-full ${tone}`}><Icon size={16} /></span></div>
            <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
            <p className="mt-2 text-sm text-slate-400">{hint}</p>
          </SectionCard>
        ))}
      </div>

      <div id="portfolio-trend" style={sectionStyle("performanceTrend")} className={`scroll-mt-32 grid gap-5 xl:grid-cols-[1.45fr_0.95fr] ${sectionVisible("performanceTrend") ? "" : "hidden"}`}>
        <SectionCard className="p-6">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-black text-slate-950">Portfolio Value Trend</h2><p className="mt-1 text-sm text-slate-400">Historical completed monthly reports</p></div><span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">Last {trend.length} reports</span></div>
          <div className="mt-5"><ReportTrendChart data={trend} /></div>
        </SectionCard>
        <SectionCard className="p-6">
          <h2 className="text-lg font-black text-slate-950">This Month at a Glance</h2>
          <div className="mt-5 grid gap-3">
            {monthlyHighlights.map((item, index) => (
              <div key={item.id || index} className={`rounded-2xl border px-4 py-4 text-sm ${toneClasses[item.type] || toneClasses.info}`}>
                <div className="flex gap-3"><span className="mt-0.5"><CircleAlert size={16} /></span><div><p className="font-black">{item.title}</p><p className="mt-1 leading-6">{item.description}</p></div></div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard id="portfolio-composition" style={sectionStyle("performance", 1)} className={`p-5 sm:p-6 ${sectionVisible("performance") ? "" : "hidden"}`}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Portfolio Composition</h2><span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">Current</span></div>
        <div className="mt-6"><ReportDonutChart holdings={holdings} total={summary.totalCorpus} /></div>
      </SectionCard>

      <section id="report-goals" style={sectionStyle("goals")} className={`scroll-mt-32 ${sectionVisible("goals") ? "" : "hidden"}`}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div><h2 className="text-2xl font-black text-slate-950">Bucket List Progress</h2><p className="mt-1 text-sm text-slate-400">Goal-by-goal wealth progress</p></div>
          {viewer === "staff" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={goalSearch} onChange={(event) => setGoalSearch(event.target.value)} placeholder="Search goals..." className="h-11 rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500" /></label>
              <button type="button" onClick={() => setGoalView("grid")} className={`grid h-10 w-10 place-items-center rounded-full border ${goalView === "grid" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-400"}`}><Grid2X2 size={16} /></button>
              <button type="button" onClick={() => setGoalView("list")} className={`grid h-10 w-10 place-items-center rounded-full border ${goalView === "list" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-400"}`}><List size={16} /></button>
            </div>
          ) : null}
        </div>
        {viewer === "staff" ? <div className="mt-4 flex flex-wrap gap-2">{["All Goals", "On Track", "Near Completion", "Attention Required", "Not Started"].map((item) => <button key={item} type="button" onClick={() => setGoalFilter(item)} className={`rounded-full border px-4 py-2 text-xs font-bold ${goalFilter === item ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{item}</button>)}</div> : null}
        <div className={`mt-5 grid gap-4 ${goalView === "grid" ? "lg:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1"}`}>
          {(viewer === "staff" ? filteredGoals : goals).map((goal) => <GoalCard key={goal.goalId} goal={goal} listMode={viewer === "staff" && goalView === "list"} />)}
          {!(viewer === "staff" ? filteredGoals : goals).length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No Bucket List goals match this filter.</div> : null}
        </div>
      </section>

      <SectionCard id="report-allocation" style={sectionStyle("allocation")} className={`scroll-mt-32 p-5 sm:p-6 ${sectionVisible("allocation") ? "" : "hidden"}`}>
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div><h2 className="text-lg font-black text-slate-950">Portfolio Health</h2><p className="mt-1 text-sm text-slate-400">Current vs. Target Strategic Allocation</p></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Diversification", health.needsRebalancing ? "Needs Rebalancing" : "On Track", health.needsRebalancing ? "text-amber-600" : "text-emerald-600"],
              ["Growth Assets", `${health.growth.toFixed(1)}%`, "text-blue-700"],
              ["Stable &amp; Liquid", `${health.stable.toFixed(1)}%`, "text-cyan-600"],
              ["Allocation Gaps", `${health.gaps} classes`, health.gaps ? "text-red-600" : "text-emerald-600"]
            ].map(([label, value, tone]) => <div key={label} className="rounded-2xl bg-slate-50 px-5 py-3 text-center"><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 font-black ${tone}`}>{value}</p></div>)}
          </div>
        </div>
        <div className="mt-7 grid gap-5">
          {allocation.map((item) => (
            <div key={item.id} className="grid gap-3 md:grid-cols-[130px_minmax(0,1fr)_190px] md:items-center">
              <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: holdingColor(item) }} /><p className="font-bold text-slate-950">{item.assetClass}</p></div>
              <div className="relative h-6 overflow-hidden rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${Math.min(100, Number(item.targetPercentage || 0))}%`, backgroundColor: holdingColor(item) }} /><div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, Number(item.currentPercentage || 0))}%`, backgroundColor: holdingColor(item) }} /></div>
              <div className="grid grid-cols-3 gap-3 text-right text-sm"><span>{Number(item.currentPercentage || 0).toFixed(1)}%</span><span className="text-slate-400">{Number(item.targetPercentage || 0).toFixed(1)}%</span><strong className={Number(item.variance || 0) > 0 ? "text-red-600" : "text-emerald-600"}>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</strong></div>
            </div>
          ))}
          {!allocation.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No strategic allocation data is available for this report.</div> : null}
        </div>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-800"><strong className="text-amber-600">Observation:</strong> {health.observation}</div>
        <a href={`mailto:${advisorEmail}?subject=${encodeURIComponent(`${branding.companyName || "GrowVest"} Allocation Review`)}`} className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 px-5 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"><TrendingUp size={16} /> Review Allocation With Advisor</a>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center"><div><h2 className="text-lg font-black text-slate-950">Asset Allocation</h2><p className="mt-1 text-sm text-slate-400">Current and target allocation by asset class</p></div>{viewer === "staff" ? <button type="button" onClick={() => downloadCsv(`growvest-allocation-${report.reportMonthKey}.csv`, ["Asset Class", "Current Value", "Monthly SIP", "Portfolio %", "Target %", "Variance", "Status"], allocation.map((item) => [item.assetClass, item.currentValue, item.monthlySip, item.currentPercentage, item.targetPercentage, item.variance, allocationStatus(item).label]))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"><Download size={15} /> Export</button> : null}</div>
        <div className="grid gap-3 px-4 pb-5 md:hidden">{allocation.map((item) => { const status = allocationStatus(item); return <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black text-slate-950"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: holdingColor(item) }} />{item.assetClass}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.tone === "danger" ? "bg-red-50 text-red-600" : status.tone === "success" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>{status.label}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-xs text-slate-400">Current value</span><strong className="mt-1 block text-slate-900">{compactCurrency(item.currentValue)}</strong></div><div><span className="text-xs text-slate-400">Monthly SIP</span><strong className="mt-1 block text-slate-900">{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</strong></div><div><span className="text-xs text-slate-400">Portfolio / Target</span><strong className="mt-1 block text-slate-900">{Number(item.currentPercentage || 0).toFixed(1)}% / {Number(item.targetPercentage || 0).toFixed(1)}%</strong></div><div><span className="text-xs text-slate-400">Variance</span><strong className={`mt-1 block ${Number(item.variance || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</strong></div></div></article>; })}</div>
        <div className="hidden overflow-x-auto md:block"><table className="min-w-[920px] w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{["Asset Class", "Current Value", "Monthly SIP", "Portfolio %", "Target %", "Variance", "Status"].map((item) => <th key={item} className="px-6 py-4 font-bold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{allocation.map((item) => { const status = allocationStatus(item); return <tr key={item.id}><td className="px-6 py-4 font-black text-slate-950"><span className="mr-3 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: holdingColor(item) }} />{item.assetClass}</td><td className="px-6 py-4 font-bold">{compactCurrency(item.currentValue)}</td><td className="px-6 py-4">{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</td><td className="px-6 py-4 font-black">{Number(item.currentPercentage || 0).toFixed(1)}%</td><td className="px-6 py-4 text-slate-500">{Number(item.targetPercentage || 0).toFixed(1)}%</td><td className={`px-6 py-4 font-black ${Number(item.variance || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.tone === "danger" ? "bg-red-50 text-red-600" : status.tone === "success" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>{status.label}</span></td></tr>; })}</tbody></table></div>
      </SectionCard>

      <SectionCard id="report-holdings" style={sectionStyle("holdings")} className={`scroll-mt-32 overflow-hidden ${sectionVisible("holdings") ? "" : "hidden"}`}>
        <div className="flex flex-col justify-between gap-4 p-5 sm:p-6 md:flex-row md:items-center"><div><h2 className="text-lg font-black text-slate-950">Fund-wise Holdings</h2><p className="mt-1 text-sm text-slate-400">{funds.length} instruments · {compactCurrency(summary.monthlySip)} monthly SIP · {compactCurrency(summary.totalCorpus)} total value</p></div>{viewer === "staff" ? <button type="button" onClick={() => downloadCsv(`growvest-funds-${report.reportMonthKey}.csv`, ["Instrument", "Class", "Linked Goal", "Monthly SIP", "Current Value", "Weight", "Type"], funds.map((item) => [item.instrumentName, item.assetClass, item.goalName || "Flexible Pool", item.monthlySip, item.currentValue, summary.totalCorpus ? ((Number(item.currentValue || 0) / Number(summary.totalCorpus)) * 100).toFixed(1) : 0, item.type]))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"><Download size={15} /> Export</button> : null}</div>
        <div className="grid gap-3 px-4 pb-5 md:hidden">{funds.map((item) => { const weight = summary.totalCorpus ? (Number(item.currentValue || 0) / Number(summary.totalCorpus)) * 100 : 0; return <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{item.instrumentName}</p><p className="mt-1 text-xs text-slate-500">{item.assetClass} · {item.goalName || "Flexible Pool"}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{weight.toFixed(1)}%</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-xs text-slate-400">Current value</span><strong className="mt-1 block text-slate-900">{compactCurrency(item.currentValue)}</strong></div><div><span className="text-xs text-slate-400">Monthly SIP</span><strong className="mt-1 block text-slate-900">{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</strong></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, weight)}%` }} /></div></article>; })}{!funds.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No fund-wise holdings have been added.</div> : null}</div>
        <div className="hidden overflow-x-auto md:block"><table className="min-w-[980px] w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{["Instrument", "Class", "Linked Goal", "Monthly SIP", "Current Value", "Weight", "Type"].map((item) => <th key={item} className="px-6 py-4 font-bold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{funds.map((item) => { const weight = summary.totalCorpus ? (Number(item.currentValue || 0) / Number(summary.totalCorpus)) * 100 : 0; return <tr key={item.id}><td className="px-6 py-4 font-black text-slate-950">{item.instrumentName}</td><td className="px-6 py-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.assetClass}</span></td><td className="px-6 py-4 text-slate-500">{item.goalName || "Flexible Pool"}</td><td className="px-6 py-4 font-bold">{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</td><td className="px-6 py-4 font-black">{compactCurrency(item.currentValue)}</td><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, weight)}%` }} /></div><span className="text-slate-500">{weight.toFixed(1)}%</span></div></td><td className="px-6 py-4 text-slate-500">{item.type}</td></tr>; })}</tbody></table></div>
      </SectionCard>

      <SectionCard id="report-transactions" style={sectionStyle("transactions")} className={`scroll-mt-32 overflow-hidden ${sectionVisible("transactions") ? "" : "hidden"}`}>
        <div className="flex items-center justify-between gap-4 p-5 sm:p-6"><div><h2 className="font-heading text-xl font-bold text-slate-950">Transactions</h2><p className="mt-1 text-sm text-slate-400">Monthly investments and withdrawals included in this report</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{transactions.length} entries</span></div>
        {transactions.length ? (
          <>
            <div className="grid gap-3 px-4 pb-5 md:hidden">{transactions.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{item.instrumentName}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.date)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.type === "Withdrawal" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{item.type}</span></div><p className="mt-4 font-heading text-xl font-bold text-slate-950">{compactCurrency(item.amount)}</p>{item.notes ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.notes}</p> : null}</article>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="min-w-[760px] w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{["Date", "Transaction Type", "Instrument", "Amount", "Notes"].map((label) => <th key={label} className="px-6 py-4 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{transactions.map((item) => <tr key={item.id}><td className="px-6 py-4 text-slate-500">{formatDate(item.date)}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.type === "Withdrawal" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{item.type}</span></td><td className="px-6 py-4 font-bold text-slate-950">{item.instrumentName}</td><td className="px-6 py-4 font-black">{compactCurrency(item.amount)}</td><td className="px-6 py-4 text-slate-500">{item.notes || "—"}</td></tr>)}</tbody></table></div>
          </>
        ) : <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No transaction-level data was recorded for this report.</div>}
      </SectionCard>

      <section id="report-commentary" style={{ ...sectionStyle("commentary"), backgroundColor: templateAppearance.darkColor || "#152238" }} className={`scroll-mt-32 rounded-2xl p-5 text-white sm:p-7 md:p-8 ${sectionVisible("commentary") ? "" : "hidden"}`}>
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_410px] xl:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">Advisor Insights · {period}</p>
            <blockquote className="mt-4 text-xl font-medium leading-8">&quot;{insights.narrative}&quot;</blockquote>
            <div className="mt-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-black">{initials(report.advisorName)}</span><div><p className="font-black">{report.advisorName || `${branding.companyName || "GrowVest"} Advisor`}</p><p className="text-sm text-slate-400">{advisorDesignation} · {advisorOrganization}</p></div></div>
            <a href={`mailto:${advisorEmail}?subject=${encodeURIComponent(`Discuss ${period} Wealth Report`)}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-black hover:bg-blue-500"><Mail size={16} /> Discuss With Advisor</a>
          </div>
          <div className="grid gap-3">
            {[
              ["Progress Highlight", insights.progressHighlight, "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"],
              ["Priority Attention", insights.priorityAttention, "border-red-500/30 bg-red-500/10 text-red-300"],
              ["Portfolio Opportunity", insights.portfolioOpportunity, "border-amber-500/30 bg-amber-500/10 text-amber-300"]
            ].map(([label, item, tone]) => (
              <div key={label} className={`rounded-2xl border p-4 ${tone}`}><p className="text-xs font-bold">{label}</p><p className="mt-2 font-black text-white">{item.title}</p><p className="mt-1 text-sm text-slate-300">{item.description}</p></div>
            ))}
          </div>
        </div>
      </section>


      <SectionCard id="report-actions" style={sectionStyle("actions")} className={`scroll-mt-32 p-5 sm:p-6 ${sectionVisible("actions") ? "" : "hidden"}`}>
        <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-black text-slate-950">Advisor-Recommended Actions</h2><span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">{nextSteps.filter((item) => item.status !== "Completed").length} pending</span></div>
        <div className="mt-5 grid gap-3">{nextSteps.map((item) => <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:p-5"><div className="flex gap-4"><span className={`mt-1 grid h-6 w-6 place-items-center rounded-full border ${item.status === "Completed" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{item.status === "Completed" ? <CheckCircle2 size={14} /> : null}</span><div><p className="font-black text-slate-950">{item.title || item.description}</p>{item.title && item.description && item.description !== item.title ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}<p className="mt-2 text-xs font-semibold text-blue-600">Owner: {item.owner} · {item.priority || "Planned"} · {item.status}</p></div></div><p className="shrink-0 text-sm text-slate-400">{item.dueDate ? formatDate(item.dueDate) : "Next Review"}</p></div>)}{!nextSteps.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No Advisor-recommended actions were recorded for this month.</div> : null}</div>
      </SectionCard>

      <SectionCard id="report-review" style={sectionStyle("actions", 1)} className={`scroll-mt-32 p-5 sm:p-6 ${sectionVisible("actions") ? "" : "hidden"}`}>
        <div className="grid gap-7 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Upcoming</p><h2 className="mt-2 text-2xl font-black text-slate-950">Next Portfolio Review</h2><p className="mt-3 font-bold text-slate-950"><CalendarDays size={16} className="mr-2 inline text-slate-400" />{formatDate(report.nextReview?.date)} <span className="font-normal text-slate-400">· {report.advisorName}</span></p><p className="mt-5 text-xs font-bold uppercase text-slate-400">Review Agenda</p><ol className="mt-3 grid gap-3">{nextSteps.slice(0, 4).map((item, index) => <li key={item.id} className="flex items-center gap-3 text-sm text-slate-600"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{index + 1}</span>{item.title || item.description}</li>)}</ol></div>
          <div className="grid gap-3"><button type="button" onClick={() => downloadReviewIcs(report, branding)} disabled={!report.nextReview?.date} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-blue-600 px-6 text-sm font-black text-white disabled:opacity-50"><CalendarDays size={17} /> Add to Calendar</button><Link href={viewer === "investor" ? "/investor/meetings" : `/meetings/create?investorId=${report.investorId}`} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-600"><RefreshCcw size={17} /> Schedule / Reschedule</Link><a href={`mailto:${advisorEmail}`} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-600"><Phone size={17} /> Contact Advisor</a><Link href={viewer === "investor" ? "/investor/meetings" : `/meetings?investorId=${report.investorId}`} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-600">View Previous Review</Link></div>
        </div>
      </SectionCard>

      <SectionCard id="report-disclaimer" style={sectionStyle("disclaimer")} className={`scroll-mt-32 p-5 sm:p-6 ${sectionVisible("disclaimer") ? "" : "hidden"}`}>
        <h2 className="font-heading text-xl font-bold text-slate-950">Report Information &amp; Disclaimer</h2>
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-slate-400">Report Generated</p><p className="mt-1 font-bold text-slate-600">{formatDate(report.completedAt || report.updatedAt)}</p><p className="mt-4 text-slate-400">Client ID</p><p className="mt-1 font-bold text-slate-600">{report.clientCode}</p></div>
          <div><p className="text-slate-400">Report Reference</p><p className="mt-1 font-bold text-slate-600">{report.reportCode}</p><p className="mt-4 text-slate-400">Advisor</p><p className="mt-1 font-bold text-slate-600">{report.advisorName}</p></div>
          <div><p className="text-slate-400">Data Last Updated</p><p className="mt-1 font-bold text-slate-600">{formatDate(report.updatedAt)}</p><p className="mt-4 text-slate-400">Version</p><p className="mt-1 font-bold text-slate-600">Version {report.version || 1}</p></div>
        </div>
        <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-500">{report.disclaimer}</p>
      </SectionCard>
    </div>
  );
}
