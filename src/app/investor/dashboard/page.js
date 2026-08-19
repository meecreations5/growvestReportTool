"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CircleDollarSign,
  CheckCircle2,
  ChevronRight,
  FileBarChart2,
  Files,
  Mail,
  MessageCircleMore,
  Phone,
  Smartphone,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { getMonthLabel } from "@/lib/constants/report";
import { getPublishedInvestorReportsOnce } from "@/services/reportService";
import { compactCurrency } from "@/lib/utils/reportPresentation";
import InvestorGoalCard from "@/components/investor/InvestorGoalCard";
import { useInvestorNotifications } from "@/contexts/InvestorNotificationContext";
import { getSipFundingOverview } from "@/services/sipFundingService";
import { sipFundingStatusLabel } from "@/lib/constants/sipFunding";

function toDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function displayTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
}

function goalProgress(goal) {
  const stored = Number(goal?.progress);
  if (Number.isFinite(stored) && stored >= 0) return Math.min(100, stored);
  const current = Number(goal?.currentAmount || goal?.currentValue || 0);
  const target = Number(goal?.targetAmount || 0);
  return target > 0 ? Math.min(100, (current / target) * 100) : 0;
}

export default function InvestorDashboardPage() {
  const { profile } = useAuth();
  const notifications = useInvestorNotifications();
  const [investor, setInvestor] = useState(null);
  const [reports, setReports] = useState([]);
  const [nextMeeting, setNextMeeting] = useState(null);
  const [latestMom, setLatestMom] = useState(null);
  const [sipFunding, setSipFunding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      if (!profile?.investorId || !profile?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const now = Timestamp.now();
        const [investorSnapshot, reportItems, meetingSnapshot, momSnapshot, sipPayload] = await Promise.all([
          getDoc(doc(db, "investors", profile.investorId)),
          getPublishedInvestorReportsOnce(profile.investorId, 2),
          getDocs(query(collection(db, "meetings"), where("investorId", "==", profile.investorId), where("investorVisible", "==", true), where("startAt", ">=", now), orderBy("startAt", "asc"), limit(1))),
          getDocs(query(collection(db, "meetingMinutes"), where("investorId", "==", profile.investorId), where("investorVisible", "==", true), orderBy("meetingDate", "desc"), limit(1))),
          getSipFundingOverview(profile.investorId)
        ]);
        setInvestor(investorSnapshot.exists() ? { id: investorSnapshot.id, ...investorSnapshot.data() } : null);
        setReports(reportItems || []);
        setNextMeeting(meetingSnapshot.docs[0] ? { id: meetingSnapshot.docs[0].id, ...meetingSnapshot.docs[0].data() } : null);
        setLatestMom(momSnapshot.docs[0] ? { id: momSnapshot.docs[0].id, ...momSnapshot.docs[0].data() } : null);
        setSipFunding(sipPayload?.items || []);
      } catch (nextError) {
        console.error(nextError);
        setError("Some dashboard information could not be loaded. Pull down or refresh after a moment.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [profile?.id, profile?.investorId]);

  const unreadCount = notifications?.unreadCount || 0;
  const goals = useMemo(() => investor?.bucketList?.length ? investor.bucketList : investor?.goals || [], [investor]);
  const activeGoals = goals.filter((item) => !["Completed", "Paused"].includes(item.status));
  const primaryGoal = goals.find((item) => item.isPrimary) || activeGoals[0] || goals[0] || null;
  const latestReport = reports[0] || null;
  const previousReport = reports[1] || null;
  const latestValue = Number(latestReport?.summary?.totalCorpus || 0);
  const previousValue = Number(previousReport?.summary?.totalCorpus || 0);
  const monthlyMovement = previousValue ? latestValue - previousValue : Number(latestReport?.summary?.investmentGain || 0);
  const movementPositive = monthlyMovement >= 0;
  const overallProgress = latestReport?.summary?.overallProgress ?? (primaryGoal ? goalProgress(primaryGoal) : 0);
  const advisorName = investor?.advisorName || investor?.assignedAdvisorName || "GrowVest Advisor";
  const advisorEmail = investor?.advisorEmail || investor?.assignedAdvisorEmail || "cwp@growvest.info";
  const advisorPhone = investor?.advisorPhone || investor?.assignedAdvisorPhone || "";
  const advisorWhatsApp = advisorPhone ? `https://wa.me/${String(advisorPhone).replace(/\D/g, "")}` : "";
  const nextSip = sipFunding[0] || null;

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-5 overflow-x-clip sm:gap-6">
      <section className="relative min-w-0 max-w-full overflow-hidden rounded-[28px] bg-[var(--gv-ink)] p-5 text-white shadow-[var(--gv-shadow-card)] sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-cyan-400/10" />
        <div className="relative">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Your wealth journey</p>
              <h1 className="mt-2 font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">Hello, {profile?.fullName?.split(" ")[0] || "Investor"}</h1>
              <p className="mt-2 max-w-full break-words text-sm leading-6 text-slate-300">A clear view of your portfolio, Bucket List and next review.</p>
            </div>
            {unreadCount > 0 ? <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-200">{unreadCount} new</span> : null}
          </div>

          <div className="mt-7">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Latest portfolio value</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="font-heading text-4xl font-bold text-white sm:text-5xl">{loading ? "…" : latestReport ? compactCurrency(latestValue) : "—"}</p>
              {latestReport ? (
                <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${movementPositive ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
                  {movementPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {movementPositive ? "+" : ""}{compactCurrency(monthlyMovement)} this month
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-400">{latestReport ? `${getMonthLabel(latestReport.reportMonth)} ${latestReport.reportYear} · Published version ${latestReport.publishedVersion || 1}` : "Your first published monthly report will appear here."}</p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-slate-300"><span>Overall Bucket List progress</span><strong className="text-white">{Number(overallProgress || 0).toFixed(1)}%</strong></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[var(--gv-cyan)]" style={{ width: `${Math.min(100, Number(overallProgress || 0))}%` }} /></div>
          </div>

          <div className="mt-6 grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
            <Link href={latestReport ? `/investor/reports/${latestReport.id}` : "/investor/reports"} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-bold text-[var(--gv-ink)]"><FileBarChart2 size={16} /> Report</Link>
            <Link href="/investor/goals" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 text-xs font-bold text-white"><Target size={16} /> Goals</Link>
            <Link href="/investor/meetings" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 text-xs font-bold text-white"><CalendarClock size={16} /> Review</Link>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error}</div> : null}

      {!notifications?.pushEnabled && notifications?.pushSupported && notifications?.pushConfigured ? (
        <Link href="/investor/notifications" className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm sm:hidden">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gv-blue)] text-white"><Smartphone size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[var(--gv-ink)]">Never miss an important update</span><span className="mt-1 block text-xs leading-5 text-slate-600">Enable push alerts for reports, reviews and documents.</span></span>
          <ChevronRight size={18} className="shrink-0 text-[var(--gv-blue)]" />
        </Link>
      ) : null}

      <section className="min-w-0 max-w-full overflow-hidden sm:hidden">
        <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">Quick access</p><span className="text-[10px] font-semibold text-slate-400">Swipe for more</span></div>
        <div className="gv-scrollbar flex w-full min-w-0 max-w-full snap-x gap-2.5 overflow-x-auto overscroll-x-contain pb-1 pr-3.5">
          {[
            ["Latest report", latestReport ? `/investor/reports/${latestReport.id}` : "/investor/reports", FileBarChart2, "View"],
            ["Bucket List", "/investor/goals", Target, `${activeGoals.length} active`],
            ["Documents", "/investor/documents", Files, "Secure files"],
            ["SIP reminders", "/investor/sip-reminders", CircleDollarSign, nextSip ? `${nextSip.daysUntilDebit}d to debit` : "Funding checks"],
            ["Notifications", "/investor/notifications", BellRing, unreadCount ? `${unreadCount} new` : "All caught up"]
          ].map(([label, href, Icon, hint]) => (
            <Link key={label} href={href} className="w-[142px] min-w-[142px] max-w-[142px] snap-start rounded-2xl border border-[var(--gv-border)] bg-white p-3.5 shadow-[var(--gv-shadow-card)]">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[var(--gv-blue)]"><Icon size={18} /></span>
              <span className="mt-3 block text-sm font-bold text-[var(--gv-ink)]">{label}</span>
              <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>
            </Link>
          ))}
        </div>
      </section>

      {nextSip ? <Link href="/investor/sip-reminders" className="flex min-w-0 items-center gap-4 rounded-[var(--gv-radius-lg)] border border-blue-200 bg-blue-50 p-4 shadow-[var(--gv-shadow-card)] sm:p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gv-blue)] text-white"><CircleDollarSign size={20} /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">Upcoming SIP funding</span><span className="mt-1 block truncate text-sm font-bold text-slate-950">{nextSip.instrumentName} · {compactCurrency(nextSip.sipAmount)}</span><span className="mt-1 block text-xs text-slate-600">Debit {displayDate(nextSip.nextDebitDate)} · {sipFundingStatusLabel(nextSip.fundingStatus)}</span></span><ChevronRight className="shrink-0 text-blue-700" size={18} /></Link> : null}

      <section className="grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        {[
          ["Monthly SIP", latestReport?.summary?.monthlySip, "Active contribution"],
          ["New money", latestReport?.summary?.newMoneyAdded, "Added this month"],
          ["Investment gain", latestReport?.summary?.investmentGain, "Monthly movement"],
          ["Active goals", activeGoals.length, primaryGoal ? `Primary: ${primaryGoal.name || primaryGoal.goalName}` : "No active goal"]
        ].map(([label, value, hint]) => (
          <article key={label} className="min-w-0 rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-4 shadow-[var(--gv-shadow-card)] sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">{label}</p>
            <p className="mt-2 font-heading text-xl font-bold text-[var(--gv-ink)] sm:text-2xl">{loading ? "…" : typeof value === "number" && label !== "Active goals" ? compactCurrency(value) : value ?? "—"}</p>
            <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{hint}</p>
          </article>
        ))}
      </section>

      {primaryGoal ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div><p className="gv-eyebrow">Priority goal</p><h2 className="mt-1 font-heading text-2xl font-bold text-[var(--gv-ink)]">Your primary Bucket List goal</h2></div>
            <Link href="/investor/goals" className="hidden items-center gap-1 text-xs font-bold text-[var(--gv-blue)] sm:inline-flex">View all <ChevronRight size={15} /></Link>
          </div>
          <InvestorGoalCard goal={primaryGoal} />
          <Link href="/investor/goals" className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-sm font-bold text-[var(--gv-blue)] sm:hidden">View all goals</Link>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="gv-eyebrow">Upcoming review</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-[var(--gv-ink)]">{nextMeeting?.title || "Next portfolio review"}</h2>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><CalendarClock size={21} /></span>
          </div>
          <div className="mt-5 rounded-2xl bg-[var(--gv-surface)] p-4">
            <p className="font-heading text-xl font-bold text-[var(--gv-ink)]">{nextMeeting ? displayDate(nextMeeting.startAt) : latestReport?.nextReview?.date || "Not scheduled"}</p>
            <p className="mt-1 text-sm text-slate-500">{nextMeeting ? `${displayTime(nextMeeting.startAt)} · ${nextMeeting.meetingProvider || "Review meeting"}` : "Your Advisor will confirm the review date."}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {nextMeeting?.meetingLink ? <a href={nextMeeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white">Join meeting</a> : null}
            <Link href="/investor/meetings" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">Meeting details <ArrowRight size={15} /></Link>
          </div>
        </article>

        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gv-blue)] font-heading text-sm font-bold text-white">{advisorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
            <div><p className="text-xs font-semibold text-slate-400">Your GrowVest Advisor</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">{advisorName}</h2><p className="text-xs text-slate-500">{investor?.advisorDesignation || investor?.assignedAdvisorDesignation || "Relationship Manager"}</p></div>
          </div>
          <div className={`mt-5 grid gap-2 ${advisorWhatsApp ? "grid-cols-3" : "grid-cols-2"}`}>
            <a href={`mailto:${advisorEmail}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 sm:text-sm"><Mail size={16} /> Email</a>
            <a href={advisorPhone ? `tel:${advisorPhone}` : `mailto:${advisorEmail}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 sm:text-sm"><Phone size={16} /> Call</a>
            {advisorWhatsApp ? <a href={advisorWhatsApp} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 sm:text-sm"><MessageCircleMore size={16} /> WhatsApp</a> : null}
          </div>
          <Link href="/investor/profile" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--gv-blue)]">View Advisor and profile details <ChevronRight size={15} /></Link>
        </article>
      </section>

      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={20} /></span><div><p className="gv-eyebrow">Latest review summary</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">{latestMom?.meetingTitle || "Meeting summary"}</h2></div></div>
        {latestMom ? <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{latestMom.clientSummary || "Your client-visible review summary is available."}</p> : <p className="mt-4 text-sm leading-6 text-slate-500">Client-shareable meeting summaries and agreed next steps will appear here after your review.</p>}
        <Link href="/investor/meetings" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600"><MessageCircleMore size={16} /> View reviews and MOM</Link>
      </section>
    </div>
  );
}
