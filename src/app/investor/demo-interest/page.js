"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestDemoSession, maskDemoMobile } from "@/lib/demo/investorDemo";
import InvestorBrandMark from "@/components/investor/mobile/InvestorBrandMark";

const INTEREST_OPTIONS = [
  "Building Wealth",
  "Bucket List Planning",
  "Existing Investment Review",
  "Retirement Planning",
  "Family Wealth Planning",
  "Protection / Insurance",
  "Not sure yet"
];

export default function DemoInterestPage() {
  const router = useRouter();
  const { demoSession, profile } = useAuth();
  const session = useMemo(() => demoSession || getGuestDemoSession(), [demoSession]);
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [interest, setInterest] = useState(session?.interest && session.interest !== "Just Exploring" ? session.interest : "Not sure yet");
  const [preferredContact, setPreferredContact] = useState("WhatsApp");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!session) {
      router.replace("/investor-demo");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enrich",
          fullName: session.fullName,
          mobile: session.mobile,
          email,
          city,
          interest,
          preferredContact,
          companyWebsite,
          demoSessionId: session.sessionId,
          agreedToBecomePart: true
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to update your details.");
      setSubmitted(true);
    } catch (nextError) {
      setError(nextError?.message || "Unable to update your details.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#F4F6F9] p-5">
        <section className="max-w-md rounded-[24px] bg-white p-6 text-center shadow-[0_18px_55px_rgba(11,11,15,.08)]">
          <h1 className="font-heading text-2xl font-bold text-[#0B0B0F]">Start your Demo Experience first</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">We use your demo name and mobile number to personalise this enquiry.</p>
          <Link href="/investor-demo" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1F4ED8] px-4 text-sm font-bold text-white">Start Demo <ArrowRight size={16} /></Link>
        </section>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#F4F6F9] p-5">
        <section className="w-full max-w-md rounded-[26px] bg-white p-6 text-center shadow-[0_18px_55px_rgba(11,11,15,.08)]">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={23} strokeWidth={1.5} /></span>
          <h1 className="mt-4 font-heading text-2xl font-bold text-[#0B0B0F]">Thank you, {String(session.fullName).split(" ")[0]}.</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">Your interest is already with GrowVest and these additional details have been added to the same enquiry. Our team can now continue with the normal GrowVest conversation and lead-to-conversion process.</p>
          <button type="button" onClick={() => router.replace("/investor/dashboard")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1F4ED8] px-4 text-sm font-bold text-white">Continue Exploring Demo <ArrowRight size={16} strokeWidth={1.5} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#F4F6F9] px-4 py-6 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white shadow-[0_22px_70px_rgba(11,11,15,.10)]">
        <div className="bg-[#1F4ED8] px-5 pb-6 pt-5 text-white sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <Link href="/investor/dashboard" className="grid h-9 w-9 place-items-center rounded-full bg-white/10" aria-label="Back to demo"><ArrowLeft size={18} strokeWidth={1.5} /></Link>
            <InvestorBrandMark variant="logo" inverse className="h-auto w-[120px] brightness-0 invert" />
            <span className="w-9" />
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"><CheckCircle2 size={12} strokeWidth={1.5} /> Interest received</span>
          <h1 className="mt-3 font-heading text-[1.85rem] font-bold leading-tight">Your GrowVest conversation has started.</h1>
          <p className="mt-2 text-sm leading-6 text-white/75">Your name and mobile number were saved when you chose Become part of GrowVest. Add anything else that will help our team understand you better.</p>
        </div>

        <form onSubmit={submit} className="grid gap-4 p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#F4F6F9] p-3">
            <div><p className="text-[9px] font-bold uppercase tracking-wide text-[#6B7280]">Name</p><p className="mt-1 truncate text-xs font-bold text-[#0B0B0F]">{profile?.fullName || session.fullName}</p></div>
            <div><p className="text-[9px] font-bold uppercase tracking-wide text-[#6B7280]">Mobile</p><p className="mt-1 text-xs font-bold text-[#0B0B0F]">{maskDemoMobile(session.mobile)}</p></div>
          </div>

          <label className="grid gap-1.5 text-xs font-bold text-[#0B0B0F]">Email ID <span className="font-medium text-[#6B7280]">Optional</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="min-h-12 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#1F4ED8] focus:ring-2 focus:ring-[#1F4ED8]/10" placeholder="you@example.com" />
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[#0B0B0F]">City <span className="font-medium text-[#6B7280]">Optional</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" maxLength={80} className="min-h-12 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#1F4ED8] focus:ring-2 focus:ring-[#1F4ED8]/10" placeholder="Your city" />
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[#0B0B0F]">What would you like GrowVest to help you with?
            <select value={interest} onChange={(event) => setInterest(event.target.value)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#1F4ED8]">
              {[...new Set([session.interest, ...INTEREST_OPTIONS].filter(Boolean))].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-xs font-bold text-[#0B0B0F]">Preferred contact</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["Call", "WhatsApp", "Email"].map((item) => <button key={item} type="button" onClick={() => setPreferredContact(item)} className={`min-h-10 rounded-xl border text-[11px] font-bold ${preferredContact === item ? "border-[#1F4ED8] bg-[#EAF0FF] text-[#1F4ED8]" : "border-slate-200 text-[#6B7280]"}`}>{item}</button>)}
            </div>
          </fieldset>

          <div className="rounded-xl bg-[#F7F9FC] p-3 text-[11px] leading-5 text-[#6B7280]">
            You asked GrowVest to contact you when you selected <strong className="text-[#0B0B0F]">Become part of GrowVest</strong>. These fields only enrich that existing enquiry; they do not create another lead.
          </div>
          <label className="sr-only">Company website<input value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          {error ? <div className="rounded-xl border border-[#E53935]/20 bg-[#E53935]/5 px-3.5 py-3 text-xs font-semibold text-[#B42318]">{error}</div> : null}
          <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1F4ED8] px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save My Details"} {!busy ? <ArrowRight size={16} strokeWidth={1.5} /> : null}</button>
          <button type="button" onClick={() => router.replace("/investor/dashboard")} className="min-h-10 text-xs font-bold text-[#6B7280]">Skip and continue exploring demo</button>
        </form>
      </section>
    </main>
  );
}
