"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  DEFAULT_INSURANCE_REMINDER_DAYS,
  INSURANCE_COVER_VARIANTS,
  INSURANCE_POLICY_STATUSES,
  INSURANCE_PREMIUM_FREQUENCIES,
  INSURANCE_TYPES
} from "@/lib/constants/insurance";

const EMPTY = {
  insuranceType: "Health", productName: "", insurer: "", policyNumber: "", policyHolder: "", insuredSubject: "",
  relationshipAssetDetail: "", coverVariant: "", policyStartDate: "", policyExpiryDate: "", coverAmount: "", premiumAmount: "",
  premiumFrequency: "Annual", nextPremiumDueDate: "", policyStatus: "Active", nominee: "", nomineeRelationship: "",
  policyTermYears: "", premiumPaymentTermYears: "", vehicleRegistrationNo: "", vehicleMakeModel: "", idv: "", ownDamageExpiry: "",
  thirdPartyExpiry: "", propertyAssetDetails: "", healthMembers: "", ridersAddOns: "", advisorBroker: "",
  reminderDays: DEFAULT_INSURANCE_REMINDER_DAYS, autoReminder: true, notes: "", investorVisible: true
};

function Input({ label, required, className = "", ...props }) {
  return <label className={`grid gap-1.5 text-sm font-semibold text-slate-700 ${className}`}><span>{label}{required ? <span className="text-red-500"> *</span> : null}</span><input {...props} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>;
}
function Select({ label, children, className = "", ...props }) {
  return <label className={`grid gap-1.5 text-sm font-semibold text-slate-700 ${className}`}><span>{label}</span><select {...props} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{children}</select></label>;
}
function TextArea({ label, className = "", ...props }) {
  return <label className={`grid gap-1.5 text-sm font-semibold text-slate-700 ${className}`}><span>{label}</span><textarea {...props} className="min-h-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>;
}

