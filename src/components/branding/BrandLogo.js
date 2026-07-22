"use client";

import { useBranding } from "@/contexts/BrandingContext";

export default function BrandLogo({ variant = "wide", className = "", imageClassName = "", showTagline = false, inverse = false }) {
  const { branding } = useBranding();
  const companyName = branding.companyName || "GrowVest";
  const iconUrl = branding.iconLogoUrl || "";
  const wideUrl = inverse ? (branding.whiteLogoUrl || branding.primaryLogoUrl || iconUrl) : (branding.primaryLogoUrl || iconUrl);
  const src = variant === "icon" ? iconUrl : wideUrl;

  if (src) {
    return (
      <div className={`flex min-w-0 items-center gap-3 ${className}`}>
        <img
          src={src}
          alt={`${companyName} logo`}
          className={`${variant === "icon" ? "h-11 w-11 rounded-xl object-contain" : "max-h-12 max-w-[210px] object-contain object-left"} ${imageClassName}`}
        />
        {showTagline ? <span className={`hidden text-xs sm:block ${inverse ? "text-slate-300" : "text-slate-500"}`}>{branding.tagline}</span> : null}
      </div>
    );
  }

  if (variant === "icon") {
    const initials = companyName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "GV";
    return <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-700 text-sm font-black text-white ${className}`}>{initials}</div>;
  }

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <BrandLogo variant="icon" />
      <div className="min-w-0">
        <p className={`truncate text-lg font-black tracking-tight ${inverse ? "text-white" : "text-slate-950"}`}>{companyName}</p>
        {showTagline ? <p className={`truncate text-xs ${inverse ? "text-slate-400" : "text-slate-500"}`}>{branding.tagline}</p> : null}
      </div>
    </div>
  );
}
