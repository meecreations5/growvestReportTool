"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, CalendarClock, ChevronRight, Edit3, FileUp, HeartPulse, Home, Plus, RefreshCcw, ShieldCheck, Umbrella, CarFront } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { insurancePolicyOperationalStatus, nearestInsuranceDue } from "@/lib/constants/insurance";
import { getInsurancePolicies, renewInsurancePolicy, saveInsurancePolicy, updateInsurancePolicyStatus } from "@/services/insuranceService";
import { requestInvestorDocument, uploadInvestorDocument } from "@/services/documentService";
import InsurancePolicyForm from "@/components/insurance/InsurancePolicyForm";
import { MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";
import { ProgressRing } from "@/components/investor/mobile/MobileFinanceCharts";

function compactCurrency(value) {
  const amount = Number(value || 0); if (!amount) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount % 10000000 ? 1 : 0)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 ? 1 : 0)} L`;
  return formatCurrency(amount);
}
function tone(status) {
  if (status === "Active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["Expiring Soon", "Premium Due", "Grace Period"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["Expired", "Lapsed", "Cancelled"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
function typeIcon(type) { return type === "Vehicle" ? CarFront : type === "Home" ? Home : ["Health", "Critical Illness"].includes(type) ? HeartPulse : Umbrella; }


function MobileProtectionAppView({ summary = {}, policies = [], error = "" }) {
  const activePolicies = policies.filter((policy) => !["Renewed", "Cancelled", "Claimed / Closed"].includes(policy.policyStatus));
  const nextDue = summary.nextDue || null;
  const lifeCover = Number(summary.lifeCover || 0);
  const healthCover = Number(summary.healthCover || 0);
  const vehicleCount = activePolicies.filter((policy) => policy.insuranceType === "Vehicle").length;
  const homeCount = activePolicies.filter((policy) => policy.insuranceType === "Home").length;
  const lifeCount = activePolicies.filter((policy) => ["Term Life", "Whole Life", "Endowment", "ULIP Insurance"].includes(policy.insuranceType)).length;
  const healthCount = activePolicies.filter((policy) => ["Health", "Critical Illness", "Personal Accident"].includes(policy.insuranceType)).length;
  const coveredAreas = [lifeCover > 0 || lifeCount > 0, healthCover > 0 || healthCount > 0, vehicleCount > 0, homeCount > 0].filter(Boolean).length;
  const setupProgress = coveredAreas / 4 * 100;

  const coverRows = [
    { label: "Life Insurance", value: compactCurrency(lifeCover), helper: lifeCount ? `${lifeCount} active polic${lifeCount === 1 ? "y" : "ies"}` : "Not added yet", Icon: Umbrella, active: lifeCover > 0 || lifeCount > 0, privateValue: true },
    { label: "Health Insurance", value: compactCurrency(healthCover), helper: healthCount ? `${healthCount} active polic${healthCount === 1 ? "y" : "ies"}` : "Not added yet", Icon: HeartPulse, active: healthCover > 0 || healthCount > 0, privateValue: true },
    { label: "Vehicle Insurance", value: vehicleCount ? `${vehicleCount} polic${vehicleCount === 1 ? "y" : "ies"}` : "Not added", helper: vehicleCount ? "Recorded in GrowVest" : "Add vehicle policy", Icon: CarFront, active: vehicleCount > 0 },
    { label: "Home Insurance", value: homeCount ? `${homeCount} polic${homeCount === 1 ? "y" : "ies"}` : "Not added", helper: homeCount ? "Recorded in GrowVest" : "Add home policy", Icon: Home, active: homeCount > 0 }
  ];

  return (
    <div className="gv-mobile-app-stack md:hidden">
      {error ? <div className="rounded-[16px] border border-[#E53935]/20 bg-[#E53935]/5 p-4 text-xs font-semibold text-[#B42318]">{error}</div> : null}

      <section className="px-0.5 pt-1">
        <h1 className="font-heading text-[1.55rem] font-bold leading-none text-[#0B0B0F]">Protection</h1>
        <p className="mt-2 text-[12px] leading-5 text-[#6B7280]">Financial security for the people and things that matter to you.</p>
      </section>

      <section className="rounded-[18px] bg-[#F4F6F9] p-4">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-white p-1"><ProgressRing value={setupProgress} size={70} stroke={7} label={`${coveredAreas}/4`} /></div>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#1F4ED8]">Protection Setup</p><h2 className="mt-1 font-heading text-[1.02rem] font-bold text-[#0B0B0F]">{coveredAreas} of 4 important areas recorded</h2><p className="mt-1 text-[10px] leading-4 text-[#6B7280]">This is a record-completeness view, not an adequacy score.</p></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
        {coverRows.map((item, index) => <div key={item.label} className={`flex min-h-[64px] items-center gap-3 px-4 py-3 ${index ? "border-t border-slate-100" : ""}`}><item.Icon size={20} strokeWidth={1.5} className={`shrink-0 ${item.active ? "text-[#1F4ED8]" : "text-[#6B7280]"}`} /><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#0B0B0F]">{item.label}</span><span className="mt-0.5 block text-[10px] text-[#6B7280]">{item.helper}</span></span><span className={`${item.privateValue ? "gv-private-value " : ""}shrink-0 text-[11px] font-semibold ${item.active ? "text-[#0B0B0F]" : "text-[#6B7280]"}`}>{item.value}</span></div>)}
      </section>

      {nextDue ? <section className={`flex items-center gap-3 rounded-[18px] border p-4 ${Number(nextDue.daysUntil) < 0 ? "border-[#E53935]/25 bg-[#E53935]/5" : Number(nextDue.daysUntil) <= 30 ? "border-[#F5B301]/35 bg-[#F5B301]/8" : "border-slate-200 bg-white"}`}><BellRing size={20} strokeWidth={1.5} className={`shrink-0 ${Number(nextDue.daysUntil) < 0 ? "text-[#E53935]" : Number(nextDue.daysUntil) <= 30 ? "text-[#A66F00]" : "text-[#1F4ED8]"}`} /><div className="min-w-0 flex-1"><p className="text-[10px] text-[#6B7280]">Upcoming Renewal</p><p className="mt-0.5 truncate text-[12px] font-bold text-[#0B0B0F]">{nextDue.label || "Policy due"}</p><p className="mt-0.5 text-[10px] text-[#6B7280]">{formatDate(nextDue.date)} · {Number(nextDue.daysUntil) < 0 ? `${Math.abs(Number(nextDue.daysUntil))} days overdue` : `in ${Number(nextDue.daysUntil)} days`}</p></div><ChevronRight size={16} strokeWidth={1.5} className="text-slate-300" /></section> : null}

      <section>
        <div className="mb-2.5 flex items-center justify-between"><div><h2 className="font-heading text-[1.12rem] font-bold text-[#0B0B0F]">Your Policies</h2><p className="mt-0.5 text-[11px] text-[#6B7280]">Protection details recorded with GrowVest</p></div><span className="text-[10px] text-[#6B7280]">{activePolicies.length} active</span></div>
        {activePolicies.length ? <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">{activePolicies.map((policy, index) => { const status = insurancePolicyOperationalStatus(policy); const due = nearestInsuranceDue(policy); const Icon = typeIcon(policy.insuranceType); const warning = ["Expiring Soon", "Premium Due", "Grace Period"].includes(status); const critical = ["Expired", "Lapsed", "Cancelled"].includes(status); const statusClass = critical ? "text-[#E53935]" : warning ? "text-[#8A5B00]" : "text-[#1F4ED8]"; return <article key={policy.id} className={`px-4 py-4 ${index ? "border-t border-slate-100" : ""}`}><div className="flex items-start gap-3"><Icon size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#1F4ED8]" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="line-clamp-1 font-heading text-[14px] font-bold text-[#0B0B0F]">{policy.productName || `${policy.insuranceType} Insurance`}</h3><p className="mt-0.5 truncate text-[10px] text-[#6B7280]">{policy.insurer || "Insurance provider"}</p></div><span className={`shrink-0 text-[9px] font-semibold ${statusClass}`}>{status}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[#6B7280]"><span>Cover <strong className="gv-private-value text-[#0B0B0F]">{compactCurrency(policy.coverAmount || policy.idv)}</strong></span><span>Premium <strong className="gv-private-value text-[#0B0B0F]">{compactCurrency(policy.premiumAmount)}</strong></span></div>{due ? <p className={`mt-2 text-[10px] font-medium ${due.daysUntil !== null && due.daysUntil < 0 ? "text-[#E53935]" : due.daysUntil !== null && due.daysUntil <= 30 ? "text-[#8A5B00]" : "text-[#6B7280]"}`}>{due.label} · {formatDate(due.date)}{due.daysUntil !== null ? ` · ${due.daysUntil < 0 ? `${Math.abs(due.daysUntil)}d overdue` : `${due.daysUntil}d`}` : ""}</p> : null}</div></div></article>; })}</div> : <MobileEmptyState icon={ShieldCheck} title="No protection policies added yet" copy="Add your life, health, vehicle or home policies to build a complete protection view." />}
      </section>
    </div>
  );
}

export default function InsuranceProtectionPanel({ investor, editable = false, portal = false, compact = false }) {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState([]); const [snapshot, setSnapshot] = useState({ summary: {} });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [working, setWorking] = useState("");
  const [formState, setFormState] = useState({ open: false, policy: null, mode: "edit" });
  const fileInput = useRef(null); const uploadPolicyRef = useRef(null);
  const investorId = investor?.id || "";
  const load = useCallback(async () => {
    if (!investorId && !portal) return;
    setLoading(true); setError("");
    try { const result = await getInsurancePolicies(investorId); setPolicies(result.policies || []); setSnapshot(result.protectionSnapshot || { summary: {} }); }
    catch (nextError) { console.error(nextError); setError(nextError.message || "Insurance policies could not be loaded."); }
    finally { setLoading(false); }
  }, [investorId, portal]);
  useEffect(() => { load(); }, [load]);
  const summary = snapshot.summary || {};
  const active = useMemo(() => policies.filter((p) => !["Renewed", "Cancelled", "Claimed / Closed"].includes(p.policyStatus)), [policies]);

  const save = async (form) => {
    if (formState.mode === "renew" && formState.policy?.id) await renewInsurancePolicy(formState.policy.id, form);
    else await saveInsurancePolicy(investorId, form, formState.policy?.id || "");
    await load();
  };
  const changeStatus = async (policy, status) => { setWorking(policy.id); try { await updateInsurancePolicyStatus(policy.id, status); await load(); } catch (e) { setError(e.message); } finally { setWorking(""); } };
  const beginUpload = (policy) => { uploadPolicyRef.current = policy; fileInput.current?.click(); };
  const handleFile = async (event) => {
    const file = event.target.files?.[0]; const policy = uploadPolicyRef.current; event.target.value = "";
    if (!file || !policy || !investor || !profile) return;
    setWorking(policy.id); setError("");
    try {
      const documentId = await requestInvestorDocument(investor, profile, {
        title: `${policy.insuranceType || "Insurance"} - ${policy.productName || policy.policyNumber}`,
        documentType: "Insurance Policy",
        notes: `Linked insurance policy ${policy.policyNumber || ""}`,
        insurancePolicyId: policy.id,
        insurancePolicyNumber: policy.policyNumber || "",
        sourceType: "insurance_policy"
      });
      await uploadInvestorDocument({ id: documentId, investorId: investor.id, title: policy.productName, investorUid: investor.investorPortalUid || investor.portalUid || null }, file, profile);
    } catch (e) { setError(e.message || "Policy document could not be uploaded."); } finally { setWorking(""); }
  };

  if (loading) return <div className="grid gap-4"><div className="gv-skeleton h-28 rounded-2xl"/><div className="gv-skeleton h-52 rounded-2xl"/></div>;
  return <>
    {portal ? <MobileProtectionAppView summary={summary} policies={policies} error={error} /> : null}
    <div className={`${portal ? "hidden md:grid" : "grid"} gap-5`}>
    <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={handleFile} />
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Protection overview</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Insurance & Protection</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Life, health, vehicle, home and other protection policies. Cover amounts are intentionally excluded from investment portfolio corpus.</p></div>{editable ? <button onClick={() => setFormState({ open: true, policy: null, mode: "edit" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-4 text-sm font-bold text-white"><Plus size={17}/> Add Policy</button> : null}</div>
      <div className={`mt-5 grid grid-cols-2 gap-3 ${compact ? "lg:grid-cols-4" : "xl:grid-cols-5"}`}>
        {[
          ["Active policies", summary.activePolicyCount || 0, ShieldCheck], ["Life cover", compactCurrency(summary.lifeCover), Umbrella], ["Health cover", compactCurrency(summary.healthCover), HeartPulse], ["Expiring ≤30 days", summary.policiesExpiringWithin30Days || 0, CalendarClock], ["Premiums due ≤30 days", summary.premiumsDueWithin30Days || 0, BellRing]
        ].map(([label, value, Icon]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><Icon size={18} className="text-blue-700"/><p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-heading text-xl font-bold text-slate-950 tabular-nums">{value}</p></div>)}
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-heading text-xl font-bold text-slate-950">Policies</h3><p className="mt-1 text-sm text-slate-500">Renewal history is preserved. A renewed policy creates a new linked record.</p></div><button onClick={load} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500" title="Refresh"><RefreshCcw size={16}/></button></div>
      <div className="mt-4 grid gap-3">
        {active.length ? active.map((policy) => {
          const status = insurancePolicyOperationalStatus(policy); const due = nearestInsuranceDue(policy); const Icon = typeIcon(policy.insuranceType);
          return <article key={policy.id} className="rounded-xl border border-slate-200 p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={20}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-heading text-lg font-bold text-slate-950">{policy.productName || "Insurance Policy"}</h4><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone(status)}`}>{status}</span></div><p className="mt-1 text-sm font-semibold text-blue-700">{policy.insuranceType} · {policy.insurer}</p><p className="mt-1 text-xs text-slate-500">Policy {policy.policyNumber} · {policy.insuredSubject}</p></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:min-w-[340px]"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cover</p><p className="font-bold text-slate-900">{compactCurrency(policy.coverAmount || policy.idv)}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Premium</p><p className="font-bold text-slate-900">{compactCurrency(policy.premiumAmount)} {policy.premiumFrequency ? `/ ${policy.premiumFrequency}` : ""}</p></div><div className="col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Next due</p><p className={`font-semibold ${due?.daysUntil !== null && due?.daysUntil <= 30 ? "text-amber-700" : "text-slate-800"}`}>{due ? `${due.label} · ${formatDate(due.date)}${due.daysUntil !== null ? ` · ${due.daysUntil < 0 ? `${Math.abs(due.daysUntil)} days overdue` : `in ${due.daysUntil} days`}` : ""}` : "No upcoming date recorded"}</p></div></div></div>
            {policy.healthMembers || policy.vehicleRegistrationNo || policy.propertyAssetDetails || policy.ridersAddOns ? <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 sm:grid-cols-2">{policy.healthMembers ? <p><strong>Covered:</strong> {policy.healthMembers}</p> : null}{policy.vehicleRegistrationNo ? <p><strong>Vehicle:</strong> {policy.vehicleRegistrationNo} {policy.vehicleMakeModel ? `· ${policy.vehicleMakeModel}` : ""}</p> : null}{policy.propertyAssetDetails ? <p><strong>Property:</strong> {policy.propertyAssetDetails}</p> : null}{policy.ridersAddOns ? <p><strong>Riders / add-ons:</strong> {policy.ridersAddOns}</p> : null}</div> : null}
            {editable ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button onClick={() => setFormState({ open: true, policy, mode: "edit" })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700"><Edit3 size={14}/> Edit</button><button onClick={() => setFormState({ open: true, policy: { ...policy, id: policy.id, policyNumber: "", policyStatus: "Active", policyStartDate: "", policyExpiryDate: "", nextPremiumDueDate: "" }, mode: "renew" })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700"><RefreshCcw size={14}/> Renew</button><button disabled={working === policy.id} onClick={() => beginUpload(policy)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"><FileUp size={14}/> Policy document</button><select value={policy.policyStatus || "Active"} onChange={(e) => changeStatus(policy, e.target.value)} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"><option>Active</option><option>Grace Period</option><option>Lapsed</option><option>Cancelled</option><option>Claimed / Closed</option></select></div> : null}
          </article>;
        }) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><ShieldCheck size={28} className="mx-auto text-slate-300"/><p className="mt-3 font-semibold text-slate-700">No insurance policies added yet.</p><p className="mt-1 text-sm text-slate-500">Add manually or upload the GrowVest Insurance workbook.</p></div>}
      </div>
      {policies.some((p) => p.policyStatus === "Renewed") ? <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-bold text-slate-700">Renewal history ({policies.filter((p) => p.policyStatus === "Renewed").length})</summary><div className="mt-3 grid gap-2">{policies.filter((p) => p.policyStatus === "Renewed").map((p) => <div key={p.id} className="rounded-lg bg-white p-3 text-sm"><strong>{p.productName}</strong> · {p.policyNumber} · {p.insurer} <span className="text-slate-500">({formatDate(p.policyExpiryDate)})</span></div>)}</div></details> : null}
    </section>
    <InsurancePolicyForm open={formState.open} policy={formState.policy} mode={formState.mode} investorName={investor?.fullName || investor?.name || "Investor"} onClose={() => setFormState({ open: false, policy: null, mode: "edit" })} onSave={save} />
    </div>
  </>;
}
