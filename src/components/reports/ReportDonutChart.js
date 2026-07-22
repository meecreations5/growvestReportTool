import { compactCurrency, holdingColor } from "@/lib/utils/reportPresentation";

export default function ReportDonutChart({ holdings = [], total = 0 }) {
  const valid = holdings.filter((item) => Number(item.percentage || 0) > 0);
  let cursor = 0;
  const segments = valid.map((item) => {
    const start = cursor;
    cursor += Number(item.percentage || 0);
    return `${holdingColor(item)} ${start}% ${cursor}%`;
  });
  const background = segments.length ? `conic-gradient(${segments.join(",")})` : "conic-gradient(#e2e8f0 0 100%)";

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto grid h-64 w-64 place-items-center rounded-full" style={{ background }}>
        <div className="grid h-40 w-40 place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <p className="text-2xl font-black text-slate-950">{compactCurrency(total)}</p>
            <p className="mt-1 text-sm text-slate-400">Total Portfolio</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4">
        {holdings.map((item) => (
          <div key={item.id || item.assetClass}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: holdingColor(item) }} />
                <p className="font-bold text-slate-950">{item.assetClass}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-400">{compactCurrency(item.currentValue)}</span>
                <span className="min-w-14 text-right font-black text-slate-950">{Number(item.percentage || 0).toFixed(1)}%</span>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(item.percentage || 0))}%`, backgroundColor: holdingColor(item) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
