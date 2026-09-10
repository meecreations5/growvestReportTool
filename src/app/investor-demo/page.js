"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_INTERESTS, getGuestDemoSession } from "@/lib/demo/investorDemo";
import InvestorBrandMark from "@/components/investor/mobile/InvestorBrandMark";

export default function InvestorDemoPage() {
  const router = useRouter();
  const { startDemoInvestor, isDemoInvestor, profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [interest, setInterest] = useState("Just Exploring");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingDemo, setExistingDemo] = useState(null);

  useEffect(() => {
    setExistingDemo(getGuestDemoSession());
  }, []);

  async function beginDemo(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await startDemoInvestor({ fullName, mobile, interest });
      router.replace("/investor/dashboard");
    } catch (nextError) {
      setError(nextError?.message || "Unable to start your GrowVest demo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#F4F6F9] px-4 py-6 sm:grid sm:place-items-center sm:py-10">
      <section className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white shadow-[0_22px_70px_rgba(11,11,15,.10)]">
        <div className="bg-[#1F4ED8] px-5 pb-7 pt-5 text-white sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <Link href="/investor-login" className="grid h-9 w-9 place-items-center rounded-full bg-white/10" aria-label="Back to Investor Login"><ArrowLeft size={18} strokeWidth={1.5} /></Link>
            <InvestorBrandMark variant="logo" inverse className="h-auto w-[124px] brightness-0 invert" />
            <span className="w-9" />
          </div>
          <span className="mt-7 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/95"><Sparkles size={12} strokeWidth={1.5} className="text-[#F5B301]" /> Personalised Demo</span>
          <h1 className="mt-3 font-heading text-[2rem] font-bold leading-[1.05] text-white">See GrowVest as if it were <span className="text-[#F5B301]">already yours.</span></h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Enter your name and mobile number. We will create a private sample Investor App with a different illustrative portfolio for you.</p>
        </div>

        <div className="p-5 sm:p-7">
          {(existingDemo || isDemoInvestor) ? (
            <div className="mb-5 rounded-2xl border border-[#DCE6FF] bg-[#F7F9FF] p-4">
              <p className="text-xs font-bold text-[#1F4ED8]">You already have an active Demo Experience</p>
              <p className="mt-1 text-sm text-[#6B7280]">Continue as {profile?.fullName || existingDemo?.fullName || "Guest Investor"}, or create a fresh personalised demo below.</p>
              <button type="button" onClick={() => router.push("/investor/dashboard")} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1F4ED8] px-3.5 text-xs font-bold text-white">Continue Demo <ArrowRight size={14} strokeWidth={1.5} /></button>
            </div>
          ) : null}

          <form onSubmit={beginDemo} className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-bold text-[#0B0B0F]">Full Name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={80} placeholder="Your name" className="min-h-12 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#1F4ED8] focus:ring-2 focus:ring-[#1F4ED8]/10" required />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-[#0B0B0F]">Mobile Number
              <input value={mobile} onChange={(event) => setMobile(event.target.value)} autoComplete="tel" inputMode="tel" maxLength={18} placeholder="10-digit mobile number" className="min-h-12 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#1F4ED8] focus:ring-2 focus:ring-[#1F4ED8]/10" required />
            </label>

            <fieldset className="mt-1">
              <legend className="text-xs font-bold text-[#0B0B0F]">What matters most to you right now? <span className="font-medium text-[#6B7280]">Optional</span></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEMO_INTERESTS.map((item) => (
                  <button key={item} type="button" onClick={() => setInterest(item)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition ${interest === item ? "border-[#1F4ED8] bg-[#EAF0FF] text-[#1F4ED8]" : "border-slate-200 bg-white text-[#6B7280]"}`}>
                    {interest === item ? <Check size={12} strokeWidth={1.8} /> : null}{item}
                  </button>
                ))}
              </div>
            </fieldset>

            {error ? <div className="rounded-xl border border-[#E53935]/20 bg-[#E53935]/5 px-3.5 py-3 text-xs font-semibold text-[#B42318]">{error}</div> : null}

            <button type="submit" disabled={busy} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1F4ED8] px-4 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Creating your demo…" : "Explore My Demo"} {!busy ? <ArrowRight size={16} strokeWidth={1.5} /> : null}
            </button>
          </form>

          <p className="mt-5 text-[10px] leading-4 text-[#6B7280]">All portfolio values, investments, returns, goals and insurance information in the demo are illustrative. Your mobile number is used only to keep this demo consistent and to prefill your enquiry if you choose to contact GrowVest.</p>
        </div>
      </section>
    </main>
  );
}
