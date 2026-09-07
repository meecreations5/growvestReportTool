"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Target,
  WalletCards
} from "lucide-react";
import { getInvestorAppData } from "@/services/investorAppService";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { goalDisplayStatus } from "@/lib/utils/reportPresentation";
import { MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";
import { goalStatusTone, goalToneClasses, goalVisual } from "@/components/investor/goalVisuals";

const ICON_STROKE = 1.5;

function progressLabel(value) {
  const safe = Number(value || 0);
  if (safe > 0 && safe < 1) return "<1%";
  return `${Math.round(safe)}%`;
}

function goalIdOf(goal = {}) {
  return String(goal.id || goal.goalId || "");
}

function productLabel(item = {}) {
  const type = String(item.productType || item.assetClass || "").toLowerCase();
  if (type.includes("mutual")) return "Mutual Fund";
  if (type.includes("stock") || type.includes("equity")) return "Equity";
  if (type.includes("ulip")) return "ULIP";
  if (type.includes("bond") || type.includes("debt") || type.includes("fixed")) return "Fixed Income";
  if (type.includes("gold")) return "Gold";
  return item.assetClass || "Investment";
}

export default function InvestorGoalDetailPage() {
  const params = useParams();
  const goalId = decodeURIComponent(String(params?.goalId || ""));
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllInvestments, setShowAllInvestments] = useState(false);

  useEffect(() => {
    if (!goalId) return;
    let active = true;
    setLoading(true);
    getInvestorAppData("goals")
      .then((next) => { if (active) setPayload(next); })
      .catch((nextError) => { if (active) setError(nextError?.message || "This Bucket List goal could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [goalId]);

  const goal = useMemo(
    () => (payload?.goals || []).find((item) => goalIdOf(item) === goalId) || null,
    [goalId, payload]
  );
  const investments = useMemo(
    () => (payload?.portfolio?.goalInvestments || []).filter((item) => String(item.goalId || "") === goalId),
    [goalId, payload]
  );

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="gv-skeleton h-52 rounded-[18px]" />
        <div className="gv-skeleton h-32 rounded-[18px]" />
        <div className="gv-skeleton h-48 rounded-[18px]" />
      </div>
    );
  }
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;
  if (!goal) return <MobileEmptyState icon={Target} title="Goal not found" copy="This Bucket List goal may no longer be active in your current wealth plan." actionHref="/investor/goals" actionLabel="Back to Bucket List" />;

  const name = goal.name || goal.goalName || "Bucket List goal";
  const current = Number(goal.currentAmount || goal.currentValue || 0);
  const target = Number(goal.targetAmount || 0);
  const remaining = Math.max(0, target - current);
  const monthly = Number(goal.monthlyContribution || goal.monthlySip || 0);
  const progress = target > 0 ? Math.min(100, current / target * 100) : Number(goal.progress || 0);
  const status = goalDisplayStatus(goal);
  const completed = progress >= 100 || /completed/i.test(status);
  const needsReview = /attention|required/i.test(status);
  const criticalReview = /failed|overdue|critical|lapsed|expired/i.test(`${status} ${goal.status || ""}`);
  const targetDateMissing = !goal.targetDate;
  const planState = completed ? "complete" : needsReview ? "review" : targetDateMissing ? "setup" : progress > 0 && progress < 1 ? "starting" : "on_track";
  const planCopy = {
    complete: { title: "This goal has reached its target", copy: "GrowVest will help you review what comes next and how this goal should evolve." },
    review: { title: "This goal needs a review", copy: "Your current progress or contribution may need attention. Review the goal with your GrowVest Partner before making changes." },
    setup: { title: "Set a target date to measure progress", copy: "Wealth is already connected to this goal. Add a target date so GrowVest can assess whether the present contribution is on track." },
    starting: { title: "Your plan is getting started", copy: "Your investments are beginning to build this goal. GrowVest will keep reviewing progress as the plan develops." },
    on_track: { title: "Your plan is moving forward", copy: "Your current portfolio allocation is building this goal. GrowVest will continue reviewing progress as your life and markets evolve." }
  }[planState];
  const statusLabel = needsReview ? status : targetDateMissing && !completed ? "Target date to be planned" : status;
  const statusTone = criticalReview ? "red" : targetDateMissing || needsReview ? "yellow" : goalStatusTone(statusLabel);
  const statusToneClass = goalToneClasses(statusTone);
  const GoalIcon = goalVisual(name);
  const visibleInvestments = showAllInvestments ? investments : investments.slice(0, 4);

  return (
    <div className="grid gap-6 pb-2">
      <section className="border-b border-slate-200 pb-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#EAF0FF] text-[#1F4ED8]">
            <GoalIcon size={23} strokeWidth={ICON_STROKE} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-[#6B7280]">Your Bucket List</p>
            <h1 className="mt-0.5 font-heading text-[1.55rem] font-bold leading-tight text-[#0B0B0F]">{name}</h1>
            <p className="mt-1 text-[12px] text-[#6B7280]">{goal.category || "Life goal"}{goal.targetDate ? ` · ${formatDate(goal.targetDate)}` : ""}</p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] text-[#6B7280]">Already built</p>
            <p className="gv-private-value mt-1 font-heading text-[2rem] font-bold leading-none tracking-tight text-[#0B0B0F]">{formatCurrency(current)}</p>
            <p className="gv-private-value mt-2 text-[12px] text-[#6B7280]">of {formatCurrency(target)}</p>
          </div>
          <strong className="font-heading text-[1.25rem] font-bold text-[#1F4ED8]">{progressLabel(progress)}</strong>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F4F6F9]">
          <div className="h-full rounded-full bg-[#1F4ED8]" style={{ width: `${Math.min(100, progress)}%`, minWidth: progress > 0 ? "2px" : 0 }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${statusToneClass.text}`}>
            <span className={`h-2 w-2 rounded-full ${statusToneClass.dot}`} />
            {statusLabel}
          </span>
          {goal.targetDate ? <span className="text-[11px] text-[#6B7280]">Target {formatDate(goal.targetDate)}</span> : null}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-[1.05rem] font-bold text-[#0B0B0F]">Plan at a glance</h2>
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[16px] border border-slate-200 bg-white">
          {[
            ["Target", formatCurrency(target), GoalIcon, "text-[#1F4ED8]"],
            ["Remaining", formatCurrency(remaining), CircleDollarSign, "text-[#0B0B0F]"],
            ["Target date", goal.targetDate ? formatDate(goal.targetDate) : "Not set", CalendarDays, goal.targetDate ? "text-[#1F4ED8]" : "text-[#8A5B00]"],
            ["Monthly contribution", monthly ? formatCurrency(monthly) : "Not set", WalletCards, monthly ? "text-[#1F4ED8]" : "text-[#8A5B00]"]
          ].map(([label, value, Icon, iconClass], index) => (
            <div key={label} className={`min-h-[94px] p-4 ${index % 2 ? "border-l border-slate-100" : ""} ${index > 1 ? "border-t border-slate-100" : ""}`}>
              <Icon size={17} strokeWidth={ICON_STROKE} className={iconClass} />
              <p className="mt-2 text-[11px] text-[#6B7280]">{label}</p>
              <p className="gv-private-value mt-1 font-heading text-[15px] font-bold text-[#0B0B0F]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${criticalReview ? "bg-[#FFF1F0]" : ["review", "setup"].includes(planState) ? "bg-[#FFF8DF]" : "bg-[#F4F6F9]"} rounded-[16px] px-4 py-4`}>
        <p className="text-[11px] font-semibold text-[#6B7280]">At your present plan</p>
        <h2 className="mt-1 font-heading text-[1.05rem] font-bold text-[#0B0B0F]">{planCopy.title}</h2>
        <p className="mt-1.5 text-[12px] leading-5 text-[#6B7280]">{planCopy.copy}</p>
      </section>

      <section>
        <p className="text-[12px] font-semibold text-[#6B7280]">Connected investments</p>
        <h2 className="mt-0.5 font-heading text-[1.1rem] font-bold text-[#0B0B0F]">What is building this goal</h2>
        {investments.length ? (
          <div className="mt-3 overflow-hidden border-y border-slate-200 bg-white">
            {visibleInvestments.map((item, index) => (
              <Link key={`${item.positionId}-${index}`} href={`/investor/portfolio/${item.positionId}`} className={`flex min-h-[68px] items-center gap-3 py-3 active:bg-[#F4F6F9] ${index ? "border-t border-slate-100" : ""}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#F4F6F9] text-[#1F4ED8]">
                  <WalletCards size={18} strokeWidth={ICON_STROKE} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#0B0B0F]">{item.instrumentName}</span>
                  <span className="mt-0.5 block text-[11px] text-[#6B7280]">{productLabel(item)}{Number(item.percentage || 0) > 0 && Number(item.percentage || 0) < 100 ? ` · ${Number(item.percentage || 0).toFixed(0)}% allocated` : ""}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="gv-private-value block font-heading text-[13px] font-bold text-[#0B0B0F]">{formatCurrency(item.currentValue)}</span>
                  <ChevronRight size={15} strokeWidth={ICON_STROKE} className="ml-auto mt-1 text-slate-300" />
                </span>
              </Link>
            ))}
          </div>
        ) : <div className="mt-3"><MobileEmptyState icon={WalletCards} title="Investments are being linked" copy="Once GrowVest assigns investments to this goal, they will appear here automatically." /></div>}
        {investments.length > 4 ? <button type="button" onClick={() => setShowAllInvestments((value) => !value)} className="mt-3 inline-flex min-h-9 items-center text-[12px] font-bold text-[#1F4ED8]">{showAllInvestments ? "Show fewer investments" : `View all ${investments.length} investments`}</button> : null}
      </section>

      <Link href="/investor/meetings" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#1F4ED8] px-4 text-[13px] font-bold text-white">
        Discuss this goal with GrowVest <ArrowRight size={16} strokeWidth={ICON_STROKE} />
      </Link>
    </div>
  );
}
