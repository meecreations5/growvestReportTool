"use client";

import { compactCurrency } from "@/lib/utils/reportPresentation";

export default function ReportTrendChart({ data = [] }) {
  if (data.length < 2) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl bg-slate-50 px-6 text-center">
        <div>
          <p className="font-bold text-slate-800">Portfolio trend will appear after two monthly reports.</p>
          <p className="mt-2 text-sm text-slate-500">Complete another monthly report to unlock the trend view.</p>
        </div>
      </div>
    );
  }

  const width = 760;
  const height = 250;
  const paddingX = 36;
  const paddingTop = 24;
  const paddingBottom = 42;
  const values = data.map((item) => Number(item.value || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
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

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Portfolio value trend chart">
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2455df" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2455df" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + ratio * usableHeight;
          const value = max - ratio * range;
          return (
            <g key={ratio}>
              <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#e5eaf2" strokeDasharray="4 5" />
              <text x="4" y={y + 4} fontSize="11" fill="#94a3b8">{compactCurrency(value)}</text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#trendArea)" />
        <polyline points={line} fill="none" stroke="#2455df" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.id || point.monthKey}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#2455df" />
            <text x={point.x} y={height - 14} textAnchor="middle" fontSize="12" fill="#94a3b8">{point.label}</text>
          </g>
        ))}
      </svg>
      <div className="flex justify-end border-t border-slate-100 pt-3 text-sm text-slate-500">
        Latest: <span className="ml-2 font-black text-blue-700">{compactCurrency(data[data.length - 1]?.value)}</span>
      </div>
    </div>
  );
}
