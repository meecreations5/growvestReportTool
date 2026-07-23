"use client";

import Link from "next/link";
import { Check, Eye, LayoutTemplate, Sparkles } from "lucide-react";
import TemplateThumbnail from "@/components/report-templates/TemplateThumbnail";
import { templateCategoryLabel, visibleTemplateSections } from "@/lib/constants/reportTemplates";

export default function ReportTemplateSelectionStep({
  templates = [],
  selectedTemplateId,
  selectedTemplateVersion,
  onSelect,
  disabled = false
}) {
  const available = templates.filter((item) => item.status === "active");

  if (!available.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <LayoutTemplate size={30} className="mx-auto text-slate-400" />
        <h3 className="mt-4 font-heading text-xl font-bold text-slate-950">No active templates available</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Activate a report template before continuing. The built-in Premium Blue template becomes available after template records are initialised.</p>
        <Link href="/report-templates" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white">Open Template Library</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {available.map((template) => {
        const currentTemplate = selectedTemplateId === template.id;
        const activeVersion = Number(template.version || 1);
        const appliedVersion = Number(selectedTemplateVersion || 1);
        const selected = currentTemplate && appliedVersion === activeVersion;
        const newerVersionAvailable = currentTemplate && appliedVersion !== activeVersion;
        const sectionCount = visibleTemplateSections(template).length;
        return (
          <article key={template.id} className={`overflow-hidden rounded-xl border bg-white transition ${selected ? "border-blue-500 ring-4 ring-blue-50" : newerVersionAvailable ? "border-amber-400 ring-4 ring-amber-50" : "border-slate-200 hover:border-blue-200"}`}>
            <div className="p-3 pb-0"><TemplateThumbnail template={template} compact /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {template.isDefault ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700"><Sparkles size={12} /> Recommended</span> : null}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{templateCategoryLabel(template.category)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Version {activeVersion}</span>
                    {newerVersionAvailable ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">Report uses v{appliedVersion}</span> : null}
                  </div>
                  <h3 className="mt-3 font-heading text-xl font-bold text-slate-950">{template.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{template.description}</p>
                </div>
                {selected ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-700 text-white"><Check size={16} /></span> : newerVersionAvailable ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"><Sparkles size={15} /></span> : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-3"><span className="block text-slate-400">Visible sections</span><strong className="mt-1 block text-slate-900">{sectionCount}</strong></div>
                <div className="rounded-lg bg-slate-50 p-3"><span className="block text-slate-400">Estimated output</span><strong className="mt-1 block text-slate-900">{template.estimatedPages || "6–9 pages"}</strong></div>
              </div>
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs">
                <span className="block font-semibold text-blue-700">Assigned delivery email</span>
                <strong className="mt-1 block truncate text-blue-950">{template.delivery?.emailTemplateName || "Monthly Report Ready — Premium"}</strong>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button type="button" disabled={disabled || selected} onClick={() => onSelect(template)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:opacity-60 ${selected ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200" : newerVersionAvailable ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-[#1F4ED8] text-white hover:bg-[#173EB4]"}`}>
                  {selected ? <Check size={16} /> : newerVersionAvailable ? <Sparkles size={16} /> : <LayoutTemplate size={16} />}
                  {selected ? `Applied v${activeVersion}` : newerVersionAvailable ? `Apply latest v${activeVersion}` : "Use template"}
                </button>
                <Link href={`/report-templates/${template.id}`} target="_blank" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label={`Preview ${template.name}`}><Eye size={17} /></Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
