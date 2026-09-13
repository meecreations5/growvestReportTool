"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Home, Sparkles, Target, WalletCards, X } from "lucide-react";
import InvestorBrandMark from "@/components/investor/mobile/InvestorBrandMark";

const GUIDE_VERSION = "2026-09-launch";
const OPEN_GUIDE_EVENT = "growvest:open-investor-guide";

const GUIDE_STEPS = [
  {
    key: "welcome",
    title: "Welcome to your GrowVest Investor App",
    body: "Here is a quick tour of the five places you will use most. It takes less than a minute and does not change any of your data.",
    icon: Sparkles
  },
  {
    key: "home",
    target: "home",
    title: "Home keeps the important things close",
    body: "See your current wealth, quick actions, Bucket List progress, reminders and anything that needs your attention.",
    icon: Home
  },
  {
    key: "portfolio",
    target: "portfolio",
    title: "Portfolio shows what you own",
    body: "Review your investments, allocation, performance and holding-level details from one place.",
    icon: WalletCards
  },
  {
    key: "growvest",
    target: "growvest",
    title: "GrowVest opens everything else",
    body: "Use the centre GrowVest button for Profile, Protection, Documents, Meetings, SIP reminders, Actions, privacy controls and more.",
    icon: Sparkles
  },
  {
    key: "goals",
    target: "goals",
    title: "Bucket List connects wealth to life",
    body: "Track the milestones you are building towards and see how your investments are contributing to each one.",
    icon: Target
  },
  {
    key: "reports",
    target: "reports",
    title: "Reports keep your reviews together",
    body: "Open your published Wealth Reviews, read the mobile summary, or view the exact locked report design whenever you need it.",
    icon: BarChart3
  },
  {
    key: "ready",
    title: "You are ready",
    body: "You can replay this guide any time from the GrowVest menu. Your Investor App will continue to open normally after this tour.",
    icon: Sparkles
  }
];

function storageKey(investorId) {
  return `growvest:investor-guide:${GUIDE_VERSION}:${investorId || "default"}`;
}

function isPhoneViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function targetRect(target) {
  if (!target || typeof document === "undefined") return null;
  const node = document.querySelector(`[data-investor-tour="${target}"]`);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const padX = target === "growvest" ? 7 : 4;
  const padTop = target === "growvest" ? 22 : 3;
  const padBottom = target === "growvest" ? 7 : 3;
  return {
    left: Math.max(6, rect.left - padX),
    top: Math.max(6, rect.top - padTop),
    width: Math.min(window.innerWidth - 12, rect.width + padX * 2),
    height: rect.height + padTop + padBottom
  };
}

export { OPEN_GUIDE_EVENT };

