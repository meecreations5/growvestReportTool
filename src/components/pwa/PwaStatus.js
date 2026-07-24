"use client";

import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { usePwa } from "@/contexts/PwaContext";
import { useBranding } from "@/contexts/BrandingContext";

export function PwaInstallCard({ compact = false }) {
  const { canInstall, installApp, dismissInstall } = usePwa();
  const { branding } = useBranding();
  const shortName = branding.pwaShortName || branding.companyName || "GrowVest";
  const tagline = branding.pwaTagline || branding.brandPositioning || "Your Conscious Wealth Partner";
  if (!canInstall) return null;

  if (compact) {
    return (
      <button type="button" onClick={installApp} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--gv-blue)] px-3 text-xs font-bold text-white shadow-sm">
        <Download size={15} /> Install app
      </button>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,var(--gv-blue),#173eb4_58%,#0b0b0f)] p-5 text-white shadow-[var(--gv-shadow-card)] sm:p-6">
      <button type="button" onClick={dismissInstall} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80" aria-label="Dismiss install app prompt"><X size={17} /></button>
      <div className="max-w-lg pr-9">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">{tagline}</p>
        <h2 className="mt-2 font-heading text-2xl font-bold text-white">{shortName} Investor App</h2>
        <p className="mt-2 text-sm leading-6 text-blue-100">Install the secure portal on your phone for an app-like experience, quick access and live in-app notifications.</p>
        <button type="button" onClick={installApp} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-[var(--gv-blue)]"><Download size={17} /> Install {shortName}</button>
      </div>
    </section>
  );
}

export function PwaConnectionBanner() {
  const { isOnline } = usePwa();
  if (isOnline) return null;
  return (
    <div className="fixed inset-x-3 top-[72px] z-[70] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl sm:top-4">
      <WifiOff size={16} /> You are offline. Live investor data will refresh after reconnection.
    </div>
  );
}

export function PwaUpdateBanner() {
  const { updateAvailable, applyUpdate } = usePwa();
  if (!updateAvailable) return null;
  return (
    <div className="fixed inset-x-3 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-2xl lg:bottom-5">
      <p className="text-xs font-semibold text-slate-700">A new GrowVest app version is ready.</p>
      <button type="button" onClick={applyUpdate} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--gv-blue)] px-3 text-xs font-bold text-white"><RefreshCw size={14} /> Update</button>
    </div>
  );
}
