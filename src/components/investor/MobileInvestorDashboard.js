"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileBarChart2,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { compactCurrency } from "@/lib/utils/reportPresentation";
import { getMonthLabel } from "@/lib/constants/report";
import { MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";
import { GrowVestActivityIndicator } from "@/components/investor/mobile/GrowVestMotionMark";
import { useInvestorPrivacy } from "@/contexts/InvestorPrivacyContext";
import { daysUntil, greetingForDate } from "@/lib/utils/investorExperience";
import { goalVisual } from "@/components/investor/goalVisuals";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";

const ICON_STROKE = 1.5;

function toDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
}

function fullCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function goalProgress(goal = {}) {
  const stored = Number(goal.progress);
  if (Number.isFinite(stored) && stored >= 0) return Math.min(100, stored);
  const current = Number(goal.currentAmount || goal.currentValue || 0);
  const target = Number(goal.targetAmount || 0);
  return target > 0 ? Math.min(100, current / target * 100) : 0;
}

function progressLabel(value) {
  const safe = Number(value || 0);
  if (safe > 0 && safe < 1) return "<1%";
  return `${Math.round(safe)}%`;
}

function initials(name) {
  return String(name || "GrowVest Advisor").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "GV";
}

function QuickAction({ href, icon: Icon, label, iconSize = 21 }) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col items-center justify-center px-1 py-2.5 text-center active:opacity-70">
      <span className="grid h-7 w-7 place-items-center text-[#1F4ED8]">
        <Icon size={iconSize} strokeWidth={ICON_STROKE} className="transition-transform group-active:scale-95" />
      </span>
      <span className="mt-1.5 block truncate text-[10.5px] font-bold text-[#0B0B0F]">{label}</span>
    </Link>
  );
}