export default function InvestorAppGuideTour({ investorId, pathname }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const step = GUIDE_STEPS[stepIndex];
  const Icon = step.icon;
  const hasTarget = Boolean(step.target);
  const lastStep = stepIndex === GUIDE_STEPS.length - 1;
  const progress = useMemo(() => Math.round((stepIndex / (GUIDE_STEPS.length - 1)) * 100), [stepIndex]);

  const markSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(investorId), "completed");
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }, [investorId]);

  const closeTour = useCallback(() => {
    markSeen();
    setOpen(false);
    setStepIndex(0);
    setSpotlight(null);
  }, [markSeen]);

  const openTour = useCallback(() => {
    if (!isPhoneViewport()) return;
    setStepIndex(0);
    setSpotlight(null);
    setOpen(true);
  }, []);

  // First-run onboarding is phone-only and starts from Home. A small delay keeps it
  // from competing with the existing GrowVest entry motion / PWA splash experience.
  useEffect(() => {
    if (pathname !== "/investor/dashboard" || !isPhoneViewport()) return undefined;
    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(storageKey(investorId)) === "completed";
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return undefined;
    const timer = window.setTimeout(() => setOpen(true), 1650);
    return () => window.clearTimeout(timer);
  }, [investorId, pathname]);

  // Replay entry point used by the GrowVest action sheet.
  useEffect(() => {
    const handler = () => openTour();
    window.addEventListener(OPEN_GUIDE_EVENT, handler);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, handler);
  }, [openTour]);

  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !hasTarget) {
      setSpotlight(null);
      return undefined;
    }
    const update = () => setSpotlight(targetRect(step.target));
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [hasTarget, open, step.target]);

  if (!open) return null;

  const showSpotlight = hasTarget && spotlight;
  return (
    <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="GrowVest Investor App guide">
      <div className="absolute inset-0 z-0" aria-hidden="true" />
      {showSpotlight ? (
        <div
          className="pointer-events-none fixed z-10 rounded-[18px] border-2 border-white/95 shadow-[0_0_0_9999px_rgba(2,6,23,.70),0_0_0_6px_rgba(12,192,223,.20)] transition-[left,top,width,height] duration-200"
          style={{ left: spotlight.left, top: spotlight.top, width: spotlight.width, height: spotlight.height }}
          aria-hidden="true"
        />
      ) : <div className="absolute inset-0 z-10 bg-slate-950/70 backdrop-blur-[2px]" aria-hidden="true" />}
      <div className="absolute inset-0 z-20" aria-hidden="true" />

      <section className={`fixed left-3.5 right-3.5 z-30 mx-auto max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(2,6,23,.34)] ${hasTarget ? "bottom-[calc(84px+env(safe-area-inset-bottom))]" : "top-1/2 -translate-y-1/2"}`}>
        <div className="h-1.5 w-full bg-slate-100"><div className="h-full bg-[#0CC0DF] transition-[width] duration-300" style={{ width: `${Math.max(8, progress)}%` }} /></div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1F4ED8] text-white shadow-[0_8px_22px_rgba(31,78,216,.22)]">
                {step.key === "welcome" || step.key === "ready" ? <InvestorBrandMark variant="icon" inverse className="h-auto w-6 brightness-0 invert" /> : <Icon size={21} strokeWidth={1.7} />}
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#1F4ED8]">App Guide</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Step {stepIndex + 1} of {GUIDE_STEPS.length}</p>
              </div>
            </div>
            <button type="button" onClick={closeTour} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200" aria-label="Skip app guide"><X size={17} /></button>
          </div>

          <h2 className="mt-5 font-heading text-[1.45rem] font-bold leading-[1.08] text-[#0B0B0F]">{step.title}</h2>
          <p className="mt-3 text-[13px] leading-5 text-[#6B7280]">{step.body}</p>

          {step.key === "welcome" ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#F4F6F9] px-3 py-3 text-center"><strong className="block text-[15px] text-[#0B0B0F]">5</strong><span className="text-[9px] font-semibold text-slate-500">main areas</span></div>
              <div className="rounded-2xl bg-[#F4F6F9] px-3 py-3 text-center"><strong className="block text-[15px] text-[#0B0B0F]">&lt; 1 min</strong><span className="text-[9px] font-semibold text-slate-500">quick tour</span></div>
              <div className="rounded-2xl bg-[#F4F6F9] px-3 py-3 text-center"><strong className="block text-[15px] text-[#0B0B0F]">Anytime</strong><span className="text-[9px] font-semibold text-slate-500">replayable</span></div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-2.5">
            {stepIndex > 0 ? <button type="button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} className="min-h-11 rounded-[14px] border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0B0B0F] active:bg-slate-50">Back</button> : <button type="button" onClick={closeTour} className="min-h-11 rounded-[14px] px-2 text-[12px] font-bold text-slate-500 active:text-slate-700">Skip</button>}
            <button
              type="button"
              onClick={() => {
                if (lastStep) closeTour();
                else setStepIndex((current) => Math.min(GUIDE_STEPS.length - 1, current + 1));
              }}
              className="min-h-11 flex-1 rounded-[14px] bg-[#1F4ED8] px-4 text-[12px] font-bold text-white shadow-[0_8px_22px_rgba(31,78,216,.18)] active:translate-y-px"
            >
              {lastStep ? "Finish" : stepIndex === 0 ? "Show Me Around" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
