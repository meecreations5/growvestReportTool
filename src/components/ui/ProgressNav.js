"use client";

import { Check, Circle } from "lucide-react";

export default function ProgressNav({ items, activeId, onSelect, title = "Progress", description, compact = false }) {
  const completed = items.filter((item) => item.complete).length;
  const percentage = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <nav aria-label={title} className={`${compact ? "" : "gv-card p-4"}`}>
      {!compact ? (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="gv-eyebrow">{title}</p>
              {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{percentage}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--gv-blue)] transition-all" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      ) : null}

      <div className={compact ? "gv-scrollbar flex gap-2 overflow-x-auto pb-1" : "grid gap-1.5"}>
        {items.map((item, index) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`${compact ? "min-w-[150px] shrink-0" : "w-full"} flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${active ? "border-blue-200 bg-blue-50 text-blue-950" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${item.complete ? "bg-emerald-100 text-emerald-700" : active ? "bg-[var(--gv-blue)] text-white" : "bg-slate-100 text-slate-500"}`}>
                {item.complete ? <Check size={14} aria-hidden="true" /> : item.number || index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                {item.helper && !compact ? <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.helper}</span> : null}
              </span>
              {!compact && !item.complete ? <Circle size={9} className={active ? "fill-blue-500 text-blue-500" : "text-slate-300"} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
