"use client";

import GrowVestSvgLogo from "@/components/investor/mobile/GrowVestSvgLogo";
import GrowVestMotionMark from "@/components/investor/mobile/GrowVestMotionMark";

export default function InvestorAppSplash({ label = "Preparing your investor app…", entry = false }) {
  return (
    <div className={`gv-investor-splash relative grid min-h-dvh place-items-center overflow-hidden bg-[#0B0B0F] px-6 text-white ${entry ? "gv-investor-splash--entry" : ""}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-[radial-gradient(circle_at_50%_20%,rgba(31,78,216,.16),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent,rgba(31,78,216,.34))]" />
      <img
        src="/brand/growvest-icon-outline.svg"
        alt=""
        aria-hidden="true"
        className="gv-splash-outline-watermark pointer-events-none absolute -bottom-10 -right-16 w-[18rem] opacity-[.045] brightness-0 invert"
      />

      <div className="relative grid w-full max-w-[280px] place-items-center text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          <div className="absolute inset-4 rounded-full bg-[var(--gv-cyan)]/10 blur-2xl" />
          <GrowVestMotionMark className="h-[82px] w-[82px]" inverse label={label} />
        </div>

        <div className="gv-splash-wordmark mt-7 grid place-items-center">
          <GrowVestSvgLogo className="h-auto w-[164px]" variant="logo" inverse />
          <p className="mt-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Your Conscious Wealth Partner</p>
        </div>

        <div className="gv-splash-label mt-10">
          <p className="text-[11px] font-semibold text-white/62">{label}</p>
          <p className="mt-1.5 text-[9px] font-medium text-white/30">Securely preparing your wealth view</p>
        </div>

        <div className="gv-splash-progress mt-4 h-1 w-36 overflow-hidden rounded-full bg-white/10">
          <div className="gv-investor-loading-bar h-full w-1/2 rounded-full bg-[linear-gradient(90deg,#1F4ED8,#F5B301)]" />
        </div>
        <p className="gv-splash-label mt-9 text-[8px] font-semibold tracking-[0.05em] text-white/32">Security of today. Transformation of tomorrow.</p>
      </div>
    </div>
  );
}
