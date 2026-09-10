"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestDemoSession } from "@/lib/demo/investorDemo";

export default function DemoInvestorCta({
  title = "Ready to make this your own?",
  description = "Become part of GrowVest and start building your personal wealth journey.",
  compact = false,
  className = ""
}) {
  const router = useRouter();
  const { demoSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function becomePart() {
    const session = demoSession || getGuestDemoSession();
    if (!session) {
      router.push("/investor-demo");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "express_interest",
          fullName: session.fullName,
          mobile: session.mobile,
          interest: session.interest,
          preferredContact: "WhatsApp",
          demoSessionId: session.sessionId,
          agreedToBecomePart: true
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to save your GrowVest interest.");
      router.push("/investor/demo-interest");
    } catch (nextError) {
      setError(nextError?.message || "Unable to save your GrowVest interest.");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <div className={className}>
        <button type="button" onClick={becomePart} disabled={busy} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-[#EAF0FF] px-3.5 text-left text-[#0B0B0F] active:opacity-80 disabled:opacity-60">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1F4ED8] text-white"><Sparkles size={15} strokeWidth={1.5} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold">{busy ? "Starting your GrowVest journey…" : "Become part of GrowVest"}</span><span className="block truncate text-[9.5px] text-[#6B7280]">Ask GrowVest to contact you.</span></span>
          {busy ? <Loader2 size={15} strokeWidth={1.5} className="shrink-0 animate-spin text-[#1F4ED8]" /> : <ArrowRight size={15} strokeWidth={1.5} className="shrink-0 text-[#1F4ED8]" />}
        </button>
        {error ? <p className="mt-1.5 px-1 text-[10px] font-semibold leading-4 text-[#B42318]">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className={`rounded-[22px] border border-[#DCE6FF] bg-white p-5 shadow-[0_8px_24px_rgba(11,11,15,.05)] ${className}`}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EAF0FF] text-[#1F4ED8]"><Sparkles size={18} strokeWidth={1.5} /></span>
      <h2 className="mt-4 font-heading text-xl font-bold text-[#0B0B0F]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
      <button type="button" onClick={becomePart} disabled={busy} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1F4ED8] px-4 text-sm font-bold text-white disabled:opacity-60">
        {busy ? <><Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> Saving your interest…</> : <>Become part of GrowVest <ArrowRight size={16} strokeWidth={1.5} /></>}
      </button>
      <p className="mt-2 text-[10px] leading-4 text-[#6B7280]">By continuing, you are asking GrowVest to contact you about becoming an investor.</p>
      {error ? <div className="mt-3 rounded-xl border border-[#E53935]/20 bg-[#E53935]/5 px-3 py-2.5 text-xs font-semibold text-[#B42318]">{error}</div> : null}
    </section>
  );
}
