"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import InvestorPortfolioPanel from "@/components/portfolio/InvestorPortfolioPanel";

export default function InvestorPortfolioPage() {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile?.investorId) { setLoading(false); return; }
      setLoading(true); setError("");
      try {
        const snapshot = await getDoc(doc(db, "investors", profile.investorId));
        if (active) setInvestor(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      } catch (nextError) {
        console.error(nextError);
        if (active) setError("Your portfolio could not be loaded.");
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [profile?.investorId]);

  return <div className="grid gap-5 sm:gap-6"><InvestorPageHeader eyebrow="Your Wealth" title="Portfolio" description="Your latest GrowVest portfolio snapshot, source valuation dates and investment holdings. Values reflect the most recent verified imports and are not necessarily live market prices." />{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}{loading ? <div className="grid gap-4"><div className="gv-skeleton h-32 rounded-2xl" /><div className="gv-skeleton h-80 rounded-2xl" /></div> : investor ? <InvestorPortfolioPanel investor={investor} portal /> : <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Investor profile not found.</div>}</div>;
}
