"use client";

import InvestorActionsPanel from "@/components/actions/InvestorActionsPanel";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";
import { useAuth } from "@/contexts/AuthContext";

export default function InvestorActionsPage() {
  const { isDemoInvestor } = useAuth();
  if (isDemoInvestor) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 py-3 md:py-8">
        <DemoInvestorCta
          title="Investor actions are read-only in the demo"
          description="You can explore how GrowVest presents decisions and next steps. Become part of GrowVest to receive and respond to actions linked to your own portfolio."
        />
      </div>
    );
  }
  return <InvestorActionsPanel />;
}
