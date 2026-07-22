"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  INVESTMENT_FREQUENCIES,
  INVESTMENT_TYPES,
  PRODUCTS_OF_INTEREST
} from "@/lib/constants/assessment";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";

export default function InvestmentPreferencesEditor({
  rows,
  errors = {},
  disabled = false,
  onAdd,
  onRemove,
  onChange
}) {
  function toggleProduct(index, product) {
    const selected = rows[index]?.productsOfInterest || [];
    const next = selected.includes(product)
      ? selected.filter((item) => item !== product)
      : [...selected, product];
    onChange(index, "productsOfInterest", next);
  }

  return (
    <div className="grid gap-4">
      {rows.length ? rows.map((item, index) => (
        <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-slate-950">Preference {index + 1}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Define a separate contribution plan and its advisory areas.</p>
            </div>
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} /> Remove
              </button>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Investment type" required error={errors[`investmentPreferences.${index}.investmentType`]}>
              <select className={inputClassName} value={item.investmentType || ""} onChange={(event) => onChange(index, "investmentType", event.target.value)} disabled={disabled}>
                <option value="">Select type</option>
                {INVESTMENT_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Preferred frequency" required error={errors[`investmentPreferences.${index}.preferredFrequency`]}>
              <select className={inputClassName} value={item.preferredFrequency || "Monthly"} onChange={(event) => onChange(index, "preferredFrequency", event.target.value)} disabled={disabled}>
                <option value="">Select frequency</option>
                {INVESTMENT_FREQUENCIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Monthly SIP amount (INR)" error={errors[`investmentPreferences.${index}.sipAmount`]}>
              <input className={inputClassName} type="number" min="0" value={item.sipAmount ?? ""} onChange={(event) => onChange(index, "sipAmount", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Lump sum amount (INR)" error={errors[`investmentPreferences.${index}.lumpSumAmount`]}>
              <input className={inputClassName} type="number" min="0" value={item.lumpSumAmount ?? ""} onChange={(event) => onChange(index, "lumpSumAmount", event.target.value)} disabled={disabled} />
            </Field>
          </div>

          <div className="mt-6">
            <p className="text-sm font-bold text-slate-800">Advisory areas of interest</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PRODUCTS_OF_INTEREST.map((product) => {
                const selected = (item.productsOfInterest || []).includes(product);
                return (
                  <button
                    key={product}
                    type="button"
                    onClick={() => toggleProduct(index, product)}
                    disabled={disabled}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-100" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50"}`}
                  >
                    {selected ? "✓ " : ""}{product}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No investment preferences added.</div>
      )}

      <Button type="button" variant="secondary" onClick={onAdd} disabled={disabled} className="w-fit">
        <Plus size={17} /> Add another preference
      </Button>
    </div>
  );
}
