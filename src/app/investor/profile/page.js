"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ChevronRight, FileText, Files, KeyRound, Mail, Phone, ShieldCheck, Target, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { formatDate } from "@/lib/utils/format";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import InvestorGoalCard from "@/components/investor/InvestorGoalCard";
import ProfilePhotoUploader from "@/components/profile/ProfilePhotoUploader";
import OfflineAccessCard from "@/components/pwa/OfflineAccessCard";

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

export default function InvestorProfilePage() {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvestor() {
      if (!profile?.investorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const snapshot = await getDoc(doc(db, "investors", profile.investorId));
        setInvestor(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load your Investor profile.");
      } finally {
        setLoading(false);
      }
    }
    loadInvestor();
  }, [profile?.investorId]);

  const goals = useMemo(() => investor?.bucketList?.length ? investor.bucketList : investor?.goals || [], [investor]);
  const primaryGoal = goals.find((item) => item.isPrimary) || goals[0] || null;
  const fullName = investor?.fullName || profile?.fullName || "Investor";
  const advisorName = investor?.advisorName || investor?.assignedAdvisorName || "GrowVest Advisor";
  const advisorEmail = investor?.advisorEmail || investor?.assignedAdvisorEmail || "cwp@growvest.info";
  const advisorPhone = investor?.advisorPhone || investor?.assignedAdvisorPhone || "";

  if (loading) return <div className="grid gap-4"><div className="gv-skeleton h-52 rounded-3xl" /><div className="gv-skeleton h-80 rounded-3xl" /></div>;

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Investor profile" title="My profile" description="Your identity, Advisor relationship and secure portal settings in one place." />

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

      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
        <ProfilePhotoUploader />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700"><UserRound size={19} /></span><div><p className="gv-eyebrow">Personal details</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">Profile information</h2></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Email" value={investor?.email || profile?.email} />
            <Detail label="Registered mobile" value={investor?.contactNo || profile?.mobile} />
            <Detail label="City" value={investor?.city} />
            <Detail label="Investor since" value={formatDate(investor?.investorSince)} />
            <Detail label="Client code" value={investor?.clientCode || profile?.clientCode} />
            <Detail label="Risk profile" value={investor?.riskAssessment?.finalProfile || investor?.riskProfile} />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Profile changes are reviewed and maintained by your GrowVest Advisor.</p>
        </article>

        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gv-blue)] font-heading text-sm font-bold text-white">{initials(advisorName)}</span><div><p className="text-xs font-semibold text-slate-400">Your GrowVest Advisor</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">{advisorName}</h2><p className="text-xs text-slate-500">{investor?.advisorDesignation || investor?.assignedAdvisorDesignation || "Relationship Manager"}</p></div></div>
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
  );
}
