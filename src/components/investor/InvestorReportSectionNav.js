"use client";

import { useEffect, useMemo, useState } from "react";

const defaultItems = [
  ["Overview", "report-overview"],
  ["Performance", "report-performance"],
  ["Goals", "report-goals"],
  ["Allocation", "report-allocation"],
  ["Holdings", "report-holdings"],
  ["Commentary", "report-commentary"],
  ["Actions", "report-actions"],
  ["Disclaimer", "report-disclaimer"]
];

export default function InvestorReportSectionNav({ items = defaultItems }) {
  const stableItems = useMemo(() => items, [items]);
  const [activeId, setActiveId] = useState(stableItems[0]?.[1] || "");

  useEffect(() => {
    const sections = stableItems
      .map(([, id]) => document.getElementById(id))
      .filter(Boolean);

    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      {
        rootMargin: "-22% 0px -62% 0px",
        threshold: [0.05, 0.2, 0.45]
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [stableItems]);

  function jump(id) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-[72px] z-30 -mx-4 overflow-x-auto border-y border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:top-[74px] lg:mx-0 lg:rounded-xl lg:border lg:px-3 lg:shadow-sm"
    >
      <div className="flex min-w-max gap-1.5">
        {stableItems.map(([label, id]) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => jump(id)}
              aria-current={active ? "location" : undefined}
              className={`min-h-10 rounded-lg px-3.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                active
                  ? "bg-blue-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
