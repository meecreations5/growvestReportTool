"use client";

import { useId } from "react";

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function pathFor(points = [], width = 320, height = 112, padding = 8) {
  if (!points.length) return { line: "", area: "", coords: [] };
  const values = points.map((item) => safeNumber(item.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const coords = points.map((item, index) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : usableWidth * index / (points.length - 1));
    const y = padding + usableHeight - ((safeNumber(item.value) - min) / range) * usableHeight;
    return { x, y, item };
  });
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(2)},${(height - padding).toFixed(2)} L${coords[0].x.toFixed(2)},${(height - padding).toFixed(2)} Z`;
  return { line, area, coords };
}

export function MobileLineChart({ points = [], height = 118, inverse = false, showDots = false, className = "" }) {
  const id = useId().replace(/:/g, "");
  const width = 320;
  const chart = pathFor(points, width, height, 8);
  const line = inverse ? "#ffffff" : "var(--gv-blue)";
  const fill = inverse ? "rgba(255,255,255,.20)" : "color-mix(in srgb, var(--gv-blue) 18%, transparent)";

  if (!points.length) {
    return <div className={`grid h-[118px] place-items-center rounded-2xl border border-dashed border-slate-200 text-[11px] font-semibold text-slate-400 ${className}`}>Trend appears after two verified portfolio updates.</div>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Portfolio value trend" className={`gv-financial-chart block h-auto w-full ${className}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gv-area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={inverse ? "#ffffff" : "#1f4ed8"} stopOpacity={inverse ? ".28" : ".22"} />
          <stop offset="100%" stopColor={inverse ? "#ffffff" : "#1f4ed8"} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1="8" x2={width - 8} y1={height * fraction} y2={height * fraction} stroke={inverse ? "rgba(255,255,255,.12)" : "rgba(148,163,184,.18)"} strokeWidth="1" />)}
      <path d={chart.area} fill={`url(#gv-area-${id})`} />
      <path d={chart.line} fill="none" stroke={line} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {showDots ? chart.coords.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.2" fill={line} stroke={inverse ? "#1f4ed8" : "#ffffff"} strokeWidth="2" />) : null}
    </svg>
  );
}

export function MobileDonutChart({ segments = [], size = 124, centerValue = "", centerLabel = "Portfolio", privateValue = false }) {
  const safe = segments.filter((segment) => safeNumber(segment.value) > 0);
  const total = safe.reduce((sum, segment) => sum + safeNumber(segment.value), 0);
  const radius = 40.5;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ["#1f4ed8", "#f5b301", "#0b0b0f", "#6b7280", "#e53935", "color-mix(in srgb, #1f4ed8 45%, white)"];

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Portfolio asset allocation">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#eef2f7" strokeWidth={strokeWidth} />
        {safe.map((segment, index) => {
          const fraction = total ? safeNumber(segment.value) / total : 0;
          const dash = fraction * circumference;
          const dashOffset = -offset * circumference;
          offset += fraction;
          return <circle key={`${segment.label || "segment"}-${index}`} cx="50" cy="50" r={radius} fill="none" stroke={segment.color || colors[index % colors.length]} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${Math.max(0, dash - 1.4)} ${circumference}`} strokeDashoffset={dashOffset} />;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className={`${privateValue ? "gv-private-value " : ""}font-heading text-base font-bold leading-none text-[var(--gv-ink)]`}>{centerValue || (total ? "100%" : "—")}</p>
          <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function MobileBarChart({ points = [], height = 110, className = "" }) {
  const safe = points.slice(-8);
  const max = Math.max(1, ...safe.map((item) => Math.abs(safeNumber(item.value))));
  return (
    <div className={`gv-financial-chart flex items-end gap-2 ${className}`} style={{ height }} aria-label="Monthly portfolio values">
      {safe.map((item, index) => {
        const value = safeNumber(item.value);
        const barHeight = Math.max(9, Math.abs(value) / max * (height - 24));
        return (
          <div key={`${item.label || index}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div className={`w-full max-w-8 rounded-t-xl ${value < 0 ? "bg-[var(--gv-danger)]" : index === safe.length - 1 ? "bg-[var(--gv-blue)]" : "bg-[color-mix(in_srgb,var(--gv-blue)_34%,white)]"}`} style={{ height: barHeight }} />
            <span className="max-w-full truncate text-[8px] font-semibold text-slate-400">{item.label || ""}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressRing({ value = 0, size = 56, stroke = 6, label }) {
  const safe = Math.max(0, Math.min(100, safeNumber(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - safe / 100 * circumference;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#edf1f7" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--gv-blue)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="absolute font-heading text-[11px] font-bold text-[var(--gv-ink)]">{label || `${Math.round(safe)}%`}</span>
    </div>
  );
}
