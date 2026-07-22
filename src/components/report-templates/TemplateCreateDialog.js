"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, X } from "lucide-react";
import TemplateThumbnail from "@/components/report-templates/TemplateThumbnail";

const inputClassName = "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function TemplateCreateDialog({ open, templates, sourceTemplate, submitting, onClose, onSubmit }) {
  const activeBases = useMemo(
    () => templates.filter((item) => item.status === "active" && item.isSystemTemplate),
    [templates]
  );
  const initialBaseId = sourceTemplate?.id || activeBases[0]?.id || "premium-blue";
  const [baseId, setBaseId] = useState(initialBaseId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    const nextBaseId = sourceTemplate?.id || activeBases[0]?.id || "premium-blue";
    const nextName = sourceTemplate ? `${sourceTemplate.name} — Copy` : "";
    setBaseId(nextBaseId);
    setName(nextName);
    setDescription(sourceTemplate?.description || "");
  }, [activeBases, open, sourceTemplate]);

  if (!open) return null;

  const selectedBase = templates.find((item) => item.id === baseId) || sourceTemplate || activeBases[0];
  const isValid = Boolean(selectedBase && name.trim().length >= 3);

  function handleSubmit(event) {
    event.preventDefault();
    if (!isValid || submitting) return;
    onSubmit({
      baseTemplate: selectedBase,
      name: name.trim(),
      description: description.trim() || selectedBase.description
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Close template dialog" />
      <section role="dialog" aria-modal="true" aria-labelledby="template-dialog-title" className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-[0_30px_90px_rgba(15,23,42,.28)] sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Custom report template</p>
            <h2 id="template-dialog-title" className="mt-1 font-heading text-2xl font-bold text-slate-950">{sourceTemplate ? "Duplicate template" : "Create from a GrowVest template"}</h2>
            <p className="mt-1 text-sm text-slate-500">The new template begins as a draft and does not affect published reports.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 p-5 sm:grid-cols-[230px_minmax(0,1fr)] sm:p-6">
          <div>
            {selectedBase ? <TemplateThumbnail template={selectedBase} compact /> : null}
            <p className="mt-3 text-xs leading-5 text-slate-500">The section order, visibility and appearance settings will be copied from this base template.</p>
          </div>

          <div className="grid content-start gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">Base template</span>
              <select className={inputClassName} value={baseId} onChange={(event) => setBaseId(event.target.value)} disabled={Boolean(sourceTemplate)}>
                {activeBases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {sourceTemplate ? <span className="text-xs text-slate-500">This copy will retain the source template's current configuration.</span> : null}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">Template name</span>
              <input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Family Office Monthly Report" maxLength={80} autoFocus />
              <span className="text-xs text-slate-500">Use a clear name that explains when staff should select this template.</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">Description</span>
              <textarea className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the report purpose and intended Investor audience." maxLength={240} />
              <span className="text-right text-xs text-slate-400">{description.length}/240</span>
            </label>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              The draft copies the selected section order and appearance settings while keeping the original GrowVest template unchanged.
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={!isValid || submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white transition hover:bg-[#173EB4] disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Copy size={17} />}
                {submitting ? "Creating draft…" : "Create draft template"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
