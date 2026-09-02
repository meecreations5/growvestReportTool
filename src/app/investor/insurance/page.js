"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import InsuranceProtectionPanel from "@/components/insurance/InsuranceProtectionPanel";
export default function InvestorInsurancePage() {
  const { profile } = useAuth(); const [investor, setInvestor] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; (async () => { if (!profile?.investorId) { setLoading(false); return; } try { const snap = await getDoc(doc(db, "investors", profile.investorId)); if (active) setInvestor(snap.exists() ? { id: snap.id, ...snap.data() } : { id: profile.investorId }); } catch (e) { if (active) setError("Your insurance protection could not be loaded."); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [profile?.investorId]);
  return <div className="grid gap-5 sm:gap-6"><InvestorPageHeader eyebrow="Your Protection" title="Insurance & Protection" description="Your life, health, vehicle, home and other protection policies, with upcoming premiums and renewals. Insurance cover is separate from your investment corpus."/>{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}{loading ? <div className="gv-skeleton h-72 rounded-2xl"/> : investor ? <InsuranceProtectionPanel investor={investor} portal /> : null}</div>;
}
