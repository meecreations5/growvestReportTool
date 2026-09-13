"use client";

import { compactCurrency } from "@/lib/utils/reportPresentation";

function chartTuning(chartStyle) {
  switch (chartStyle) {
    case "minimal":
      return { grid: false, fillOpacity: 0.1, strokeWidth: 2.4, pointRadius: 3.8, showValues: false };
    case "analytical":
      return { grid: true, fillOpacity: 0.16, strokeWidth: 2.6, pointRadius: 4, showValues: true };
    case "detailed":
      return { grid: true, fillOpacity: 0.18, strokeWidth: 2.8, pointRadius: 4.2, showValues: true };
    case "compact":
      return { grid: false, fillOpacity: 0.08, strokeWidth: 2.2, pointRadius: 3.4, showValues: false };
    default:
      return { grid: true, fillOpacity: 0.14, strokeWidth: 2.7, pointRadius: 4, showValues: false };
  }
}

export default function ReportTrendChart({ data = [], primaryColor = "#1F4ED8", chartStyle = "modern", printMode = false }) {
  if (data.length < 2) {
    return (
      <div className={`grid place-items-center bg-slate-50 px-6 text-center ${printMode ? "min-h-40 rounded-xl" : "min-h-64 rounded-2xl"}`}>
        <div>
          <p className="font-bold text-slate-800">Portfolio trend will appear after two comparable Monthly Wealth Reviews.</p>
          <p className="mt-2 text-sm text-slate-500">Complete another Monthly Wealth Review to unlock the trend view.</p>
        </div>
      </div>
    );
  }

  const tuning = chartTuning(chartStyle);
  const width = 760;
  const height = printMode ? 220 : 250;
  const paddingX = 44;
  const paddingTop = 24;
  const paddingBottom = 42;
  const values = data.map((item) => Number(item.value || 0));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = Math.max(0, min * 0.92);
    max = max * 1.08 || 1;
  }
  const range = Math.max(1, max - min);
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;
  const points = data.map((item, index) => {
    const x = paddingX + (index * usableWidth) / Math.max(1, data.length - 1);
    const y = paddingTop + usableHeight - ((Number(item.value || 0) - min) / range) * usableHeight;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingBottom} ${line} ${width - paddingX},${height - paddingBottom}`;
  const gradientId = `trendArea-${chartStyle}-${String(primaryColor).replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className={`report-trend-chart overflow-hidden ${printMode ? "is-print" : ""}`} data-chart-style={chartStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Portfolio value trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primaryColor} stopOpacity={tuning.fillOpacity} />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {(tuning.grid ? [0, 0.25, 0.5, 0.75, 1] : [1]).map((ratio) => {
          const y = paddingTop + ratio * usableHeight;
          const value = max - ratio * range;
          return (
            <g key={ratio}>
              <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#e5eaf2" strokeDasharray={tuning.grid ? "4 5" : undefined} />
              {tuning.grid ? <text x="4" y={y + 4} fontSize="11" fill="#94a3b8">{compactCurrency(value)}</text> : null}
            </g>
          );
        })}
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline points={line} fill="none" stroke={primaryColor} strokeWidth={tuning.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.id || point.monthKey}>
            <circle cx={point.x} cy={point.y} r={tuning.pointRadius} fill={primaryColor} stroke="#fff" strokeWidth="1.5" />
            {tuning.showValues && (data.length <= 6 || index === data.length - 1) ? <text x={point.x} y={point.y - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{compactCurrency(point.value)}</text> : null}
            <text x={point.x} y={height - 14} textAnchor="middle" fontSize="12" fill="#94a3b8">{point.label}</text>
          </g>
        ))}
      </svg>
      <div className={`flex justify-end border-t border-slate-100 text-slate-500 ${printMode ? "pt-2 text-xs" : "pt-3 text-sm"}`}>
        Latest: <span className="ml-2 font-black" style={{ color: primaryColor }}>{compactCurrency(data[data.length - 1]?.value)}</span>
      </div>
    </div>
  );
}
