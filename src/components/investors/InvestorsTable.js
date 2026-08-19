"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Filter,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import { getPrimaryGoal } from "@/lib/constants/assessment";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { inputClassName } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricCard from "@/components/ui/MetricCard";
import { getInvestorStatusSummaries } from "@/services/investorStatusService";
import { investorProfileCompletion } from "@/lib/investor/profileStatus";


function investorGoals(investor) {
  if (Array.isArray(investor?.bucketList) && investor.bucketList.length) return investor.bucketList;
  if (Array.isArray(investor?.goals)) return investor.goals;
  return [];
}

function RiskBadge({ profile }) {
  const styles = {
    CONSERVATIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
    MODERATE: "border-amber-200 bg-amber-50 text-amber-800",
    AGGRESSIVE: "border-red-200 bg-red-50 text-red-800"
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles[profile] || "border-slate-200 bg-slate-50 text-slate-700"}`}>{profile || "Not assessed"}</span>;
}

function StatusBadge({ value, helper = "" }) {
  const normalized = String(value || "").toLowerCase();
  const style = normalized === "verified" || normalized === "complete"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized === "needs attention"
      ? "border-red-200 bg-red-50 text-red-700"
      : normalized === "in progress"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}>{value || "Not checked"}</span>{helper ? <p className="mt-1 text-[10px] text-slate-400">{helper}</p> : null}</div>;
}

function InvestorCard({ investor, summary }) {
  const primaryGoal = getPrimaryGoal(investorGoals(investor));
  return (
    <Link href={`/investors/${investor.id}`} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[var(--gv-shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-xl font-bold text-[var(--gv-ink)] group-hover:text-blue-700">{investor.fullName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{investor.clientCode}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700"><ArrowUpRight size={17} /></span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><RiskBadge profile={investor.riskAssessment?.finalProfile} /><StatusBadge value={summary?.profile?.status || investor.profileStatus || investorProfileCompletion(investor).status} helper={`${summary?.profile?.percent ?? investor.profileCompletionPercent ?? investorProfileCompletion(investor).percent}% profile`} />{investor.portalEnabled ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Portal enabled</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Portal disabled</span>}</div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Primary goal</dt><dd className="mt-1 truncate text-sm font-semibold text-slate-800">{primaryGoal?.name || "—"}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Target</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(primaryGoal?.targetAmount)}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Advisor</dt><dd className="mt-1 truncate text-sm font-semibold text-slate-800">{investor.assignedAdvisorName || "—"}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Investor since</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{formatDate(investor.investorSince)}</dd></div>
      </dl>
    </Link>
  );
}

export default function InvestorsTable() {
  const { profile } = useAuth();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [portal, setPortal] = useState("ALL");
  const [statusSummaries, setStatusSummaries] = useState({});

  useEffect(() => {
    if (!profile) return undefined;
    return subscribeInvestors(
      profile,
      (items) => {
        setInvestors(items);
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load investors. Deploy the Firestore indexes and try again.");
        setLoading(false);
      }
    );
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    getInvestorStatusSummaries().then((items) => { if (active) setStatusSummaries(items); }).catch((nextError) => console.warn("Unable to load profile/document status summaries", nextError));
    return () => { active = false; };
  }, [profile?.id, investors.length]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return investors.filter((investor) => {
      const matchesSearch = !term || [investor.clientCode, investor.fullName, investor.contactNo, investor.email, investor.assignedAdvisorName]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const matchesRisk = risk === "ALL" || investor.riskAssessment?.finalProfile === risk;
      const matchesPortal = portal === "ALL" || (portal === "ENABLED" ? investor.portalEnabled : !investor.portalEnabled);
      return matchesSearch && matchesRisk && matchesPortal;
    });
  }, [investors, portal, risk, search]);

  const stats = useMemo(() => {
    const goals = investors.map((item) => getPrimaryGoal(investorGoals(item))).filter(Boolean);
    return {
      total: investors.length,
      portalEnabled: investors.filter((item) => item.portalEnabled).length,
      assessed: investors.filter((item) => item.riskAssessment?.finalProfile).length,
      totalTarget: goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0)
    };
  }, [investors]);

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading investors…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">{error}</div>;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Total investors" value={stats.total} helper="Active investor profiles" icon={UserRoundCheck} tone="blue" />
        <MetricCard label="Portal enabled" value={stats.portalEnabled} helper="Investors with portal access" icon={ShieldCheck} tone="green" />
        <MetricCard label="Risk assessed" value={stats.assessed} helper="Completed suitability profiles" icon={Sparkles} tone="amber" />
        <MetricCard label="Primary goal target" value={formatCurrency(stats.totalTarget)} helper="Across primary Bucket List goals" tone="cyan" />
      </div>

      <Card className="overflow-hidden" elevated={false}>
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_220px_190px]">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by client ID, name, contact or advisor" />
          </div>
          <div className="relative"><Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select className={`${inputClassName} pl-9`} value={risk} onChange={(event) => setRisk(event.target.value)}><option value="ALL">All risk profiles</option><option value="CONSERVATIVE">Conservative</option><option value="MODERATE">Moderate</option><option value="AGGRESSIVE">Aggressive</option></select></div>
          <select className={inputClassName} value={portal} onChange={(event) => setPortal(event.target.value)}><option value="ALL">All portal statuses</option><option value="ENABLED">Portal enabled</option><option value="DISABLED">Portal disabled</option></select>
        </div>

        {filtered.length ? (
          <>
            <div className="grid gap-3 p-4 md:hidden">{filtered.map((investor) => <InvestorCard key={investor.id} investor={investor} summary={statusSummaries[investor.id]} />)}</div>
            <div className="gv-scrollbar hidden overflow-x-auto md:block">
              <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">Investor</th><th className="px-5 py-3 font-bold">Advisor</th><th className="px-5 py-3 font-bold">Profile</th><th className="px-5 py-3 font-bold">KYC</th><th className="px-5 py-3 font-bold">Documents</th><th className="px-5 py-3 font-bold">Risk profile</th><th className="px-5 py-3 font-bold">Primary goal</th><th className="px-5 py-3 font-bold">Portal</th><th className="px-5 py-3 text-right font-bold">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((investor) => {
                    const primaryGoal = getPrimaryGoal(investorGoals(investor));
                    return (
                      <tr key={investor.id} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4"><Link href={`/investors/${investor.id}`} className="group block"><p className="font-semibold text-slate-950 group-hover:text-blue-700">{investor.fullName}</p><p className="mt-1 text-xs text-slate-500">{investor.clientCode}</p></Link></td>
                        <td className="px-5 py-4 font-medium text-slate-700">{investor.assignedAdvisorName || "—"}</td>
                        <td className="px-5 py-4"><StatusBadge value={statusSummaries[investor.id]?.profile?.status || investor.profileStatus || investorProfileCompletion(investor).status} helper={`${statusSummaries[investor.id]?.profile?.percent ?? investor.profileCompletionPercent ?? investorProfileCompletion(investor).percent}%`} /></td>
                        <td className="px-5 py-4"><StatusBadge value={statusSummaries[investor.id]?.kyc?.status || investor.kycStatus || "Not checked"} /></td>
                        <td className="px-5 py-4"><StatusBadge value={statusSummaries[investor.id]?.documents?.status || investor.documentStatusSummary?.status || "Not checked"} helper={statusSummaries[investor.id]?.documents ? `${statusSummaries[investor.id].documents.uploadedCount}/${statusSummaries[investor.id].documents.requiredCount} uploaded` : investor.documentStatusSummary ? `${investor.documentStatusSummary.uploadedCount || 0}/${investor.documentStatusSummary.requiredCount || 0} uploaded` : ""} /></td>
                        <td className="px-5 py-4"><RiskBadge profile={investor.riskAssessment?.finalProfile} /></td>
                        <td className="px-5 py-4 text-slate-700">{primaryGoal?.name || "—"}</td>
                        <td className="px-5 py-4">{investor.portalEnabled ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Enabled</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Disabled</span>}</td>
                        <td className="px-5 py-4 text-right"><Link href={`/investors/${investor.id}`} aria-label={`Open ${investor.fullName}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ChevronRight size={17} /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : <div className="p-4"><EmptyState title="No investors found" description="No investor profiles match the current search and filters." /></div>}
        <div className="border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500">Showing {filtered.length} of {investors.length} investors</div>
      </Card>
    </div>
  );
}
