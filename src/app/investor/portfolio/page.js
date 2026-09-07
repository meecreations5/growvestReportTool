"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import InvestorPortfolioPanel from "@/components/portfolio/InvestorPortfolioPanel";

export default function InvestorPortfolioPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyProtectionView = searchParams.get("view") === "protection";
  const investor = profile?.investorId ? {
    id: profile.investorId,
    fullName: profile.fullName || profile.name || "Investor",
    name: profile.name || profile.fullName || "Investor"
  } : null;

  useEffect(() => {
    if (legacyProtectionView) router.replace("/investor/insurance");
  }, [legacyProtectionView, router]);

  if (legacyProtectionView) {
    return <div className="grid gap-4"><div className="gv-skeleton h-32 rounded-2xl" /><div className="gv-skeleton h-80 rounded-2xl" /></div>;
  }

  return <div className="grid gap-5 sm:gap-6">
    <InvestorPageHeader
      eyebrow="Your Wealth"
      title="Portfolio"
      description="Your verified investments, performance, allocation and holdings. Protection is managed separately in the Protection centre."
    />

    {loading ? <div className="grid gap-4"><div className="gv-skeleton h-32 rounded-2xl" /><div className="gv-skeleton h-80 rounded-2xl" /></div> : investor
      ? <InvestorPortfolioPanel investor={investor} portal />
      : <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Investor profile not found.</div>}
  </div>;
}
