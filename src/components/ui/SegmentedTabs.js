"use client";

export default function SegmentedTabs({ items, value, onChange, ariaLabel = "Sections", className = "" }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`gv-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[var(--gv-border)] bg-white p-1.5 shadow-sm ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${active ? "bg-[var(--gv-blue)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
