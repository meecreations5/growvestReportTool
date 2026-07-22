import { BarChart3, CheckCircle2, PieChart, Target, TrendingUp } from "lucide-react";

const coverClasses = {
  "premium-dark": "bg-[#0B1220]",
  "minimal-light": "bg-white",
  "performance-grid": "bg-[#111A35]",
  "structured-dark": "bg-[#111827]",
  "compact-gradient": "bg-gradient-to-br from-[#1F4ED8] to-[#0B1220]",
  "brand-light": "bg-[#F4F6F9]"
};

const textClasses = {
  "minimal-light": "text-[#0B1220]",
  "brand-light": "text-[#0B1220]"
};

function PreviewMetric({ label, value, dark }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${dark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-slate-50"}`}>
      <span className={`block text-[5px] font-semibold uppercase tracking-wide ${dark ? "text-white/45" : "text-slate-400"}`}>{label}</span>
      <strong className={`mt-0.5 block text-[8px] ${dark ? "text-white" : "text-slate-900"}`}>{value}</strong>
    </div>
  );
}

export default function TemplateThumbnail({ template, compact = false }) {
  const style = template?.appearance?.coverStyle || "premium-dark";
  const isLight = style === "minimal-light" || style === "brand-light";
  const dark = !isLight;
  const titleClass = textClasses[style] || "text-white";
  const heightClass = compact ? "h-[210px]" : "h-[330px]";

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${heightClass}`} aria-label={`${template.name} report preview`}>
      <div className={`relative h-[44%] overflow-hidden p-4 ${coverClasses[style] || coverClasses["premium-dark"]}`}>
        {style === "performance-grid" ? (
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:18px_18px]" />
        ) : null}
        {style === "premium-dark" || style === "structured-dark" ? (
          <>
            <span className="absolute -right-12 -top-16 h-36 w-36 rounded-full border border-cyan-300/15" />
            <span className="absolute -right-4 -top-10 h-24 w-24 rounded-full border border-blue-300/15" />
          </>
        ) : null}
        {style === "compact-gradient" ? <span className="absolute -bottom-14 -right-10 h-32 w-32 rounded-full bg-white/10" /> : null}
        {style === "brand-light" ? <span className="absolute -right-8 top-4 text-[72px] font-black leading-none text-blue-600/[0.07]">W</span> : null}

        <div className="relative z-10 flex items-center justify-between gap-3">
          <span className={`text-[7px] font-black tracking-[-0.04em] ${dark ? "text-white" : "text-slate-950"}`}>
            gro<span className="text-cyan-500">w</span>vest
          </span>
          <span className={`text-[5px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/50" : "text-slate-400"}`}>Confidential</span>
        </div>
        <div className="relative z-10 mt-6 max-w-[78%]">
          <p className={`text-[5px] font-bold uppercase tracking-[0.18em] ${dark ? "text-cyan-300" : "text-blue-600"}`}>Monthly Wealth Report</p>
          <p className={`mt-1 font-heading text-[15px] font-bold leading-[0.95] ${titleClass}`}>Investor Wealth Journey</p>
          <p className={`mt-2 text-[6px] ${dark ? "text-white/55" : "text-slate-500"}`}>March 2026 · GrowVest Advisors</p>
        </div>
      </div>

      <div className="h-[56%] bg-white p-3">
        <div className="grid grid-cols-3 gap-1.5">
          <PreviewMetric label="Portfolio" value="₹12.5L" dark={false} />
          <PreviewMetric label="Return" value="+2.45%" dark={false} />
          <PreviewMetric label="YTD" value="8.60%" dark={false} />
        </div>

        <div className="mt-3 grid grid-cols-[1.05fr_.95fr] gap-2">
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[6px] font-bold text-slate-700">Portfolio progress</span>
              <TrendingUp size={9} className="text-emerald-600" />
            </div>
            <div className="mt-2 flex h-10 items-end gap-1">
              {["h-[45%]", "h-[58%]", "h-[49%]", "h-[68%]", "h-[74%]", "h-[86%]"].map((heightClass, index) => (
                <span key={index} className={`flex-1 rounded-t-sm bg-blue-100 ${heightClass}`} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[6px] font-bold text-slate-700">Allocation</span>
              <PieChart size={9} className="text-blue-600" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-9 w-9 rounded-full border-[7px] border-blue-600 border-r-cyan-400 border-b-emerald-400" />
              <div className="grid gap-1">
                <span className="h-1.5 w-9 rounded-full bg-blue-100" />
                <span className="h-1.5 w-7 rounded-full bg-cyan-100" />
                <span className="h-1.5 w-8 rounded-full bg-emerald-100" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-2">
            <Target size={10} className="text-blue-600" />
            <div className="min-w-0"><p className="truncate text-[6px] font-bold text-slate-800">Primary goal</p><p className="text-[5px] text-slate-500">68% funded</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2">
            <CheckCircle2 size={10} className="text-emerald-600" />
            <div className="min-w-0"><p className="truncate text-[6px] font-bold text-slate-800">Advisor actions</p><p className="text-[5px] text-slate-500">3 recommendations</p></div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between text-[5px] text-slate-400">
        <span>{template.estimatedPages}</span>
        <span className="inline-flex items-center gap-1"><BarChart3 size={7} /> HTML + PDF</span>
      </div>
    </div>
  );
}
