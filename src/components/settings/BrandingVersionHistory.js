"use client";

import { History, RotateCcw } from "lucide-react";

function formatTimestamp(value) {
  if (!value) return "Pending timestamp";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function BrandingVersionHistory({ versions = [], loading, onRestore }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Version history</p>
          <h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Published branding snapshots</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">Restore a previous version into the draft, review it, then publish when ready.</p>
        </div>
        <History size={20} className="shrink-0 text-slate-400" />
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : versions.length ? (
        <div className="mt-5 grid gap-3">
          {versions.map((version, index) => (
            <article key={version.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Version {version.version || "—"}</span>
                  {index === 0 ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Current published</span> : null}
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-slate-950">{version.branding?.companyName || "GrowVest"} · {version.branding?.brandPositioning || "Branding snapshot"}</p>
                <p className="mt-1 text-xs text-slate-500">Published {formatTimestamp(version.publishedAt)} by {version.publishedByName || "GrowVest Admin"}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(version)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw size={14} /> Restore to draft
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <History className="mx-auto text-slate-400" size={24} />
          <p className="mt-3 text-sm font-semibold text-slate-700">No published branding versions yet</p>
          <p className="mt-1 text-xs text-slate-500">The first version will be created when branding is published.</p>
        </div>
      )}
    </section>
  );
}
