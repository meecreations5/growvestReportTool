"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, ChevronRight, Eye, EyeOff, FileText, Files, IdCard, KeyRound, Mail, MapPin, Phone, ShieldCheck, Target, UserRound, WalletCards } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import InvestorGoalCard from "@/components/investor/InvestorGoalCard";
import ProfilePhotoUploader from "@/components/profile/ProfilePhotoUploader";
import OfflineAccessCard from "@/components/pwa/OfflineAccessCard";
import { getInvestorAppData } from "@/services/investorAppService";
import { useInvestorPrivacy } from "@/contexts/InvestorPrivacyContext";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";

function initials(name) {
  return String(name || "Investor").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "I";
}

function Detail({ label, value }) {
  return (
    <div className="rounded-2xl bg-[var(--gv-surface)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1.5 break-words text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}


function portfolioStatusLabel(value, issueCount = 0) {
  const status = String(value || "").toLowerCase();
  if (status === "verified") return "Verified";
  if (["needs_review", "stale", "missing_source", "mismatch", "ownership_conflict"].includes(status)) return issueCount > 0 ? `Under review · ${issueCount} item${issueCount === 1 ? "" : "s"}` : "Under review";
  return status ? status.replaceAll("_", " ") : "Not updated yet";
}

function MobileProfileApp({ profile, investor, fullName, advisorName, advisorEmail, advisorPhone, isDemoInvestor = false }) {
  const { privacyMode, togglePrivacyMode } = useInvestorPrivacy();
  const risk = investor?.riskAssessment?.finalProfile || investor?.riskProfile || "Risk profile pending";
  const advisorPhoto = investor?.advisorPhotoURL || investor?.assignedAdvisorPhotoURL || investor?.advisorPhotoUrl || investor?.assignedAdvisorPhotoUrl || "";
  const investorSince = formatDate(investor?.investorSince);
  const rows = [
    ["Notifications", "Alerts and communication preferences", "/investor/notifications", BellRing],
    ["Login & Security", "Password and sign-in methods", "/investor/change-password", KeyRound]
  ];
  const personalRows = [
    ["Email", investor?.email || profile?.email || "—", Mail],
    ["Mobile", investor?.contactNo || profile?.mobile || "—", Phone],
    ["City", investor?.city || "—", MapPin],
    ["Date of birth", investor?.personalProfile?.dateOfBirth ? formatDate(investor.personalProfile.dateOfBirth) : "Not added", CalendarDays],
    ["Client code", investor?.clientCode || profile?.clientCode || "—", IdCard],
    ["PAN", investor?.panMasked || "Not added", IdCard],
    ["Aadhaar", investor?.aadhaarConfigured ? `XXXX XXXX ${investor?.aadhaarLast4 || "••••"}` : "Not added", ShieldCheck]
  ];
  const activeGoals = (investor?.bucketList?.length ? investor.bucketList : investor?.goals || []).filter((goal) => String(goal.status || "").toLowerCase() !== "completed").length;
  const wealthRows = [
    ["Risk profile", risk, ShieldCheck],
    ["Active Bucket List", `${activeGoals} goal${activeGoals === 1 ? "" : "s"}`, Target],
    ["Latest portfolio", investor?.latestPortfolioSnapshotDate ? formatDate(investor.latestPortfolioSnapshotDate) : "Not updated yet", WalletCards],
    ["Portfolio status", portfolioStatusLabel(investor?.latestPortfolioReconciliationStatus, investor?.latestPortfolioIssueCount), ShieldCheck],
    ["Monthly SIP plan", Number(investor?.latestPortfolioMonthlySip || 0) > 0 ? formatCurrency(investor.latestPortfolioMonthlySip) : "Not recorded", CalendarDays]
  ];

  return (
    <div className="gv-mobile-app-stack md:hidden">
      <section className="pt-1 text-center">
        <div className="relative mx-auto w-fit">
          {profile?.photoURL ? <img src={profile.photoURL} alt={fullName} className="h-[72px] w-[72px] rounded-full border border-slate-200 object-cover" /> : <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[#1F4ED8] font-heading text-lg font-bold text-white">{initials(fullName)}</span>}
          <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-[#1F4ED8] text-white"><ShieldCheck size={12} strokeWidth={1.5} /></span>
        </div>
        <h1 className="mt-3 font-heading text-[1.35rem] font-bold text-[#0B0B0F]">{fullName}</h1>
        <p className="mt-1 text-[11px] text-[#6B7280]">Investor{investorSince && investorSince !== "—" ? ` since ${investorSince}` : ""}</p>
        {!isDemoInvestor ? <div className="mt-3 flex justify-center"><ProfilePhotoUploader minimal /></div> : <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#1F4ED8]">Demo Experience</p>}
      </section>

      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
        {rows.map(([title, description, href, Icon], index) => (
          <Link key={href} href={href} className={`flex min-h-[62px] items-center gap-3 px-4 py-3 active:bg-[#F4F6F9] ${index ? "border-t border-slate-100" : ""}`}>
            <Icon size={19} strokeWidth={1.5} className="shrink-0 text-[#1F4ED8]" />
            <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#0B0B0F]">{title}</span><span className="mt-0.5 block text-[10px] text-[#6B7280]">{description}</span></span>
            <ChevronRight size={16} strokeWidth={1.5} className="text-slate-300" />
          </Link>
        ))}
        <button type="button" onClick={togglePrivacyMode} className="flex min-h-[62px] w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left active:bg-[#F4F6F9]">
          {privacyMode ? <EyeOff size={19} strokeWidth={1.5} className="shrink-0 text-[#1F4ED8]" /> : <Eye size={19} strokeWidth={1.5} className="shrink-0 text-[#1F4ED8]" />}
          <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#0B0B0F]">Financial Privacy</span><span className="mt-0.5 block text-[10px] text-[#6B7280]">{privacyMode ? "Financial values are hidden" : "Hide financial values across the app"}</span></span>
          <span className={`h-5 w-9 rounded-full p-0.5 transition ${privacyMode ? "bg-[#1F4ED8]" : "bg-slate-200"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${privacyMode ? "translate-x-4" : ""}`} /></span>
        </button>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[1.05rem] font-bold text-[#0B0B0F]">Personal Details</h2>
        <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          {personalRows.map(([label, value, Icon], index) => (
            <div key={label} className={`flex min-h-[58px] items-center gap-3 px-4 py-3 ${index ? "border-t border-slate-100" : ""}`}>
              <Icon size={18} strokeWidth={1.5} className="shrink-0 text-[#6B7280]" />
              <span className="min-w-0 flex-1"><span className="block text-[10px] text-[#6B7280]">{label}</span><span className="mt-0.5 block break-words text-[11px] font-semibold text-[#0B0B0F]">{value || "—"}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[1.05rem] font-bold text-[#0B0B0F]">Your Wealth Profile</h2>
        <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          {wealthRows.map(([label, value, Icon], index) => (
            <div key={label} className={`flex min-h-[58px] items-center gap-3 px-4 py-3 ${index ? "border-t border-slate-100" : ""}`}>
              <Icon size={18} strokeWidth={1.5} className="shrink-0 text-[#1F4ED8]" />
              <span className="min-w-0 flex-1"><span className="block text-[10px] text-[#6B7280]">{label}</span><span className="gv-private-value mt-0.5 block break-words text-[11px] font-semibold capitalize text-[#0B0B0F]">{value || "—"}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[1.05rem] font-bold text-[#0B0B0F]">Your GrowVest Partner</h2>
        <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-4">
          {advisorPhoto ? <img src={advisorPhoto} alt={advisorName} className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1F4ED8] font-heading text-xs font-bold text-white">{initials(advisorName)}</span>}
          <div className="min-w-0 flex-1"><h3 className="truncate font-heading text-[14px] font-bold text-[#0B0B0F]">{advisorName}</h3><p className="mt-0.5 text-[10px] text-[#6B7280]">{investor?.advisorDesignation || investor?.assignedAdvisorDesignation || "Relationship Manager"}</p></div>
          <a href={advisorPhone ? `tel:${advisorPhone}` : `mailto:${advisorEmail}`} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-[#1F4ED8]" aria-label="Contact your GrowVest Partner"><Phone size={17} strokeWidth={1.5} /></a>
        </div>
      </section>

    </div>
  );
}

export default function InvestorProfilePage() {
  const { profile, isDemoInvestor } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadInvestor() {
      if (!profile?.investorId) { setLoading(false); return; }
      setLoading(true);
      setError("");
      try {
        const payload = await getInvestorAppData("profile");
        if (active) setInvestor(payload.investor ? { ...payload.investor, bucketList: payload.goals || payload.investor.bucketList || [] } : null);
      } catch (loadError) {
        console.error("Investor profile load failed", loadError);
        if (active) setError(loadError?.message || "Unable to load your Investor profile.");
      } finally { if (active) setLoading(false); }
    }
    loadInvestor();
    return () => { active = false; };
  }, [profile?.investorId]);

  const goals = useMemo(() => investor?.bucketList?.length ? investor.bucketList : investor?.goals || [], [investor]);
  const primaryGoal = goals.find((item) => item.isPrimary) || goals[0] || null;
  const fullName = investor?.fullName || profile?.fullName || "Investor";
  const advisorName = investor?.advisorName || investor?.assignedAdvisorName || "GrowVest Partner";
  const advisorEmail = investor?.advisorEmail || investor?.assignedAdvisorEmail || "cwp@growvest.info";
  const advisorPhone = investor?.advisorPhone || investor?.assignedAdvisorPhone || "";

  if (loading) return <div className="grid gap-4"><div className="gv-skeleton h-52 rounded-3xl" /><div className="gv-skeleton h-80 rounded-3xl" /></div>;

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Investor profile" title="My profile" description="Your identity, Advisor relationship and secure portal settings in one place." />
      {error ? <div className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 md:hidden">{error}</div> : null}
      <MobileProfileApp profile={profile} investor={investor} fullName={fullName} advisorName={advisorName} advisorEmail={advisorEmail} advisorPhone={advisorPhone} isDemoInvestor={isDemoInvestor} />

      <div className="hidden gap-5 md:grid md:gap-6">
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="relative overflow-hidden rounded-[28px] bg-[var(--gv-ink)] p-5 text-white shadow-[var(--gv-shadow-card)] sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-cyan-400/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {profile?.photoURL ? <img src={profile.photoURL} alt={fullName} className="h-16 w-16 shrink-0 rounded-full border-2 border-white/20 object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--gv-blue)] font-heading text-xl font-bold text-white">{initials(fullName)}</span>}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-300">Active Investor</p>
              <h1 className="mt-1 font-heading text-3xl font-bold text-white">{fullName}</h1>
              <p className="mt-1 text-sm text-slate-400">{investor?.clientCode || profile?.clientCode || "GrowVest client"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{investor?.riskAssessment?.finalProfile || investor?.riskProfile || "Risk profile pending"}</span>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-300">Portal active</span>
          </div>
        </div>
      </section>

      {isDemoInvestor ? <DemoInvestorCta /> : <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6"><ProfilePhotoUploader /></section>}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700"><UserRound size={19} /></span><div><p className="gv-eyebrow">Personal details</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">Profile information</h2></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Email" value={investor?.email || profile?.email} />
            <Detail label="Registered mobile" value={investor?.contactNo || profile?.mobile} />
            <Detail label="City" value={investor?.city} />
            <Detail label="Date of birth" value={investor?.personalProfile?.dateOfBirth ? formatDate(investor.personalProfile.dateOfBirth) : "Not added"} />
            <Detail label="Investor since" value={formatDate(investor?.investorSince)} />
            <Detail label="Client code" value={investor?.clientCode || profile?.clientCode} />
            <Detail label="PAN" value={investor?.panMasked || "Not added"} />
            <Detail label="Aadhaar" value={investor?.aadhaarConfigured ? `XXXX XXXX ${investor?.aadhaarLast4 || "••••"}` : "Not added"} />
            <Detail label="Risk profile" value={investor?.riskAssessment?.finalProfile || investor?.riskProfile} />
            <Detail label="Latest portfolio" value={investor?.latestPortfolioSnapshotDate ? formatDate(investor.latestPortfolioSnapshotDate) : "Not updated yet"} />
            <Detail label="Portfolio status" value={portfolioStatusLabel(investor?.latestPortfolioReconciliationStatus, investor?.latestPortfolioIssueCount)} />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Profile changes are reviewed and maintained by your GrowVest Partner.</p>
        </article>

        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gv-blue)] font-heading text-sm font-bold text-white">{initials(advisorName)}</span><div><p className="text-xs font-semibold text-slate-400">Your GrowVest Partner</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">{advisorName}</h2><p className="text-xs text-slate-500">{investor?.advisorDesignation || investor?.assignedAdvisorDesignation || "Relationship Manager"}</p></div></div>
          <p className="mt-5 text-sm leading-6 text-slate-600">Your dedicated relationship contact for reviews, questions and agreed next steps.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <a href={`mailto:${advisorEmail}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"><Mail size={16} /> Email</a>
            <a href={advisorPhone ? `tel:${advisorPhone}` : `mailto:${advisorEmail}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"><Phone size={16} /> Call</a>
          </div>
        </article>
      </section>

      {primaryGoal ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4"><div><p className="gv-eyebrow">Bucket List</p><h2 className="mt-1 font-heading text-2xl font-bold text-[var(--gv-ink)]">Primary financial goal</h2></div><Link href="/investor/goals" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--gv-blue)]">All goals <ChevronRight size={15} /></Link></div>
          <InvestorGoalCard goal={primaryGoal} compact />
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Login & security", "Manage linked login methods and your password.", "/investor/change-password", KeyRound],
          ["Documents", "Upload and review documents requested by GrowVest.", "/investor/documents", Files],
          ["Monthly reports", "Open your published reports and secure PDFs.", "/investor/reports", FileText]
        ].map(([title, description, href, Icon]) => (
          <Link key={href} href={href} className="group rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon size={20} /></span><ChevronRight size={18} className="text-slate-300 transition group-hover:text-[var(--gv-blue)]" /></div>
            <h2 className="mt-4 font-heading text-lg font-bold text-[var(--gv-ink)]">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </Link>
        ))}
      </section>

      <OfflineAccessCard investor />

      <section className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="mt-0.5 shrink-0" size={18} /><p>Your Investor Portal displays only information marked as client-visible and approved by GrowVest.</p></section>
      </div>
    </div>
  );
}
