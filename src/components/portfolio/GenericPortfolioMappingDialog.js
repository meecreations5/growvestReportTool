"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Columns3, Loader2, Save, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import {
  GENERIC_IMPORT_FIELD_DEFINITIONS,
  GENERIC_INVESTMENT_MODES,
  GENERIC_TRANSACTION_TYPES,
  PORTFOLIO_PRODUCT_LABELS,
  PORTFOLIO_PRODUCT_TYPES
} from "@/lib/constants/portfolio";
import { mapGenericPortfolioImport } from "@/services/portfolioService";

const GROUPS = [
  ["identity", "Investor identity"],
  ["classification", "Classification"],
  ["holding", "Investment identity"],
  ["valuation", "Valuation"],
  ["transaction", "Transactions"],
  ["other", "Other details"]
];

function initialMapping(item = {}) {
  return {
    ...(item.genericMapping?.suggestedMapping || {}),
    ...(item.genericMapping?.mapping || {})
  };
}

function sampleText(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).slice(0, 42);
}

export default function GenericPortfolioMappingDialog({ open, item, file, batchId, onClose, onMapped }) {
  const [mapping, setMapping] = useState({});
  const [defaults, setDefaults] = useState({ productType: "", investmentMode: "", transactionType: "", provider: "" });
  const [rowMode, setRowMode] = useState("holdings");
  const [completeSnapshot, setCompleteSnapshot] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMapping(initialMapping(item));
    setDefaults({
      productType: item?.genericMapping?.defaults?.productType || "",
      investmentMode: item?.genericMapping?.defaults?.investmentMode || "",
      transactionType: item?.genericMapping?.defaults?.transactionType || "",
      provider: item?.genericMapping?.defaults?.provider || ""
    });
    setRowMode(item?.genericMapping?.rowMode === "transactions" ? "transactions" : "holdings");
    setCompleteSnapshot(Boolean(item?.completeSnapshot));
    setSaveProfile(true);
    setProfileName(item?.genericMapping?.profileName || "");
    setError("");
  }, [item, open]);

  const headers = item?.genericMapping?.headers || [];
  const sampleRows = item?.genericMapping?.sampleRows || [];
  const selectedSample = useMemo(() => {
    const first = sampleRows[0] || {};
    return Object.fromEntries(Object.entries(mapping).map(([key, header]) => [key, header ? first[header] : ""]));
  }, [mapping, sampleRows]);

  if (!open || !item) return null;

  const hasInstrument = Boolean(mapping.instrumentName || mapping.symbol || mapping.isin || mapping.accountReference);
  const hasProductType = Boolean(mapping.productType || defaults.productType);
  const hasValuation = rowMode === "transactions" || Boolean(mapping.currentValue || (mapping.quantity && mapping.currentRate));
  const canSubmit = hasInstrument && hasProductType && hasValuation && Boolean(file);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await mapGenericPortfolioImport(batchId, item.fileId, file, {
        sheetName: item.genericMapping?.sheetName || item.sheetName || "",
        rowMode,
        mapping,
        defaults,
        completeSnapshot,
        saveProfile,
        profileName,
        existingMappingProfileId: item.mappingProfileId || ""
      });
      onMapped?.(updated);
      onClose?.();
    } catch (nextError) {
      setError(nextError?.message || "Unable to apply the portfolio column mapping.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Map portfolio columns">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close column mapping" />
      <section className="relative z-10 max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Columns3 size={20} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">GrowVest Standard / Generic Import</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Map provider columns</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Map this layout once. If you save the profile, GrowVest will auto-apply the same column structure on future uploads.</p>
              <p className="mt-2 text-xs font-semibold text-slate-600">{item.fileName} · {item.genericMapping?.sheetName || item.sheetName || "Selected sheet"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500"><X size={16} /></button>
        </div>

        <div className="grid gap-6 p-5 sm:p-6">
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-4">
            <Field label="Rows represent">
              <select className={inputClassName} value={rowMode} onChange={(event) => { const value = event.target.value; setRowMode(value); if (value === "transactions") setCompleteSnapshot(false); }}>
                <option value="holdings">Current holdings / positions</option>
                <option value="transactions">Transactions / ledger rows</option>
              </select>
            </Field>
            <Field label="Default investment type">
              <select className={inputClassName} value={defaults.productType} onChange={(event) => setDefaults((current) => ({ ...current, productType: event.target.value }))}>
                <option value="">Read from mapped column</option>
                {Object.entries(PORTFOLIO_PRODUCT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Default investment mode">
              <select className={inputClassName} value={defaults.investmentMode} onChange={(event) => setDefaults((current) => ({ ...current, investmentMode: event.target.value }))}>
                <option value="">Read from mapped column / blank</option>
                {GENERIC_INVESTMENT_MODES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Default transaction type">
              <select className={inputClassName} value={defaults.transactionType} onChange={(event) => setDefaults((current) => ({ ...current, transactionType: event.target.value }))}>
                <option value="">Read from mapped column / blank</option>
                {GENERIC_TRANSACTION_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <div className="lg:col-span-2">
              <Field label="Default provider / broker">
                <input className={inputClassName} value={defaults.provider} onChange={(event) => setDefaults((current) => ({ ...current, provider: event.target.value }))} placeholder="Example: XYZ PMS / ABC Bank" />
              </Field>
            </div>
            <div className="flex items-end lg:col-span-2">
              <label className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={completeSnapshot} disabled={rowMode === "transactions"} onChange={(event) => setCompleteSnapshot(event.target.checked)} className="h-4 w-4 rounded border-slate-300 disabled:opacity-40" />
                {rowMode === "transactions" ? "Transaction files never replace current holdings" : "Treat this provider file as a complete current-holdings snapshot"}
              </label>
            </div>
          </div>

          {GROUPS.map(([group, label]) => {
            const fields = GENERIC_IMPORT_FIELD_DEFINITIONS.filter((field) => field.group === group);
            return (
              <section key={group} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{label}</p></div>
                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">{field.label}{field.required ? <span className="text-red-600"> *</span> : ""}</label>
                      <select className={inputClassName} value={mapping[field.key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}>
                        <option value="">Not mapped</option>
                        {headers.filter(Boolean).map((header) => <option key={`${field.key}_${header}`} value={header}>{header}</option>)}
                      </select>
                      {mapping[field.key] ? <p className="mt-1 truncate text-[11px] text-slate-400">Sample: {sampleText(selectedSample[field.key])}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-end">
            <label className="flex items-start gap-3 text-sm text-blue-950">
              <input type="checkbox" checked={saveProfile} onChange={(event) => setSaveProfile(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-blue-300" />
              <span><strong className="block">{item.mappingProfileId ? "Keep auto-applying this saved layout" : "Remember this column layout"}</strong><span className="mt-1 block text-xs leading-5 text-blue-700">Future files with the same header structure will be mapped automatically. Investor matching is still verified independently by PAN/client code/saved mapping.</span></span>
            </label>
            {saveProfile ? <Field label="Profile name"><input className={inputClassName} value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={defaults.provider || "Provider layout"} /></Field> : null}
          </div>

          <div className="rounded-xl bg-slate-950 p-4 text-xs text-slate-200">
            <div className="flex items-center gap-2 font-bold text-white"><CheckCircle2 size={15} /> Import validation</div>
            <p className="mt-2 leading-5">Required: Investment Type (mapped or default), an Investment Name or stable identifier (Symbol / ISIN / Account reference), and for holding rows either Current Value or Units/Quantity + Current NAV/Rate. PAN is recommended for safe automatic investor matching.</p>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:p-5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Apply Mapping</Button>
        </div>
      </section>
    </div>
  );
}
