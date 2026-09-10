"use client";

import { useEffect } from "react";
import { ChevronRight, ShieldCheck, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeNextPath } from "@/lib/auth/session";

function initials(name = "Investor") {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "I";
}

export default function InvestorProfileSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessProfiles, switchInvestor, loading } = useAuth();
  const next = sanitizeNextPath(searchParams.get("next"), "/investor/dashboard", "/investor");

  useEffect(() => {
    if (!loading && accessProfiles.length === 1) {
      switchInvestor(accessProfiles[0].investorId);
      router.replace(next);
    }
  }, [accessProfiles, loading, next, router, switchInvestor]);

  function choose(profile) {
    if (!switchInvestor(profile.investorId)) return;
    router.replace(next);
    router.refresh();
  }

  if (loading) return null;

  return (
    <main className="mx-auto min-h-[70dvh] w-full max-w-lg px-4 pb-24 pt-7 md:pt-10">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1F4ED8] text-white"><UsersRound size={21} strokeWidth={1.5} /></span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1F4ED8]">Family access</p>
          <h1 className="mt-1 font-heading text-[1.55rem] font-bold leading-tight text-[#0B0B0F]">Who would you like to view?</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">This login is authorised for more than one GrowVest Investor profile.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {accessProfiles.map((item) => (
          <button key={item.investorId} type="button" onClick={() => choose(item)} className="flex min-h-[82px] w-full items-center gap-3 rounded-[20px] border border-slate-200 bg-white p-3.5 text-left shadow-[0_5px_18px_rgba(11,11,15,.04)] transition active:scale-[.99]">
            {item.photoURL ? <img src={item.photoURL} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F4F6F9] text-sm font-bold text-[#1F4ED8]">{initials(item.fullName)}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold text-[#0B0B0F]">{item.fullName}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#6B7280]">
                <span>{item.relationship || (item.isPrimary ? "Self" : "Family Member")}</span>
                {item.clientCode ? <><span aria-hidden="true">·</span><span>{item.clientCode}</span></> : null}
              </span>
            </span>
            <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-slate-300" />
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-2.5 rounded-2xl bg-[#F4F6F9] p-3.5 text-xs leading-5 text-[#6B7280]">
        <ShieldCheck size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#1F4ED8]" />
        <p>Only profiles explicitly authorised by GrowVest appear here. Switching profiles does not require another OTP.</p>
      </div>
    </main>
  );
}
