"use client";

import { useAuth } from "@/contexts/AuthContext";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import InsuranceProtectionPanel from "@/components/insurance/InsuranceProtectionPanel";

export default function InvestorInsurancePage() {
  const { profile, loading } = useAuth();
  const investor = profile?.investorId ? {
    id: profile.investorId,
    fullName: profile.fullName || profile.name || "Investor",
    name: profile.name || profile.fullName || "Investor"
  } : null;

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader
        eyebrow="Your Protection"
        title="Insurance & Protection"
        description="Your life, health, vehicle, home and other protection policies, with upcoming premiums and renewals. Insurance cover is separate from your investment corpus."
      />
      {loading ? <div className="gv-skeleton h-72 rounded-2xl" /> : investor ? <InsuranceProtectionPanel investor={investor} portal /> : null}
    </div>
  );
}
