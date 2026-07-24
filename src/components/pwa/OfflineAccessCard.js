"use client";

import { ShieldCheck, WifiOff } from "lucide-react";

export default function OfflineAccessCard({ compact = false, investor = false }) {
  return (
    <section className={`rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white shadow-[var(--gv-shadow-card)] ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600"><WifiOff size={20} /></span>
        <div>
          <p className="gv-eyebrow">Performance &amp; privacy</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-[var(--gv-ink)]">Limited offline shell only</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">GrowVest keeps navigation, branding and the offline status screen available. Financial records remain online-only.</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <p>{investor ? "Investor reports, portfolio details, PDFs, documents and MOM records are never retained in Firestore IndexedDB." : "Sensitive report, document and investor data is memory-only and is cleared when the session ends or the page reloads."}</p>
      </div>
    </section>
  );
}
