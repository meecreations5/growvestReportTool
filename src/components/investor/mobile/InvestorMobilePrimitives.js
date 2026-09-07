"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function GrowVestOutline({ className = "", opacity = 0.1 }) {
  return (
    <img
      src="/brand/growvest-icon-outline.svg"
      alt=""
      aria-hidden="true"
      className={`gv-growvest-outline pointer-events-none select-none object-contain ${className}`}
      style={{ opacity }}
    />
  );
}

export function MobileSectionHeading({ eyebrow, title, actionHref = "", actionLabel = "View all", className = "" }) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="gv-mobile-section-title">{eyebrow}</p> : null}
        {title ? <h2 className="mt-1 font-heading text-[1.08rem] font-bold leading-tight text-[var(--gv-ink)]">{title}</h2> : null}
      </div>
      {actionHref ? (
        <Link href={actionHref} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-black text-[var(--gv-blue)] active:bg-[var(--gv-blue-soft)]">
          {actionLabel} <ChevronRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}

export function MobileEmptyState({ icon: Icon, title, copy, actionHref = "", actionLabel = "", tone = "blue" }) {
  const toneClass = tone === "cyan"
    ? "bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]"
    : tone === "yellow"
      ? "bg-[var(--gv-warning-soft)] text-amber-700"
      : "bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]";

  return (
    <section className="gv-mobile-app-card relative overflow-hidden px-6 py-12 text-center">
      <GrowVestOutline className="absolute -right-7 -bottom-4 w-32" opacity={0.045} />
      <span className={`relative mx-auto grid h-14 w-14 place-items-center rounded-[20px] ${toneClass}`}>{Icon ? <Icon size={24} /> : null}</span>
      <h3 className="relative mt-4 font-heading text-lg font-bold text-slate-950">{title}</h3>
      {copy ? <p className="relative mx-auto mt-2 max-w-[260px] text-xs leading-5 text-slate-500">{copy}</p> : null}
      {actionHref && actionLabel ? <Link href={actionHref} className="relative mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--gv-blue)] px-4 text-xs font-black text-white">{actionLabel}</Link> : null}
    </section>
  );
}

export function MobileInsightCard({ icon: Icon, eyebrow = "Next for you", title, copy, href = "", tone = "blue" }) {
  const tones = {
    blue: "bg-[var(--gv-blue)] text-white",
    cyan: "bg-[var(--gv-cyan)] text-white",
    yellow: "bg-[var(--gv-warning)] text-[var(--gv-ink)]",
    ink: "bg-[var(--gv-ink)] text-white"
  };
  const content = (
    <>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone] || tones.blue}`}><Icon size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[var(--gv-blue)]">{eyebrow}</span>
        <span className="mt-1 block line-clamp-2 text-sm font-extrabold leading-5 text-slate-950">{title}</span>
        {copy ? <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-slate-500">{copy}</span> : null}
      </span>
      {href ? <ChevronRight size={18} className="shrink-0 text-slate-300" /> : null}
    </>
  );
  return href ? <Link href={href} className="gv-mobile-app-card flex items-center gap-3 p-4 active:scale-[.99]">{content}</Link> : <div className="gv-mobile-app-card flex items-center gap-3 p-4">{content}</div>;
}

export function MobileMiniRing({ value = 0, label = "", helper = "", tone = "blue" }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  const ringColor = tone === "cyan" ? "var(--gv-cyan)" : tone === "yellow" ? "var(--gv-warning)" : tone === "green" ? "#10b981" : "var(--gv-blue)";
  return (
    <div className="min-w-0 text-center">
      <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: `conic-gradient(${ringColor} ${safe * 3.6}deg,#edf2f8 0deg)` }}>
        <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-white font-heading text-[10px] font-bold text-slate-900">{Math.round(safe)}%</span>
      </div>
      <p className="mt-2 truncate text-[9px] font-black text-slate-700">{label}</p>
      {helper ? <p className="mt-0.5 line-clamp-2 text-[8px] leading-3 text-slate-400">{helper}</p> : null}
    </div>
  );
}
