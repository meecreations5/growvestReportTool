"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  CheckCircle2,
  CircleDollarSign,
  Layers3,
  Target,
  WalletCards
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { getInvestorHoldingDetail } from "@/services/investorAppService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { MobileEmptyState, MobileSectionHeading } from "@/components/investor/mobile/InvestorMobilePrimitives";

function nameOf(position = {}) {
  return position.instrumentName || position.schemeName || position.stockName || position.fundName || position.planName || "Investment";
}

function productLabel(position = {}) {
  const type = String(position.productType || position.investmentType || "").toLowerCase();
  if (type.includes("mutual")) return "Mutual Fund";
  if (type.includes("stock") || type.includes("equity")) return "Equity";
  if (type.includes("ulip")) return "ULIP";
  if (type.includes("gold")) return "Gold";
  if (type.includes("bond") || type.includes("debt") || type.includes("fixed")) return "Fixed Income";
  return position.investmentTypeLabel || position.assetClass || "Investment";
}

function unitsOf(position = {}) {
  return Number(position.totalUnits ?? position.units ?? position.quantity ?? 0);
}

function rateOf(position = {}) {
  return Number(position.currentNav ?? position.currentRate ?? position.price ?? 0);
}

function rateLabel(position = {}) {
  return String(position.productType || "").includes("mutual") || Number(position.currentNav || 0) > 0 ? "NAV" : "Current price";
}

function transactionAmount(item = {}) {
  return Number(item.amount ?? item.purchaseAmount ?? item.currentValue ?? 0);
}

function isOutflow(item = {}) {
  const type = `${item.transactionType || ""} ${item.cashFlowType || ""}`.toLowerCase();
  return /withdraw|redeem|sell|sale|switch out|outflow/.test(type);
}

function Metric({ label, value, helper, privateValue = false }) {
  return <div className="p-4"><p className="text-[11px] font-medium text-[#6B7280]">{label}</p><p className={`${privateValue ? "gv-private-value " : ""}mt-1 font-heading text-[15px] font-bold text-[#0B0B0F]`}>{value}</p>{helper ? <p className="mt-0.5 text-[10px] text-[#6B7280]">{helper}</p> : null}</div>;
}