function attentionActionsFor({ protectionSummary, nextSip, sipError, bucketListRequests = [], nextMeeting, portfolio, primaryGoal }) {
  const candidates = [];
  const due = protectionSummary?.nextDue;

  const sipStatus = String(nextSip?.fundingStatus || "").toLowerCase();
  const sipNeedsAction = ["needs_advisor", "service_request", "awaiting_funds"].includes(sipStatus);

  if (nextSip) {
    const suppliedSipDays = Number(nextSip.daysUntilDebit);
    const sipDays = Number.isFinite(suppliedSipDays) ? suppliedSipDays : daysUntil(nextSip.nextDebitDate);
    const overdue = sipDays !== null && sipDays < 0;
    const dueSoon = sipDays !== null && sipDays <= 7;
    const title = sipNeedsAction
      ? `SIP of ${compactCurrency(nextSip.sipAmount)} needs attention`
      : `SIP of ${compactCurrency(nextSip.sipAmount)} is ${sipDays === 1 ? "tomorrow" : sipDays === 0 ? "today" : overdue ? "overdue" : "coming up"}`;

    candidates.push({
      icon: CircleDollarSign,
      title,
      copy: `${nextSip.instrumentName || "Your SIP"} · debit ${dateLabel(nextSip.nextDebitDate)}`,
      href: "/investor/sip-reminders",
      tone: overdue || sipNeedsAction ? "red" : dueSoon ? "yellow" : "blue",
      priority: overdue || sipNeedsAction ? 122 : sipDays !== null && sipDays <= 3 ? 112 : dueSoon ? 104 : 48
    });
  } else if (sipError) {
    candidates.push({
      icon: CircleDollarSign,
      title: "SIP reminders could not be refreshed",
      copy: "Your portfolio is unaffected. Open SIP Reminders or try refreshing again.",
      href: "/investor/sip-reminders",
      tone: "yellow",
      priority: 74
    });
  }

  if (due) {
    const protectionDays = Number(due.daysUntil);
    if (Number.isFinite(protectionDays) && protectionDays <= 30) {
      candidates.push({
        icon: ShieldCheck,
        title: due.label || "Protection renewal",
        copy: protectionDays < 0 ? `${Math.abs(protectionDays)} days overdue` : `Due in ${protectionDays} days`,
        href: "/investor/insurance",
        tone: protectionDays < 0 || protectionDays <= 3 ? "red" : "yellow",
        priority: protectionDays < 0 ? 120 : protectionDays <= 7 ? 100 : 90
      });
    }
  }

  const reconciliation = String(portfolio?.reconciliationStatus || portfolio?.status || "").toLowerCase();
  if (reconciliation && !["verified", "reconciled", "complete", "completed"].some((item) => reconciliation.includes(item))) {
    candidates.push({
      icon: RefreshCw,
      title: "Portfolio update is under review",
      copy: "GrowVest is reconciling the latest source update. Your last verified values remain visible.",
      href: "/investor/portfolio",
      tone: "yellow",
      priority: 84
    });
  }

  const needsBucketInput = bucketListRequests.find((item) => String(item.status || "").toLowerCase() === "needs_information");
  if (needsBucketInput) {
    candidates.push({
      icon: Target,
      title: "Your Bucket List needs a little more input",
      copy: `GrowVest would like to discuss ${needsBucketInput.goalName || "your new goal"} with you.`,
      href: "/investor/goals",
      tone: "yellow",
      priority: 78
    });
  }

  if (primaryGoal && !primaryGoal.targetDate) {
    candidates.push({
      icon: Target,
      title: `${primaryGoal.name || primaryGoal.goalName || "Your Bucket List goal"} needs a target date`,
      copy: "Set the timeline so GrowVest can measure whether the current contribution is on track.",
      href: primaryGoal.id || primaryGoal.goalId ? `/investor/goals/${encodeURIComponent(primaryGoal.id || primaryGoal.goalId)}` : "/investor/goals",
      tone: "yellow",
      priority: 70
    });
  }

  if (nextMeeting) {
    const meetingDays = daysUntil(nextMeeting.startAt);
    candidates.push({
      icon: CalendarClock,
      title: nextMeeting.title || "Your next GrowVest review",
      copy: `${dateLabel(nextMeeting.startAt)} · ${nextMeeting.meetingProvider || "GrowVest review"}`,
      href: "/investor/meetings",
      tone: "blue",
      priority: meetingDays !== null && meetingDays <= 2 ? 68 : meetingDays !== null && meetingDays <= 7 ? 60 : 42
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

export default function MobileInvestorDashboard({
  profile,
  loading,
  error,
  portfolio,
  latestReport,
  primaryGoal,
  nextMeeting,
  nextSip,
  sipError = "",
  bucketListRequests = [],
  protectionSummary,
  advisor,
  refreshing = false,
  lastUpdatedAt = null,
  onRefresh
}) {
  const { privacyMode, togglePrivacyMode } = useInvestorPrivacy();
  const currentValue = Number(portfolio?.currentValue || 0);
  const movement = Number(portfolio?.movement || 0);
  const movementPositive = movement >= 0;
  const hasPortfolio = Boolean(portfolio?.hasPortfolio || currentValue > 0 || portfolio?.positionCount > 0);
  const firstName = String(profile?.fullName || "Investor").split(/\s+/)[0];
  const goalPct = primaryGoal ? goalProgress(primaryGoal) : 0;
  const goalCurrent = Number(primaryGoal?.currentAmount || primaryGoal?.currentValue || 0);
  const goalTarget = Number(primaryGoal?.targetAmount || 0);
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const allAttentionActions = attentionActionsFor({ protectionSummary, nextSip, sipError, bucketListRequests, nextMeeting, portfolio, primaryGoal });
  const attentionActions = attentionExpanded ? allAttentionActions.slice(0, 4) : allAttentionActions.slice(0, 1);
  const GoalIcon = primaryGoal ? goalVisual(primaryGoal.name || primaryGoal.goalName || "") : Target;
  const advisorName = advisor?.name || "GrowVest Advisor";
  const advisorEmail = advisor?.email || "cwp@growvest.info";
  const advisorPhone = advisor?.phone || "";

  return (
    <div className="gv-mobile-app-stack gv-mobile-home-stack md:hidden">
      {error ? <div className="mx-[14px] rounded-[16px] border border-[#E53935]/20 bg-[#E53935]/5 px-4 py-3 text-xs font-semibold leading-5 text-[#B42318]">{error}</div> : null}

      <section className="gv-mobile-home-hero relative overflow-hidden bg-[#1F4ED8] px-[18px] pb-[38px] pt-1 text-white">
        <div className="relative">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-white/[0.76]">{greetingForDate()},</p>
            <h1 className="mt-0.5 truncate font-heading text-[1.42rem] font-bold leading-none text-white">{firstName}</h1>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-medium text-white/[0.72]">Total Wealth</p>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <p className="gv-private-value min-w-0 font-heading text-[2rem] font-bold leading-none tracking-[-.03em] text-white" style={{ "--gv-private-mask-color": "#ffffff" }}>{loading ? "…" : hasPortfolio ? fullCurrency(currentValue) : "—"}</p>
              <button type="button" onClick={togglePrivacyMode} className="grid h-7 w-7 shrink-0 place-items-center text-white/[0.92] active:opacity-70" aria-label={privacyMode ? "Show financial values" : "Hide financial values"}>
                {privacyMode ? <EyeOff size={15} strokeWidth={ICON_STROKE} /> : <Eye size={15} strokeWidth={ICON_STROKE} />}
              </button>
            </div>
            {hasPortfolio ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px]">
                <span className={`inline-flex items-center gap-1 font-bold ${movementPositive ? "text-white" : "text-red-100"}`}>
                  {movementPositive ? <TrendingUp size={12} strokeWidth={ICON_STROKE} /> : <TrendingDown size={12} strokeWidth={ICON_STROKE} />}
                  <span className="gv-private-value">{movementPositive ? "+" : ""}{compactCurrency(movement)}</span>
                  {portfolio?.movementPercent !== null && portfolio?.movementPercent !== undefined && Number.isFinite(Number(portfolio.movementPercent)) ? <span className="gv-private-value">· {Number(portfolio.movementPercent) >= 0 ? "+" : ""}{Number(portfolio.movementPercent).toFixed(1)}%</span> : null}
                </span>
                <span className="text-white/[0.68]">{portfolio?.movementLabel || "since previous update"}</span>
              </div>
            ) : <p className="mt-2 text-[10.5px] text-white/[0.62]">Your verified Portfolio Master will appear here.</p>}
          </div>

          <div className="mt-2.5 flex min-h-6 items-center justify-between gap-3 text-[9.5px] text-white/[0.58]">
            <span>{lastUpdatedAt ? `Updated ${lastUpdatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Verified portfolio view"}</span>
            {onRefresh ? (
              <button type="button" onClick={onRefresh} disabled={refreshing} className="grid h-7 w-7 shrink-0 place-items-center text-white/[0.84] active:opacity-70 disabled:opacity-50" aria-label="Refresh dashboard">
                {refreshing ? <GrowVestActivityIndicator className="h-3.5 w-3.5" label="Refreshing your wealth view" /> : <RefreshCw size={13} strokeWidth={ICON_STROKE} />}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="gv-mobile-home-content relative z-10 bg-white pb-3">
        <section className="gv-mobile-home-quick-actions relative z-20 mx-[14px] overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-[0_8px_24px_rgba(11,11,15,.08)]">
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            <QuickAction href="/investor/portfolio" icon={ChartNoAxesCombined} label="Portfolio" iconSize={20} />
            <QuickAction href="/investor/goals" icon={Target} label="Bucket List" iconSize={19} />
            <QuickAction href="/investor/reports" icon={FileBarChart2} label="Reports" iconSize={20} />
            <QuickAction href="/investor/insurance" icon={ShieldCheck} label="Protection" iconSize={20} />
          </div>
        </section>

        <div className="space-y-4 px-[14px] pb-2 pt-4">
          {attentionActions.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-heading text-[15px] font-bold text-[#0B0B0F]">What needs your attention</h2>
                {allAttentionActions.length > 1 ? <button type="button" onClick={() => setAttentionExpanded((value) => !value)} className="text-[10px] font-bold text-[#1F4ED8]">{attentionExpanded ? "Show less" : "See all"}</button> : null}
              </div>
              <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                {attentionActions.map((action, index) => {
                  const ActionIcon = action.icon || FileBarChart2;
                  return (
                    <Link key={`${action.href}-${action.title}`} href={action.href} className={`flex min-h-[58px] items-center gap-2.5 px-3 py-2 active:bg-slate-50 ${index ? "border-t border-slate-100" : ""}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${action.tone === "red" ? "bg-[#FFF0EF] text-[#E53935]" : action.tone === "yellow" ? "bg-[#FFF8DF] text-[#A66B00]" : "bg-[#EAF0FF] text-[#1F4ED8]"}`}><ActionIcon size={16} strokeWidth={ICON_STROKE} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-bold leading-4 text-[#0B0B0F]">{action.title}</span><span className="mt-0.5 block line-clamp-1 text-[9.5px] leading-[0.875rem] text-[#6B7280]">{action.copy}</span></span>
                      <ChevronRight size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-300" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {primaryGoal ? (
            <section>
              <div className="mb-2 flex items-center justify-between"><h2 className="font-heading text-[15px] font-bold text-[#0B0B0F]">Your Bucket List</h2><Link href="/investor/goals" className="text-[10px] font-bold text-[#1F4ED8]">See all</Link></div>
              <Link href={primaryGoal?.id || primaryGoal?.goalId ? `/investor/goals/${encodeURIComponent(primaryGoal.id || primaryGoal.goalId)}` : "/investor/goals"} className="block rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 active:bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#EAF0FF] text-[#1F4ED8]"><GoalIcon size={16} strokeWidth={ICON_STROKE} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3"><h3 className="truncate font-heading text-[12px] font-bold text-[#0B0B0F]">{primaryGoal.name || primaryGoal.goalName || "Primary goal"}</h3><span className="shrink-0 text-[10px] font-bold text-[#0B0B0F]">{progressLabel(goalPct)}</span></div>
                    <p className="gv-private-value mt-0.5 text-[9.5px] text-[#6B7280]">{compactCurrency(goalCurrent)} of {compactCurrency(goalTarget)}</p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#F4F6F9]"><div className="h-full rounded-full bg-[#1F4ED8]" style={{ width: `${Math.min(100, goalPct)}%`, minWidth: goalPct > 0 ? "2px" : 0 }} /></div>
                  </div>
                  <ChevronRight size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-300" />
                </div>
              </Link>
            </section>
          ) : null}

          {latestReport ? (
            <section className="relative overflow-hidden rounded-[14px] bg-[#0B0B0F] px-3 py-3 text-white">
              <div className="relative pr-12">
                <h2 className="font-heading text-[13px] font-bold leading-4 text-white">Your {getMonthLabel(latestReport.reportMonth)} Review is ready</h2>
                <p className="mt-1 text-[9.5px] leading-[0.875rem] text-white/65">See how your wealth has moved.</p>
                <Link href={`/investor/reports/${latestReport.id}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#7FA2FF]">View Review <ArrowRight size={11} strokeWidth={ICON_STROKE} /></Link>
              </div>
              <BarChart3 size={30} strokeWidth={1.35} className="absolute bottom-3 right-3 text-white/75" aria-hidden="true" />
            </section>
          ) : (
            <section className="relative overflow-hidden rounded-[14px] bg-[#0B0B0F] px-3 py-3 text-white">
              <div className="relative pr-12">
                <h2 className="font-heading text-[13px] font-bold leading-4 text-white">Your Monthly Review</h2>
                <p className="mt-1 text-[9.5px] leading-[0.875rem] text-white/65">Your latest review will appear here once GrowVest publishes it.</p>
                <Link href="/investor/reports" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#7FA2FF]">View Reports <ArrowRight size={11} strokeWidth={ICON_STROKE} /></Link>
              </div>
              <BarChart3 size={30} strokeWidth={1.35} className="absolute bottom-3 right-3 text-white/75" aria-hidden="true" />
            </section>
          )}

          {profile?.demo ? <DemoInvestorCta compact /> : null}

          <section className="border-t border-slate-200 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1F4ED8] font-heading text-[10px] font-bold text-white">{initials(advisorName)}</span>
              <div className="min-w-0 flex-1"><p className="text-[9.5px] text-[#6B7280]">Your GrowVest Partner</p><h2 className="truncate font-heading text-[12px] font-bold text-[#0B0B0F]">{advisorName}</h2><p className="truncate text-[9.5px] text-[#6B7280]">{advisor?.designation || "Relationship Manager"}</p></div>
              <a href={advisorPhone ? `tel:${advisorPhone}` : `mailto:${advisorEmail}`} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-[#1F4ED8] active:bg-[#EAF0FF]" aria-label="Contact your GrowVest Partner"><MessageCircleMore size={15} strokeWidth={ICON_STROKE} /></a>
            </div>
          </section>

          {!hasPortfolio && !loading ? <MobileEmptyState icon={WalletCards} title="We’re preparing your portfolio view" copy="Once GrowVest verifies your first portfolio update, your wealth value and holdings will appear automatically." /> : null}
        </div>
      </div>
    </div>
  );
}