export default function InsurancePolicyForm({ open, policy, mode = "edit", investorName = "Investor", onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, ...(policy || {}), reminderDays: Array.isArray(policy?.reminderDays) ? policy.reminderDays : DEFAULT_INSURANCE_REMINDER_DAYS });
    setError("");
  }, [open, policy]);
  const type = form.insuranceType;
  const isLife = ["Term Life", "Whole Life", "Endowment", "ULIP Insurance"].includes(type);
  const isHealth = ["Health", "Critical Illness"].includes(type);
  const title = mode === "renew" ? "Renew insurance policy" : policy?.id ? "Edit insurance policy" : "Add insurance policy";
  const reminderText = useMemo(() => (form.reminderDays || []).join(", "), [form.reminderDays]);
  if (!open) return null;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await onSave(form); onClose(); } catch (nextError) { setError(nextError.message || "Insurance policy could not be saved."); } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Insurance & Protection</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{investorName} · Protection cover is tracked separately from investment corpus.</p></div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={19} /></button>
      </div>
      <div className="grid gap-6 p-5 sm:p-6">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
        <section><h3 className="font-heading text-lg font-bold text-slate-950">Policy identity</h3><div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Select label="Insurance type" value={form.insuranceType} onChange={(e) => set("insuranceType", e.target.value)}>{INSURANCE_TYPES.map((item) => <option key={item}>{item}</option>)}</Select>
          <Input label="Product / plan name" required value={form.productName} onChange={(e) => set("productName", e.target.value)} />
          <Input label="Insurer" required value={form.insurer} onChange={(e) => set("insurer", e.target.value)} />
          <Input label="Policy number" required value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} />
          <Input label="Policy holder" required value={form.policyHolder} onChange={(e) => set("policyHolder", e.target.value)} />
          <Input label="Insured person / asset" required value={form.insuredSubject} onChange={(e) => set("insuredSubject", e.target.value)} />
          <Input label="Relationship / asset detail" value={form.relationshipAssetDetail} onChange={(e) => set("relationshipAssetDetail", e.target.value)} />
          <Select label="Cover type / variant" value={form.coverVariant} onChange={(e) => set("coverVariant", e.target.value)}><option value="">Select</option>{INSURANCE_COVER_VARIANTS.map((item) => <option key={item}>{item}</option>)}</Select>
          <Select label="Policy status" value={form.policyStatus} onChange={(e) => set("policyStatus", e.target.value)}>{INSURANCE_POLICY_STATUSES.map((item) => <option key={item}>{item}</option>)}</Select>
        </div></section>
        <section><h3 className="font-heading text-lg font-bold text-slate-950">Cover, premium & dates</h3><div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Input label="Policy start date" type="date" value={form.policyStartDate || ""} onChange={(e) => set("policyStartDate", e.target.value)} />
          <Input label="Renewal / expiry date" type="date" value={form.policyExpiryDate || ""} onChange={(e) => set("policyExpiryDate", e.target.value)} />
          <Input label="Cover / sum insured (₹)" type="number" min="0" value={form.coverAmount} onChange={(e) => set("coverAmount", e.target.value)} />
          <Input label="Premium amount (₹)" type="number" min="0" value={form.premiumAmount} onChange={(e) => set("premiumAmount", e.target.value)} />
          <Select label="Premium frequency" value={form.premiumFrequency} onChange={(e) => set("premiumFrequency", e.target.value)}>{INSURANCE_PREMIUM_FREQUENCIES.map((item) => <option key={item}>{item}</option>)}</Select>
          <Input label="Next premium due" type="date" value={form.nextPremiumDueDate || ""} onChange={(e) => set("nextPremiumDueDate", e.target.value)} />
          <Input label="Advisor / broker" value={form.advisorBroker} onChange={(e) => set("advisorBroker", e.target.value)} className="lg:col-span-2" />
        </div></section>
        {isLife ? <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"><h3 className="font-heading text-lg font-bold text-slate-950">Life / term details</h3><div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Input label="Nominee / beneficiary" value={form.nominee} onChange={(e) => set("nominee", e.target.value)} />
          <Input label="Nominee relationship" value={form.nomineeRelationship} onChange={(e) => set("nomineeRelationship", e.target.value)} />
          <Input label="Policy term (years)" type="number" min="0" value={form.policyTermYears} onChange={(e) => set("policyTermYears", e.target.value)} />
          <Input label="Premium payment term (years)" type="number" min="0" value={form.premiumPaymentTermYears} onChange={(e) => set("premiumPaymentTermYears", e.target.value)} />
        </div></section> : null}
        {isHealth ? <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"><h3 className="font-heading text-lg font-bold text-slate-950">Health cover details</h3><TextArea label="Covered members / family floater details" value={form.healthMembers} onChange={(e) => set("healthMembers", e.target.value)} /></section> : null}
        {type === "Vehicle" ? <section className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4"><h3 className="font-heading text-lg font-bold text-slate-950">Vehicle insurance details</h3><div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input label="Vehicle registration no." value={form.vehicleRegistrationNo} onChange={(e) => set("vehicleRegistrationNo", e.target.value)} />
          <Input label="Vehicle make / model" value={form.vehicleMakeModel} onChange={(e) => set("vehicleMakeModel", e.target.value)} />
          <Input label="IDV (₹)" type="number" min="0" value={form.idv} onChange={(e) => set("idv", e.target.value)} />
          <Input label="Own Damage expiry" type="date" value={form.ownDamageExpiry || ""} onChange={(e) => set("ownDamageExpiry", e.target.value)} />
          <Input label="Third Party expiry" type="date" value={form.thirdPartyExpiry || ""} onChange={(e) => set("thirdPartyExpiry", e.target.value)} />
        </div></section> : null}
        {type === "Home" ? <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"><h3 className="font-heading text-lg font-bold text-slate-950">Home / property details</h3><TextArea label="Property address / asset details" value={form.propertyAssetDetails} onChange={(e) => set("propertyAssetDetails", e.target.value)} /></section> : null}
        <section><h3 className="font-heading text-lg font-bold text-slate-950">Reminders & notes</h3><div className="mt-3 grid gap-4 md:grid-cols-2">
          <Input label="Reminder days before due / expiry" value={reminderText} onChange={(e) => set("reminderDays", e.target.value.split(/[,;|]/).map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v >= 0))} placeholder="60, 30, 15, 7, 1" />
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.autoReminder !== false} onChange={(e) => set("autoReminder", e.target.checked)} /> Auto renewal / premium reminders</label>
          <TextArea label="Riders / add-ons" value={form.ridersAddOns} onChange={(e) => set("ridersAddOns", e.target.value)} />
          <TextArea label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div></section>
      </div>
      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving} className="min-h-11 rounded-lg bg-[#1F4ED8] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : mode === "renew" ? "Create renewal" : "Save policy"}</button></div>
    </form>
  </div>;
}
