export default function MetricCard({ label, value, helper, icon: Icon, tone = "blue", className = "" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <div className={`gv-card p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">{label}</p>
          <p className="mt-2 truncate font-heading text-2xl font-bold leading-none text-[var(--gv-ink)]">{value}</p>
          {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone] || tones.blue}`}><Icon size={19} aria-hidden="true" /></span> : null}
      </div>
    </div>
  );
}
