"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { subscribeLead } from "@/services/leadService";
import { subscribeAssessment } from "@/services/assessmentService";
import {
  calculateInvestmentPreferenceTotals,
  calculateTotalGoalTarget,
  getInvestmentPreferenceRows,
  getPrimaryGoal
} from "@/lib/constants/assessment";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import Button from "@/components/ui/Button";
import BrandLogo from "@/components/branding/BrandLogo";
import { useBranding } from "@/contexts/BrandingContext";

export default function AssessmentSummaryClient({ leadId }) {
  const { branding } = useBranding();
  const [lead, setLead] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [loaded, setLoaded] = useState({ lead: false, assessment: false });
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeLead = subscribeLead(leadId, (item) => {
      setLead(item);
      setLoaded((current) => ({ ...current, lead: true }));
    }, () => {
      setError("Unable to load the lead.");
      setLoaded((current) => ({ ...current, lead: true }));
    });
    const unsubscribeAssessment = subscribeAssessment(leadId, (item) => {
      setAssessment(item);
      setLoaded((current) => ({ ...current, assessment: true }));
    }, () => {
      setError("Unable to load the assessment.");
      setLoaded((current) => ({ ...current, assessment: true }));
    });
    return () => {
      unsubscribeLead?.();
      unsubscribeAssessment?.();
    };
  }, [leadId]);

  const bucketList = assessment?.bucketList || [];
  const primaryGoal = useMemo(() => getPrimaryGoal(bucketList), [bucketList]);
  const investmentPreferences = getInvestmentPreferenceRows(assessment?.investmentPreferences);
  const preferenceTotals = calculateInvestmentPreferenceTotals(investmentPreferences);

  if (!loaded.lead || !loaded.assessment) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading proposal summary…</div>;
  if (error || !lead || !assessment) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{error || "Assessment summary is unavailable."}</div>;

  return (
    <div className="assessment-summary-page mx-auto max-w-5xl">
      <div className="print-hide mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/leads/${leadId}/assessment`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft size={16} /> Back to assessment</Link>
        <Button type="button" onClick={() => window.print()}><Printer size={17} /> Print / Save PDF</Button>
      </div>

      <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none sm:p-10">
        {branding.watermarkUrl ? <img src={branding.watermarkUrl} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 max-h-[620px] max-w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.035] print:opacity-[0.045]" /> : null}
        <div className="relative z-10">
        <header className="border-b-4 pb-6" style={{ borderColor: branding.primaryColor || "#1F4ED8" }}>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <BrandLogo variant="wide" showTagline className="mb-4" />
              <p className="text-sm font-black uppercase tracking-[0.24em]" style={{ color: branding.primaryColor || "#1F4ED8" }}>{branding.legalName || branding.companyName}</p>
              <h1 className="mt-3 text-3xl font-black text-slate-950">Client Assessment &amp; Proposal Brief</h1>
              <p className="mt-2 text-sm text-slate-500">Internal advisory document · Version {assessment.versionNumber || 1} · {assessment.assessmentType || "Initial Assessment"}</p>
              {assessment.reassessmentReason ? <p className="mt-1 text-sm text-slate-500">Reassessment reason: {assessment.reassessmentReason}</p> : null}
            </div>
            <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-400">Assessment date</p>
              <p className="mt-1 font-black">{formatDate(assessment.assessmentDate)}</p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Client", lead.fullName],
            ["Lead ID", lead.leadCode],
            ["Advisor", lead.assignedAdvisorName || "—"],
            ["Qualification", `${assessment.qualification?.status || "—"} · ${assessment.qualification?.totalScore || 0}/5`]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl bg-slate-950 p-6 text-white">
          <div className="grid gap-5 sm:grid-cols-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Risk profile</p><p className="mt-2 text-2xl font-black text-cyan-300">{assessment.riskAssessment?.finalProfile || "—"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Primary goal</p><p className="mt-2 text-2xl font-black">{primaryGoal?.name || "—"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Combined target</p><p className="mt-2 text-2xl font-black">{formatCurrency(calculateTotalGoalTarget(bucketList))}</p></div>
          </div>
          <p className="mt-5 border-t border-slate-700 pt-5 text-sm leading-6 text-slate-300">{assessment.riskAssessment?.recommendedProfile}</p>
        </section>

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Bucket list</p><h2 className="mt-1 text-2xl font-black text-slate-950">Financial goals</h2></div><p className="text-sm font-bold text-slate-500">{bucketList.length} goal(s)</p></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {bucketList.map((goal, index) => (
              <div key={goal.id || index} className={`rounded-2xl border p-5 ${goal.isPrimary ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-slate-950">{goal.name}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{goal.isPrimary ? "Primary" : "Additional"} · {goal.type} · {goal.priority}</p></div><p className="font-black text-blue-800">{formatCurrency(goal.targetAmount)}</p></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Timeline</dt><dd className="font-bold text-slate-900">{goal.timeline || (goal.targetYear ? `By ${goal.targetYear}` : "—")}</dd></div><div><dt className="text-slate-500">Monthly contribution</dt><dd className="font-bold text-slate-900">{formatCurrency(goal.monthlyContribution)}</dd></div></dl>
                {goal.notes ? <p className="mt-4 text-sm leading-6 text-slate-700">{goal.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-9 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5 sm:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Investment preferences</p><p className="mt-2 text-lg font-black text-slate-950">{investmentPreferences.length} contribution plan(s)</p></div><p className="text-sm font-bold text-slate-600">{formatCurrency(preferenceTotals.sipAmount)} total SIP · {formatCurrency(preferenceTotals.lumpSumAmount)} total lump sum</p></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {investmentPreferences.length ? investmentPreferences.map((item, index) => (
                <div key={item.id || index} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Preference {index + 1}</p>
                  <p className="mt-2 font-black text-slate-950">{item.investmentType || "—"} · {item.preferredFrequency || "—"}</p>
                  <p className="mt-2 text-sm text-slate-600">{formatCurrency(item.sipAmount)} SIP · {formatCurrency(item.lumpSumAmount)} lump sum</p>
                  <div className="mt-3 flex flex-wrap gap-2">{(item.productsOfInterest || []).map((product) => <span key={product} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">{product}</span>)}</div>
                </div>
              )) : <p className="text-sm text-slate-500">No investment preferences recorded.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 sm:col-span-2"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Advisor context</p><p className="mt-3 text-sm leading-6 text-slate-700">{assessment.advisorNotes?.additionalContext || assessment.advisorNotes?.keyConcerns || "No additional context recorded."}</p></div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          <p>This document is prepared for internal financial advisory planning. Final recommendations remain subject to suitability review, documentation and client approval.</p>
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            <span>{branding.legalName || branding.companyName}</span>
            <span>{[branding.supportEmail, branding.website].filter(Boolean).join(" · ")}</span>
            <span>{branding.tagline}</span>
          </div>
        </footer>
        </div>
      </article>
    </div>
  );
}
