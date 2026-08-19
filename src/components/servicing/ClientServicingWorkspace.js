"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus, RefreshCcw, UsersRound, MessageSquareText} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import {
  createServicingRecord,
  subscribeServicingRecords,
  updateServicingRecord
} from "@/services/servicingService";
import {
  ADDENDUM_CATEGORIES,
  QUERY_STATUSES,
  QUERY_TYPES,
  SERVICING_TABS,
  TAT_RULES
} from "@/lib/constants/servicing";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import SegmentedTabs from "@/components/ui/SegmentedTabs";

const initialForms = {
  master: {
    investorId: "",
    activationDate: "",
    serviceStatus: "ACTIVE",
    contractStart: "",
    contractEnd: "",
    preferredChannel: "WhatsApp",
    reviewFrequencyDays: 90,
    nextReviewDate: "",
    monthlyUpdateRequired: true,
    renewalRequired: true,
    notes: ""
  },
  queries: { investorId: "", receivedAt: "", queryType: "general", status: "Open", resolvedAt: "", resolvedBy: "", addendumCategory: "", notes: "" },
  monthly: { investorId: "", monthKey: "", activationDate: "", whatsappSentDate: "", emailSentDate: "", clientAcknowledged: false, addendumCategory: "", notes: "" },
  quarterly: { investorId: "", reviewDate: "", reviewHeld: true, recapSentAt: "", rebalancingRequired: false, rebalancingRequestedAt: "", rebalancingDoneAt: "", outcome: "", notes: "" },
  renewals: { investorId: "", contractEnd: "", flagRaised: false, conversationHeld: false, clientResponse: "", responseDate: "", followUp1Date: "", followUp2Date: "", status: "Open", notes: "" },
  addendum: { investorId: "", sopStep: "", originalDeadline: "", breachDate: "", category: "A", natureOfMiss: "", actionTaken: "", followUp1Date: "", followUp2Date: "", status: "Open", resolution: "", resolvedAt: "", notes: "" },
  checklist: { investorId: "", period: "", whatsappSent: false, emailSent: false, clientAcknowledged: false, delayLogged: false, queryLogged: false, queryResolved: false, queryTatMet: false, addendumLogged: false, inviteSent: false, reviewHeld: false, recapSent: false, rebalancingDone: false, flagRaised: false, conversationHeld: false, documentsReceived: false, signed: false }
};

function toInputDateTime(value) {
  if (!value) return "";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700"
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${tones[tone] || tones.slate}`}>{children}</span>;
}

function InvestorSelect({ investors, value, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName} required>
      <option value="">Select Investor</option>
      {investors.map((investor) => <option key={investor.id} value={investor.id}>{investor.clientCode || "—"} · {investor.fullName}</option>)}
    </select>
  );
}

function Kpi({ label, value, icon: Icon, tone = "blue" }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700"
  };
  return (
    <Card className="p-5">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${styles[tone]}`}><Icon size={19} /></div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}

