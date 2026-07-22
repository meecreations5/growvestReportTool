"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Check,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Star,
  UsersRound
} from "lucide-react";
import TemplateThumbnail from "@/components/report-templates/TemplateThumbnail";
import TemplateStatusBadge from "@/components/report-templates/TemplateStatusBadge";
import { templateCategoryLabel, visibleTemplateSections } from "@/lib/constants/reportTemplates";

function formatUpdatedAt(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Built-in GrowVest template";
  return `Updated ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date)}`;
}

export default function TemplateCard({
  template,
  usageCount = 0,
  canDuplicate = false,
  canSetDefault = false,
  canArchive = false,
  onDuplicate,
  onSetDefault,
  onArchive,
  onRestore,
  busyAction = ""
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const visibleSections = visibleTemplateSections(template).length;

  useEffect(() => {
    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_36px_rgba(31,78,216,0.10)]">
      <Link href={`/report-templates/${template.id}`} className="block p-3 pb-0" aria-label={`Preview ${template.name}`}>
        <TemplateThumbnail template={template} compact />
      </Link>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TemplateStatusBadge status={template.status} isDefault={template.isDefault} />
              {template.isSystemTemplate ? (
                <span className="inline-flex min-h-6 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                  GrowVest standard
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 truncate font-heading text-xl font-bold text-slate-950">{template.name}</h2>
            <p className="mt-1 text-xs font-semibold text-blue-700">{templateCategoryLabel(template.category)}</p>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label={`More actions for ${template.name}`}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_46px_rgba(15,23,42,0.16)]">
                {canDuplicate ? (
                  <button type="button" onClick={() => { setMenuOpen(false); onDuplicate(template); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Copy size={16} className="text-blue-600" /> Duplicate template
                  </button>
                ) : null}
                {canSetDefault && !template.isDefault && template.status === "active" ? (
                  <button type="button" onClick={() => { setMenuOpen(false); onSetDefault(template); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Star size={16} className="text-blue-600" /> Set as default
                  </button>
                ) : null}
                {canArchive && !template.isSystemTemplate && template.status !== "archived" ? (
                  <button type="button" onClick={() => { setMenuOpen(false); onArchive(template); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50">
                    <Archive size={16} /> Archive template
                  </button>
                ) : null}
                {canArchive && !template.isSystemTemplate && template.status === "archived" ? (
                  <button type="button" onClick={() => { setMenuOpen(false); onRestore(template); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <RotateCcw size={16} className="text-blue-600" /> Restore as draft
                  </button>
                ) : null}
                {!canDuplicate && !canSetDefault && !canArchive ? (
                  <p className="px-3 py-2 text-xs leading-5 text-slate-500">You can preview active templates. Template management is available to Administrators.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{template.description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
          <div>
            <dt className="text-slate-400">Visible sections</dt>
            <dd className="mt-1 font-bold text-slate-800">{visibleSections}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Estimated output</dt>
            <dd className="mt-1 font-bold text-slate-800">{template.estimatedPages || "6–9 pages"}</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><UsersRound size={14} /> {usageCount} linked {usageCount === 1 ? "report" : "reports"}</span>
          <span>{formatUpdatedAt(template.updatedAt)}</span>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Link href={`/report-templates/${template.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1F4ED8] px-4 text-sm font-semibold text-white transition hover:bg-[#173EB4]">
            Preview template
          </Link>
          {canDuplicate ? (
            <button type="button" onClick={() => onDuplicate(template)} disabled={busyAction === template.id} aria-label={`Duplicate ${template.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              {busyAction === template.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" /> : <Copy size={17} />}
            </button>
          ) : (
            <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-emerald-600" title="Available for monthly reports">
              <Check size={17} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
