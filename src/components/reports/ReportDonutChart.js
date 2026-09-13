import { compactCurrency, holdingColor } from "@/lib/utils/reportPresentation";

const SVG_SIZE = 120;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_RADIUS = 45;
const SVG_CIRCUMFERENCE = 2 * Math.PI * SVG_RADIUS;

function normaliseSegments(holdings = []) {
  const valid = holdings
    .map((item) => ({ ...item, percentage: Math.max(0, Number(item.percentage || 0)) }))
    .filter((item) => item.percentage > 0);
  const totalPercentage = valid.reduce((sum, item) => sum + item.percentage, 0);
  if (!totalPercentage) return [];

  // Keep the visual complete even when imported provider percentages contain
  // small rounding differences and do not add up to exactly 100.
  return valid.map((item) => ({
    ...item,
    chartPercentage: item.percentage / totalPercentage * 100
  }));
}

export default function ReportDonutChart({ holdings = [], total = 0, printMode = false, chartStyle = "modern" }) {
  const segments = normaliseSegments(holdings);
  const isSignature = chartStyle === "signature";
  const ringWidth = chartStyle === "minimal" || chartStyle === "compact" ? 13 : isSignature ? 16 : 17;
  let cursor = 0;

  return (
    <div className={`report-donut-chart grid items-center gap-8 ${printMode ? "is-print grid-cols-[190px_minmax(0,1fr)] gap-6" : "lg:grid-cols-[320px_minmax(0,1fr)]"}`} data-chart-style={chartStyle}>
      <div className={`relative mx-auto grid place-items-center ${printMode ? "h-44 w-44" : "h-64 w-64"}`}>
        <svg
          className="h-full w-full overflow-visible"
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          role="img"
          aria-label="Portfolio asset allocation chart"
        >
          <circle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={SVG_RADIUS}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={ringWidth}
          />
          {segments.map((item, index) => {
            const portion = item.chartPercentage;
            const dash = SVG_CIRCUMFERENCE * portion / 100;
            const offset = SVG_CIRCUMFERENCE * cursor / 100;
            cursor += portion;
            return (
              <circle
                key={item.id || item.assetClass || index}
                cx={SVG_CENTER}
                cy={SVG_CENTER}
                r={SVG_RADIUS}
                fill="none"
                stroke={holdingColor(item)}
                strokeWidth={ringWidth}
                strokeDasharray={`${dash} ${Math.max(0, SVG_CIRCUMFERENCE - dash)}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${SVG_CENTER} ${SVG_CENTER})`}
              />
            );
          })}
        </svg>
        <div className={`absolute grid place-items-center rounded-full bg-white text-center ${printMode ? "h-24 w-24" : "h-36 w-36"}`}>
          <div>
            <p className={`${printMode ? "text-lg" : "text-2xl"} font-black text-slate-950`}>{compactCurrency(total)}</p>
            <p className={`${printMode ? "mt-0.5 text-[10px]" : "mt-1 text-sm"} text-slate-400`}>Total Portfolio</p>
          </div>
        </div>
      </div>
      <div className={printMode ? "grid gap-2.5" : "grid gap-4"}>
        {holdings.map((item) => (
          <div key={item.id || item.assetClass} className={isSignature ? "signature-donut-legend-row" : ""}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`${printMode ? "h-2.5 w-2.5" : "h-3 w-3"} shrink-0 rounded-full`} style={{ backgroundColor: holdingColor(item) }} />
                <p className={`${printMode ? "text-xs" : ""} truncate font-bold text-slate-950`}>{item.assetClass}</p>
              </div>
              <div className={`flex items-center gap-3 ${printMode ? "text-[10px]" : "gap-4 text-sm"}`}>
                {isSignature ? null : <span className="text-slate-400">{compactCurrency(item.currentValue)}</span>}
                <span className={`${printMode ? "min-w-11" : "min-w-14"} text-right font-black text-slate-950`}>{Number(item.percentage || 0).toFixed(1)}%</span>
              </div>
            </div>
            {isSignature ? null : (
              <div className={`${printMode ? "mt-1 h-1" : "mt-2 h-1.5"} overflow-hidden rounded-full bg-slate-200`}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(item.percentage || 0))}%`, backgroundColor: holdingColor(item) }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