function EmptyState({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export default function ClientServicingWorkspace() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [investors, setInvestors] = useState([]);
  const [records, setRecords] = useState({ master: [], queries: [], monthly: [], quarterly: [], renewals: [], addendum: [], checklist: [] });
  const [forms, setForms] = useState(initialForms);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!profile?.id) return undefined;
    const unsubscribers = [
      subscribeInvestors(profile, setInvestors, (nextError) => setError(nextError.message)),
      ...Object.keys(records).map((type) => subscribeServicingRecords(type, profile, (items) => setRecords((current) => ({ ...current, [type]: items })), (nextError) => setError(nextError.message)))
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  const summary = useMemo(() => {
    const activeClients = records.master.filter((item) => item.serviceStatus === "ACTIVE").length;
    const openQueries = records.queries.filter((item) => !["Resolved", "Closed"].includes(item.status)).length;
    const queryBreaches = records.queries.filter((item) => item.tatBreached).length;
    const updateBreaches = records.monthly.filter((item) => item.whatsappTatBreached || item.emailTatBreached).length;
    const reviewBreaches = records.quarterly.filter((item) => item.recapTatBreached || item.rebalancingTatBreached).length;
    const renewalsDue = records.renewals.filter((item) => Number(item.daysToRenewal) <= 60 && Number(item.daysToRenewal) >= 0 && item.status !== "Renewed").length;
    const openMisses = records.addendum.filter((item) => item.status !== "Resolved").length;
    return { activeClients, openQueries, queryBreaches, updateBreaches, reviewBreaches, renewalsDue, openMisses };
  }, [records]);

  function setField(type, field, value) {
    setForms((current) => ({ ...current, [type]: { ...current[type], [field]: value } }));
  }

  function investorPayload(investorId) {
    const investor = investors.find((item) => item.id === investorId);
    if (!investor) throw new Error("Select an Investor.");
    return {
      investorId: investor.id,
      clientCode: investor.clientCode || "",
      investorName: investor.fullName || "",
      advisorUid: investor.advisorUid || investor.assignedAdvisorUid || profile.id,
      advisorName: investor.advisorName || investor.assignedAdvisorName || profile.fullName
    };
  }

  async function submit(type, event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const form = forms[type];
      await createServicingRecord(type, { ...form, ...investorPayload(form.investorId) }, profile);
      setForms((current) => ({ ...current, [type]: { ...initialForms[type] } }));
      setNotice("Service record saved successfully.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  async function markQueryResolved(item) {
    setWorking(true);
    try {
      await updateServicingRecord("queries", item.id, { ...item, status: "Resolved", resolvedAt: new Date().toISOString(), resolvedBy: profile.fullName });
      setNotice("Query marked as resolved.");
    } catch (nextError) { setError(nextError.message); } finally { setWorking(false); }
  }

  async function resolveMiss(item) {
    setWorking(true);
    try {
      await updateServicingRecord("addendum", item.id, { ...item, status: "Resolved", resolvedAt: new Date().toISOString(), resolution: item.resolution || "Resolved by Advisor" });
      setNotice("Deadline miss marked as resolved.");
    } catch (nextError) { setError(nextError.message); } finally { setWorking(false); }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Investor operations"
        title="Service Requests"
        description="Operational help for bank, KYC, mandate, document, renewal and other investor service needs. Investment decisions stay in Advisor Follow-up."
      />

      <SegmentedTabs
        ariaLabel="Service request sections"
        value={activeTab}
        onChange={setActiveTab}
        items={SERVICING_TABS.map((tab) => ({
          value: tab.key,
          label: tab.label,
          count: tab.key === "queries" ? summary.openQueries : tab.key === "renewals" ? summary.renewalsDue : tab.key === "addendum" ? summary.openMisses : undefined
        }))}
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      {activeTab === "overview" ? (
        <div className="grid gap-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Active clients" value={summary.activeClients} helper="In an active servicing cycle" icon={UsersRound} tone="green" />
            <MetricCard label="Open queries" value={summary.openQueries} helper={`${summary.queryBreaches} TAT breach${summary.queryBreaches === 1 ? "" : "es"}`} icon={MessageSquareText} tone={summary.queryBreaches ? "red" : "blue"} />
            <MetricCard label="Reviews & updates" value={summary.updateBreaches + summary.reviewBreaches} helper="Communication or review breaches" icon={RefreshCcw} tone={(summary.updateBreaches + summary.reviewBreaches) ? "amber" : "green"} />
            <MetricCard label="Renewal attention" value={summary.renewalsDue + summary.openMisses} helper={`${summary.renewalsDue} due · ${summary.openMisses} escalation${summary.openMisses === 1 ? "" : "s"}`} icon={AlertTriangle} tone={(summary.renewalsDue + summary.openMisses) ? "amber" : "green"} />
          </section>

          {(summary.queryBreaches || summary.updateBreaches || summary.reviewBreaches || summary.openMisses) ? (
            <Card className="overflow-hidden border-amber-200">
              <div className="flex items-start gap-3 bg-amber-50 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><AlertTriangle size={19} /></span><div><h2 className="font-heading text-xl text-amber-950">Priority servicing queue</h2><p className="mt-1 text-sm leading-6 text-amber-900/75">Resolve breached queries, missed communication cycles and open Addendum A escalations before routine servicing work.</p></div></div>
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4"><button type="button" onClick={() => setActiveTab("queries")} className="rounded-xl border border-slate-200 p-3 text-left"><span className="text-xs text-slate-500">Query breaches</span><strong className="mt-1 block text-xl text-red-700">{summary.queryBreaches}</strong></button><button type="button" onClick={() => setActiveTab("monthly")} className="rounded-xl border border-slate-200 p-3 text-left"><span className="text-xs text-slate-500">Update breaches</span><strong className="mt-1 block text-xl text-amber-700">{summary.updateBreaches}</strong></button><button type="button" onClick={() => setActiveTab("quarterly")} className="rounded-xl border border-slate-200 p-3 text-left"><span className="text-xs text-slate-500">Review breaches</span><strong className="mt-1 block text-xl text-red-700">{summary.reviewBreaches}</strong></button><button type="button" onClick={() => setActiveTab("addendum")} className="rounded-xl border border-slate-200 p-3 text-left"><span className="text-xs text-slate-500">Open misses</span><strong className="mt-1 block text-xl text-red-700">{summary.openMisses}</strong></button></div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <div className="flex items-start gap-3 border-b border-slate-200 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><ClipboardCheck size={19} /></span><div><h2 className="font-heading text-xl">11-rule TAT monitor</h2><p className="mt-1 text-sm text-slate-500">The operational deadlines preserved from SOP 3.</p></div></div>
            <div className="grid gap-3 p-4 md:hidden">{TAT_RULES.map((item, index) => <div key={item.rule} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-blue-700">{String(index + 1).padStart(2, "0")} · {item.area}</span><StatusPill tone="blue">{item.limit}</StatusPill></div><p className="mt-2 text-sm font-semibold text-slate-900">{item.rule}</p></div>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">#</th><th className="px-5 py-3">Servicing area</th><th className="px-5 py-3">Rule</th><th className="px-5 py-3">Limit</th></tr></thead><tbody className="divide-y divide-slate-100">{TAT_RULES.map((item, index) => <tr key={item.rule}><td className="px-5 py-3 font-bold text-blue-700">{String(index + 1).padStart(2, "0")}</td><td className="px-5 py-3 font-semibold text-slate-900">{item.area}</td><td className="px-5 py-3 text-slate-600">{item.rule}</td><td className="px-5 py-3"><StatusPill tone="blue">{item.limit}</StatusPill></td></tr>)}</tbody></table></div>
          </Card>
        </div>
      ) : null}

      {activeTab === "master" ? <ClientMasterTab investors={investors} form={forms.master} setField={setField} submit={submit} working={working} records={records.master} /> : null}

      {activeTab === "queries" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="p-5"><h2 className="text-lg font-black">Log client query</h2><form onSubmit={(event) => submit("queries", event)} className="mt-4 grid gap-3"><InvestorSelect investors={investors} value={forms.queries.investorId} onChange={(value) => setField("queries", "investorId", value)} /><input type="datetime-local" value={forms.queries.receivedAt} onChange={(event) => setField("queries", "receivedAt", event.target.value)} className={inputClassName} required /><select value={forms.queries.queryType} onChange={(event) => setField("queries", "queryType", event.target.value)} className={inputClassName}>{QUERY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.limitHours} hr</option>)}</select><select value={forms.queries.status} onChange={(event) => setField("queries", "status", event.target.value)} className={inputClassName}>{QUERY_STATUSES.map((item) => <option key={item}>{item}</option>)}</select><textarea value={forms.queries.notes} onChange={(event) => setField("queries", "notes", event.target.value)} placeholder="Query details and notes" className={`${inputClassName} min-h-24`} /><Button disabled={working}><Plus size={16} /> Save Query</Button></form></Card>
          <Card className="overflow-hidden"><div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="font-heading text-xl">Query log</h2><p className="mt-1 text-sm text-slate-500">Prioritised by query type, response deadline and resolution status.</p></div><StatusPill tone={summary.queryBreaches ? "red" : "green"}>{summary.queryBreaches ? `${summary.queryBreaches} breach${summary.queryBreaches === 1 ? "" : "es"}` : "Within TAT"}</StatusPill></div>{records.queries.length ? <><div className="grid gap-3 p-4 md:hidden">{records.queries.map((item) => <article key={item.id} className={`rounded-2xl border p-4 ${item.tatBreached ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{item.investorName}</p><p className="text-xs text-slate-500">{item.clientCode} · {formatDateTime(item.receivedAt)}</p></div><StatusPill tone={item.tatBreached ? "red" : "green"}>{item.tatBreached ? "TAT BREACH" : `${item.tatLimitHours} hr`}</StatusPill></div><p className="mt-3 text-sm font-semibold text-slate-800">{QUERY_TYPES.find((type) => type.value === item.queryType)?.label || item.queryType}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.notes || "No query notes."}</p><div className="mt-3 flex items-center justify-between"><StatusPill tone={["Resolved", "Closed"].includes(item.status) ? "green" : "amber"}>{item.status}</StatusPill>{!["Resolved", "Closed"].includes(item.status) ? <button type="button" onClick={() => markQueryResolved(item)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Mark resolved</button> : null}</div></article>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Investor</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Limit</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">TAT</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{records.queries.map((item) => <tr key={item.id}><td className="px-4 py-3"><p className="font-bold">{item.investorName}</p><p className="text-xs text-slate-400">{item.clientCode}</p></td><td className="px-4 py-3">{formatDateTime(item.receivedAt)}</td><td className="px-4 py-3">{QUERY_TYPES.find((type) => type.value === item.queryType)?.label || item.queryType}</td><td className="px-4 py-3">{item.tatLimitHours} hr</td><td className="px-4 py-3"><StatusPill tone={["Resolved", "Closed"].includes(item.status) ? "green" : "amber"}>{item.status}</StatusPill></td><td className="px-4 py-3"><StatusPill tone={item.tatBreached ? "red" : "green"}>{item.tatBreached ? "BREACH" : "Within TAT"}</StatusPill></td><td className="px-4 py-3">{!["Resolved", "Closed"].includes(item.status) ? <button type="button" onClick={() => markQueryResolved(item)} className="text-xs font-bold text-blue-700">Mark Resolved</button> : "—"}</td></tr>)}</tbody></table></div></> : <EmptyState>No client queries logged.</EmptyState>}</Card>
        </div>
      ) : null}

      {activeTab === "monthly" ? <MonthlyTab investors={investors} form={forms.monthly} setField={setField} submit={submit} working={working} records={records.monthly} /> : null}
      {activeTab === "quarterly" ? <QuarterlyTab investors={investors} form={forms.quarterly} setField={setField} submit={submit} working={working} records={records.quarterly} /> : null}
      {activeTab === "renewals" ? <RenewalTab investors={investors} form={forms.renewals} setField={setField} submit={submit} working={working} records={records.renewals} /> : null}
      {activeTab === "addendum" ? <AddendumTab investors={investors} form={forms.addendum} setField={setField} submit={submit} working={working} records={records.addendum} resolveMiss={resolveMiss} /> : null}
      {activeTab === "checklist" ? <ChecklistTab investors={investors} form={forms.checklist} setField={setField} submit={submit} working={working} records={records.checklist} /> : null}
    </div>
  );
}

function ClientMasterTab({ investors, form, setField, submit, working, records }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card className="p-5">
        <h2 className="text-lg font-black text-slate-950">Service setup</h2>
        <p className="mt-1 text-sm text-slate-500">Create the servicing baseline used for monthly updates, reviews, renewals and escalation tracking.</p>
        <form onSubmit={(event) => submit("master", event)} className="mt-5 grid gap-3">
          <InvestorSelect investors={investors} value={form.investorId} onChange={(value) => setField("master", "investorId", value)} />
          <label className="text-xs font-bold text-slate-500">Activation date<input type="date" value={form.activationDate} onChange={(event) => setField("master", "activationDate", event.target.value)} className={`${inputClassName} mt-1`} required /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-500">Service status<select value={form.serviceStatus} onChange={(event) => setField("master", "serviceStatus", event.target.value)} className={`${inputClassName} mt-1`}><option>ACTIVE</option><option>AT RISK</option><option>STALLED</option><option>CHURNED</option><option>PENDING</option></select></label>
            <label className="text-xs font-bold text-slate-500">Preferred channel<select value={form.preferredChannel} onChange={(event) => setField("master", "preferredChannel", event.target.value)} className={`${inputClassName} mt-1`}><option>WhatsApp</option><option>Email</option><option>Call</option><option>Portal</option></select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-500">Contract start<input type="date" value={form.contractStart} onChange={(event) => setField("master", "contractStart", event.target.value)} className={`${inputClassName} mt-1`} /></label>
            <label className="text-xs font-bold text-slate-500">Contract end<input type="date" value={form.contractEnd} onChange={(event) => setField("master", "contractEnd", event.target.value)} className={`${inputClassName} mt-1`} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-500">Review frequency (days)<input type="number" min="1" value={form.reviewFrequencyDays} onChange={(event) => setField("master", "reviewFrequencyDays", Number(event.target.value))} className={`${inputClassName} mt-1`} /></label>
            <label className="text-xs font-bold text-slate-500">Next review date<input type="date" value={form.nextReviewDate} onChange={(event) => setField("master", "nextReviewDate", event.target.value)} className={`${inputClassName} mt-1`} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.monthlyUpdateRequired} onChange={(event) => setField("master", "monthlyUpdateRequired", event.target.checked)} /> Monthly WhatsApp and email update required</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.renewalRequired} onChange={(event) => setField("master", "renewalRequired", event.target.checked)} /> Renewal tracking required</label>
          <textarea value={form.notes} onChange={(event) => setField("master", "notes", event.target.value)} placeholder="Servicing notes" className={`${inputClassName} min-h-24`} />
          <Button disabled={working}><Plus size={16} /> Add to Servicing Master</Button>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black text-slate-950">Service request portfolio</h2><p className="mt-1 text-sm text-slate-500">Baseline servicing setup for operational requests and review cycles.</p></div>
        {records.length ? <div className="divide-y divide-slate-100">{records.map((item) => <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1.25fr_0.8fr_1fr_1fr]">
          <div><p className="font-bold text-slate-950">{item.investorName}</p><p className="text-xs text-slate-400">{item.clientCode || "—"} · {item.advisorName || "Unassigned"}</p></div>
          <div><p className="text-xs text-slate-400">Status</p><StatusPill tone={item.serviceStatus === "ACTIVE" ? "green" : item.serviceStatus === "AT RISK" ? "red" : "amber"}>{item.serviceStatus || "PENDING"}</StatusPill></div>
          <div><p className="text-xs text-slate-400">Activated</p><p className="text-sm font-semibold">{formatDate(item.activationDate)}</p><p className="mt-1 text-xs text-slate-400">Channel: {item.preferredChannel || "—"}</p></div>
          <div><p className="text-xs text-slate-400">Next review</p><p className="text-sm font-semibold">{formatDate(item.nextReviewDate)}</p><p className="mt-1 text-xs text-slate-400">Contract end: {formatDate(item.contractEnd)}</p></div>
        </div>)}</div> : <EmptyState>No clients have been added to the servicing master.</EmptyState>}
      </Card>
    </div>
  );
}

function MonthlyTab({ investors, form, setField, submit, working, records }) {
  return <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]"><Card className="p-5"><h2 className="text-lg font-black">Monthly update log</h2><form onSubmit={(event) => submit("monthly", event)} className="mt-4 grid gap-3"><InvestorSelect investors={investors} value={form.investorId} onChange={(value) => setField("monthly", "investorId", value)} /><input type="month" value={form.monthKey} onChange={(event) => setField("monthly", "monthKey", event.target.value)} className={inputClassName} required /><label className="text-xs font-bold text-slate-500">Activation date<input type="date" value={form.activationDate} onChange={(event) => setField("monthly", "activationDate", event.target.value)} className={`${inputClassName} mt-1`} required /></label><label className="text-xs font-bold text-slate-500">WhatsApp sent date<input type="date" value={form.whatsappSentDate} onChange={(event) => setField("monthly", "whatsappSentDate", event.target.value)} className={`${inputClassName} mt-1`} /></label><label className="text-xs font-bold text-slate-500">Email sent date<input type="date" value={form.emailSentDate} onChange={(event) => setField("monthly", "emailSentDate", event.target.value)} className={`${inputClassName} mt-1`} /></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.clientAcknowledged} onChange={(event) => setField("monthly", "clientAcknowledged", event.target.checked)} /> Client acknowledged</label><textarea value={form.notes} onChange={(event) => setField("monthly", "notes", event.target.value)} placeholder="Notes" className={`${inputClassName} min-h-20`} /><Button disabled={working}><Plus size={16} /> Save Update</Button></form></Card><Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Monthly communications</h2></div>{records.length ? <div className="divide-y divide-slate-100">{records.map((item) => <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_1fr_auto]"><div><p className="font-bold">{item.investorName}</p><p className="text-xs text-slate-400">{item.monthKey}</p></div><div><p className="text-xs text-slate-400">WhatsApp</p><p className="text-sm">{formatDate(item.whatsappSentDate)} · Day {item.whatsappDay ?? "—"}</p></div><div><p className="text-xs text-slate-400">Email</p><p className="text-sm">{formatDate(item.emailSentDate)} · Day {item.emailDay ?? "—"}</p></div><div className="flex gap-2"><StatusPill tone={item.whatsappTatBreached || item.emailTatBreached ? "red" : "green"}>{item.whatsappTatBreached || item.emailTatBreached ? "BREACH" : "On Time"}</StatusPill></div></div>)}</div> : <EmptyState>No monthly update records.</EmptyState>}</Card></div>;
}

function QuarterlyTab({ investors, form, setField, submit, working, records }) {
  return <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]"><Card className="p-5"><h2 className="text-lg font-black">Quarterly review</h2><form onSubmit={(event) => submit("quarterly", event)} className="mt-4 grid gap-3"><InvestorSelect investors={investors} value={form.investorId} onChange={(value) => setField("quarterly", "investorId", value)} /><label className="text-xs font-bold text-slate-500">Review held at<input type="datetime-local" value={form.reviewDate} onChange={(event) => setField("quarterly", "reviewDate", event.target.value)} className={`${inputClassName} mt-1`} required /></label><label className="text-xs font-bold text-slate-500">Recap sent at<input type="datetime-local" value={form.recapSentAt} onChange={(event) => setField("quarterly", "recapSentAt", event.target.value)} className={`${inputClassName} mt-1`} /></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.rebalancingRequired} onChange={(event) => setField("quarterly", "rebalancingRequired", event.target.checked)} /> Rebalancing required</label>{form.rebalancingRequired ? <><label className="text-xs font-bold text-slate-500">Requested at<input type="datetime-local" value={form.rebalancingRequestedAt} onChange={(event) => setField("quarterly", "rebalancingRequestedAt", event.target.value)} className={`${inputClassName} mt-1`} /></label><label className="text-xs font-bold text-slate-500">Completed at<input type="datetime-local" value={form.rebalancingDoneAt} onChange={(event) => setField("quarterly", "rebalancingDoneAt", event.target.value)} className={`${inputClassName} mt-1`} /></label></> : null}<textarea value={form.outcome} onChange={(event) => setField("quarterly", "outcome", event.target.value)} placeholder="Review outcome" className={`${inputClassName} min-h-20`} /><Button disabled={working}><Plus size={16} /> Save Review</Button></form></Card><Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Review history</h2></div>{records.length ? <div className="divide-y divide-slate-100">{records.map((item) => <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_1fr_1fr]"><div><p className="font-bold">{item.investorName}</p><p className="text-xs text-slate-400">{formatDateTime(item.reviewDate)}</p></div><div><p className="text-xs text-slate-400">Recap TAT</p><StatusPill tone={item.recapTatBreached ? "red" : "green"}>{item.recapHours == null ? "Pending" : `${Number(item.recapHours).toFixed(1)} hr`}</StatusPill></div><div><p className="text-xs text-slate-400">Rebalancing</p><StatusPill tone={item.rebalancingTatBreached ? "red" : "green"}>{item.rebalancingDays == null ? "N/A" : `${Number(item.rebalancingDays).toFixed(1)} day`}</StatusPill></div><div><p className="text-xs text-slate-400">Next review</p><p className="text-sm font-semibold">{formatDate(item.nextReviewDue)}</p></div></div>)}</div> : <EmptyState>No quarterly reviews logged.</EmptyState>}</Card></div>;
}

function RenewalTab({ investors, form, setField, submit, working, records }) {
  return <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]"><Card className="p-5"><h2 className="text-lg font-black">Renewal tracker</h2><form onSubmit={(event) => submit("renewals", event)} className="mt-4 grid gap-3"><InvestorSelect investors={investors} value={form.investorId} onChange={(value) => setField("renewals", "investorId", value)} /><label className="text-xs font-bold text-slate-500">Contract end<input type="date" value={form.contractEnd} onChange={(event) => setField("renewals", "contractEnd", event.target.value)} className={`${inputClassName} mt-1`} required /></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.flagRaised} onChange={(event) => setField("renewals", "flagRaised", event.target.checked)} /> Renewal flag raised</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.conversationHeld} onChange={(event) => setField("renewals", "conversationHeld", event.target.checked)} /> Renewal conversation held</label><input value={form.clientResponse} onChange={(event) => setField("renewals", "clientResponse", event.target.value)} placeholder="Client response" className={inputClassName} /><select value={form.status} onChange={(event) => setField("renewals", "status", event.target.value)} className={inputClassName}><option>Open</option><option>In Discussion</option><option>Renewed</option><option>Closed</option></select><Button disabled={working}><Plus size={16} /> Save Renewal</Button></form></Card><Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Renewal pipeline</h2></div>{records.length ? <div className="divide-y divide-slate-100">{records.map((item) => <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_1fr_auto]"><div><p className="font-bold">{item.investorName}</p><p className="text-xs text-slate-400">End: {formatDate(item.contractEnd)}</p></div><div><p className="text-xs text-slate-400">Flag / Conversation</p><p className="text-sm">{formatDate(item.flagDate)} · {formatDate(item.conversationDate)}</p></div><div><p className="text-xs text-slate-400">Days remaining</p><p className="font-bold">{item.daysToRenewal ?? "—"}</p></div><div><StatusPill tone={item.atRisk ? "red" : item.status === "Renewed" ? "green" : "amber"}>{item.atRisk ? "AT RISK" : item.status}</StatusPill></div></div>)}</div> : <EmptyState>No renewal records.</EmptyState>}</Card></div>;
}

function AddendumTab({ investors, form, setField, submit, working, records, resolveMiss }) {
  return <div className="grid gap-5 xl:grid-cols-[410px_minmax(0,1fr)]"><Card className="p-5"><h2 className="text-lg font-black">Addendum A deadline miss</h2><form onSubmit={(event) => submit("addendum", event)} className="mt-4 grid gap-3"><InvestorSelect investors={investors} value={form.investorId} onChange={(value) => setField("addendum", "investorId", value)} /><input value={form.sopStep} onChange={(event) => setField("addendum", "sopStep", event.target.value)} placeholder="SOP step / deadline" className={inputClassName} required /><label className="text-xs font-bold text-slate-500">Original deadline<input type="datetime-local" value={form.originalDeadline} onChange={(event) => setField("addendum", "originalDeadline", event.target.value)} className={`${inputClassName} mt-1`} required /></label><select value={form.category} onChange={(event) => setField("addendum", "category", event.target.value)} className={inputClassName}>{ADDENDUM_CATEGORIES.map((item) => <option key={item} value={item}>Category {item}</option>)}</select><textarea value={form.natureOfMiss} onChange={(event) => setField("addendum", "natureOfMiss", event.target.value)} placeholder="Nature of miss" className={`${inputClassName} min-h-20`} required /><textarea value={form.actionTaken} onChange={(event) => setField("addendum", "actionTaken", event.target.value)} placeholder="Action taken" className={`${inputClassName} min-h-20`} /><Button disabled={working}><Plus size={16} /> Log Miss</Button></form></Card><Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Deadline miss log</h2></div>{records.length ? <div className="divide-y divide-slate-100">{records.map((item) => <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_1fr_auto]"><div><p className="font-bold">{item.investorName}</p><p className="text-xs text-slate-400">{item.sopStep} · Category {item.category}</p></div><div><p className="text-xs text-slate-400">Days open</p><p className="font-bold">{item.daysOpen}</p></div><div><p className="text-xs text-slate-400">Escalation</p><StatusPill tone={item.escalationAlert === "Resolved" ? "green" : item.escalationAlert === "Monitoring" ? "amber" : "red"}>{item.escalationAlert}</StatusPill></div><div>{item.status !== "Resolved" ? <button type="button" onClick={() => resolveMiss(item)} className="text-xs font-bold text-blue-700">Resolve</button> : <CheckCircle2 className="text-emerald-600" size={19} />}</div></div>)}</div> : <EmptyState>No deadline misses logged.</EmptyState>}</Card></div>;
}

function ChecklistTab({ investors, form, setField, submit, working, records }) {
  const checks = [
    ["whatsappSent", "WhatsApp sent"], ["emailSent", "Email sent"], ["clientAcknowledged", "Client acknowledged"], ["delayLogged", "Delay logged"],
    ["queryLogged", "Query logged"], ["queryResolved", "Query resolved"], ["queryTatMet", "Query TAT met"], ["addendumLogged", "Addendum logged"],
    ["inviteSent", "Review invite sent"], ["reviewHeld", "Review held"], ["recapSent", "Recap sent"], ["rebalancingDone", "Rebalancing done"],
    ["flagRaised", "Renewal flag"], ["conversationHeld", "Renewal conversation"], ["documentsReceived", "Documents received"], ["signed", "Signed"]
  ];
  return <div className="grid gap-5 xl:grid-cols-[470px_minmax(0,1fr)]"><Card className="p-5"><h2 className="text-lg font-black">Servicing checklist</h2><form onSubmit={(event) => submit("checklist", event)} className="mt-4 grid gap-4"><InvestorSelect investors={investors} value={form.investorId} onChange={(value) => setField("checklist", "investorId", value)} /><input type="month" value={form.period} onChange={(event) => setField("checklist", "period", event.target.value)} className={inputClassName} required /><div className="grid gap-2 sm:grid-cols-2">{checks.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-xs font-semibold"><input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setField("checklist", key, event.target.checked)} />{label}</label>)}</div><Button disabled={working}><Plus size={16} /> Save Checklist</Button></form></Card><Card className="overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Completion by cycle</h2></div>{records.length ? <div className="divide-y divide-slate-100">{records.map((item) => <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_2fr]"><div><p className="font-bold">{item.investorName}</p><p className="text-xs text-slate-400">{item.period}</p></div><div><p className="text-2xl font-black text-blue-700">{item.completionPercentage || 0}%</p></div><div className="h-2 self-center overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${item.completionPercentage || 0}%` }} /></div></div>)}</div> : <EmptyState>No servicing checklists.</EmptyState>}</Card></div>;
}