export default function InvestorHoldingDetailPage() {
  const params = useParams();
  const positionId = String(params?.positionId || "");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!positionId) return;
    let active = true;
    setLoading(true);
    setError("");
    getInvestorHoldingDetail(positionId)
      .then((data) => { if (active) setPayload(data); })
      .catch((nextError) => { if (active) setError(nextError?.message || "Unable to load this investment."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [positionId]);

  const position = payload?.position || null;
  const transactions = payload?.transactions || [];
  const currentValue = Number(position?.currentValue || 0);
  const invested = Number(position?.totalInvested ?? position?.investedAmount ?? 0);
  const gain = Number(position?.gainLoss ?? (currentValue - invested));
  const gainPct = invested > 0 ? gain / invested * 100 : Number(position?.gainLossPercentage || 0);
  const allocations = Array.isArray(position?.goalAllocations) ? position.goalAllocations : [];
  const primaryGoal = allocations.find((item) => Number(item.percentage || 0) > 0) || null;
  const status = String(position?.status || "Active");
  const valuationDate = position?.navDate || position?.valuationDate || position?.priceDate || "";
  const source = position?.provider || position?.source || "GrowVest Portfolio";
  const xirr = Number(position?.xirr ?? position?.annualizedReturn ?? 0);

  if (loading) return <div className="grid gap-3 md:hidden"><div className="gv-skeleton h-28 rounded-[20px]" /><div className="gv-skeleton h-40 rounded-[20px]" /><div className="gv-skeleton h-64 rounded-[20px]" /></div>;
  if (error) return <div className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;
  if (!position) return <MobileEmptyState icon={WalletCards} title="Investment not found" copy="This holding may no longer be active in your current Portfolio Master." />;

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Portfolio" title="Holding details" description="Complete investment details and transaction history." />

      <div className="gv-mobile-app-stack md:hidden">
        <section className="border-b border-slate-200 pb-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#F4F6F9] text-[#1F4ED8]"><WalletCards size={19} strokeWidth={1.5} /></span>
            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-2 font-heading text-[1.2rem] font-bold leading-5 text-[#0B0B0F]">{nameOf(position)}</h1>
              <p className="mt-1 text-[12px] text-[#6B7280]">{position.provider || "GrowVest"} · {productLabel(position)}</p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-[#1F4ED8]">{status}</span>
          </div>

          <div className="mt-6">
            <p className="text-[12px] text-[#6B7280]">Current Value</p>
            <p className="gv-private-value mt-1 font-heading text-[2rem] font-bold leading-none tracking-tight text-[#0B0B0F]">{formatCurrency(currentValue)}</p>
            <p className={`gv-private-value mt-2 inline-flex items-center gap-1 text-[12px] font-semibold ${gain >= 0 ? "text-[#1F4ED8]" : "text-[#E53935]"}`}>
              {gain >= 0 ? <ArrowUpRight size={14} strokeWidth={1.5} /> : <ArrowDownLeft size={14} strokeWidth={1.5} />}
              {gain >= 0 ? "+" : ""}{formatCurrency(gain)} · {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
            </p>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#1F4ED8]/15 bg-[#EAF0FF]/65 p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-white text-[#1F4ED8] shadow-sm"><BadgeIndianRupee size={17} strokeWidth={1.5} /></span>
            <div><p className="text-[10px] font-semibold text-[#1F4ED8]">At a glance</p><h2 className="font-heading text-[1.05rem] font-bold text-[#0B0B0F]">Investment snapshot</h2></div>
          </div>
          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[14px] border border-[#1F4ED8]/10 bg-white/95">
            <Metric label="Invested amount" value={formatCurrency(invested)} privateValue />
            <Metric label="Units" value={unitsOf(position) ? unitsOf(position).toLocaleString("en-IN", { maximumFractionDigits: 4 }) : "—"} privateValue />
            <Metric label={rateLabel(position)} value={rateOf(position) ? `₹${rateOf(position).toLocaleString("en-IN", { maximumFractionDigits: 4 })}` : "—"} helper={valuationDate ? formatDate(valuationDate) : ""} privateValue />
            <Metric label="XIRR / return" value={xirr ? `${xirr.toFixed(1)}%` : `${gainPct.toFixed(1)}%`} privateValue />
          </div>
        </section>

        <section className="overflow-hidden border-y border-slate-200 bg-white">
          <div className="flex min-h-[60px] items-center gap-3 py-3">
            <Layers3 size={18} strokeWidth={1.5} className="text-[#1F4ED8]" />
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#0B0B0F]">Portfolio allocation</span><span className="text-[11px] text-[#6B7280]">Share of your total portfolio</span></span>
            <strong className="text-[12px] text-[#0B0B0F]">{Number(payload?.allocationPercentage || 0).toFixed(1)}%</strong>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex min-h-[60px] items-center gap-3 py-3">
            <Target size={18} strokeWidth={1.5} className="text-[#1F4ED8]" />
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#0B0B0F]">Goal allocation</span><span className="truncate text-[11px] text-[#6B7280]">{primaryGoal?.goalName || "General Wealth"}</span></span>
            <strong className="text-[12px] text-[#0B0B0F]">{primaryGoal ? `${Number(primaryGoal.percentage || 0).toFixed(0)}%` : "—"}</strong>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex min-h-[60px] items-center gap-3 py-3">
            <CheckCircle2 size={18} strokeWidth={1.5} className="text-[#1F4ED8]" />
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#0B0B0F]">Source</span><span className="truncate text-[11px] text-[#6B7280]">Verified Portfolio Master</span></span>
            <strong className="max-w-[42%] truncate text-[11px] text-[#6B7280]">{source}</strong>
          </div>
        </section>

        <section className="rounded-[16px] bg-[#F4F6F9] p-4">
          <p className="text-[11px] font-semibold text-[#6B7280]">In your plan</p>
          <h2 className="mt-0.5 font-heading text-[1.05rem] font-bold text-[#0B0B0F]">Why this is here</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] text-[#6B7280]">Purpose</p><p className="mt-1 text-[13px] font-semibold text-[#0B0B0F]">{primaryGoal?.goalName ? `Building ${primaryGoal.goalName}` : "General wealth creation"}</p></div>
              <Target size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#1F4ED8]" />
            </div>
            <div className="border-t border-slate-200 pt-4"><p className="text-[11px] text-[#6B7280]">Role in your portfolio</p><p className="mt-1 text-[13px] font-semibold text-[#0B0B0F]">{productLabel(position)}{position.assetClass && position.assetClass !== productLabel(position) ? ` · ${position.assetClass}` : ""}</p></div>
            <div className="border-t border-slate-200 pt-4"><p className="text-[11px] text-[#6B7280]">GrowVest review status</p><p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0B0B0F]"><CheckCircle2 size={16} strokeWidth={1.5} className="text-[#1F4ED8]" />{status.toLowerCase() === "active" ? "Active in your current plan" : status}</p></div>
          </div>
        </section>

        <section className="gv-mobile-deferred">
          <MobileSectionHeading eyebrow="Transactions" title="Investment activity" className="mb-2.5" />
          {transactions.length ? <div className="overflow-hidden border-y border-slate-200 bg-white">{transactions.map((item, index) => {
            const outflow = isOutflow(item);
            const amount = transactionAmount(item);
            return <div key={item.id || index} className={`flex min-h-[62px] items-center gap-3 py-3 ${index ? "border-t border-slate-100" : ""}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] ${outflow ? "bg-[#FFF0EF] text-[#E53935]" : "bg-[#F4F6F9] text-[#1F4ED8]"}`}>{outflow ? <ArrowUpRight size={16} strokeWidth={1.5} /> : <ArrowDownLeft size={16} strokeWidth={1.5} />}</span><span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-[#0B0B0F]">{item.transactionType || (outflow ? "Withdrawal" : "Investment")}</span><span className="mt-0.5 block text-[11px] text-[#6B7280]">{item.transactionDate ? formatDate(item.transactionDate) : "Portfolio activity"}{item.investmentMode ? ` · ${item.investmentMode}` : ""}</span></span><strong className={`gv-private-value text-[12px] ${outflow ? "text-[#E53935]" : "text-[#0B0B0F]"}`}>{amount ? `${outflow ? "-" : "+"}${formatCurrency(Math.abs(amount))}` : "—"}</strong></div>;
          })}</div> : <MobileEmptyState icon={CircleDollarSign} title="No transaction history found" copy="Transaction-level activity will appear here when available from the investment source." />}
        </section>
      </div>

      <div className="hidden rounded-[var(--gv-radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--gv-shadow-card)] md:block">
        <h1 className="font-heading text-2xl font-bold text-slate-950">{nameOf(position)}</h1>
        <p className="mt-2 text-sm text-slate-500">{productLabel(position)} · {source}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-4"><Metric label="Current value" value={formatCurrency(currentValue)} privateValue /><Metric label="Invested" value={formatCurrency(invested)} privateValue /><Metric label="Gain / loss" value={`${gain >= 0 ? "+" : ""}${formatCurrency(gain)}`} privateValue /><Metric label="Portfolio allocation" value={`${Number(payload?.allocationPercentage || 0).toFixed(1)}%`} /></div>
      </div>
    </div>
  );
}
