"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Clock3, Loader2, WalletCards } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { sipFundingStatusLabel } from "@/lib/constants/sipFunding";
import { getSipFundingOverview } from "@/services/sipFundingService";

function tone(status) {
  if (status === "ready") return "green";
  if (["needs_advisor", "service_request"].includes(status)) return "red";
  if (status === "awaiting_funds") return "amber";
  return "blue";
}

export default function SipFundingCentre() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("upcoming");

  async function load() {
    setLoading(true); setError("");
    try { const payload = await getSipFundingOverview(); setItems(payload.items || []); }
    catch (nextError) { setError(nextError.message || "Unable to load SIP funding reminders."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => ({
    due7: items.filter((item) => Number(item.daysUntilDebit) >= 0 && Number(item.daysUntilDebit) <= 7).length,
    ready: items.filter((item) => item.fundingStatus === "ready").length,
    needsAction: items.filter((item) => ["needs_advisor", "service_request"].includes(item.fundingStatus)).length,
    awaiting: items.filter((item) => ["pending", "awaiting_funds"].includes(item.fundingStatus)).length
  }), [items]);

  const visible = useMemo(() => items.filter((item) => {
    if (filter === "action") return ["needs_advisor", "service_request"].includes(item.fundingStatus);
    if (filter === "ready") return item.fundingStatus === "ready";
    if (filter === "awaiting") return ["pending", "awaiting_funds"].includes(item.fundingStatus);
    return Number(item.daysUntilDebit) >= 0 && Number(item.daysUntilDebit) <= 30;
  }), [filter, items]);

  return <div className="grid gap-6">
    <PageHeader eyebrow="Advisory operations" title="SIP Funding" description="Track upcoming SIP debits, investor funding confirmations and requests that need Advisor Follow-up or a Service Request." />
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Due next 7 days" value={summary.due7} helper="Configured SIP schedules" icon={Clock3} tone="blue" />
      <MetricCard label="Ready" value={summary.ready} helper="Funds confirmed" icon={CheckCircle2} tone="green" />
      <MetricCard label="Needs action" value={summary.needsAction} helper="Advisor or servicing follow-up" icon={AlertTriangle} tone="red" />
      <MetricCard label="Awaiting investor" value={summary.awaiting} helper="No final funding confirmation yet" icon={BellRing} tone="amber" />
    </section>
    <SegmentedTabs ariaLabel="SIP funding filters" value={filter} onChange={setFilter} items={[
      { value: "upcoming", label: "Upcoming 30 days" }, { value: "action", label: "Needs Action", count: summary.needsAction }, { value: "awaiting", label: "Awaiting" }, { value: "ready", label: "Ready" }
    ]} />
    <Card className="overflow-hidden">
      {loading ? <div className="grid min-h-44 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div> : !visible.length ? <div className="p-6"><EmptyState title="No SIP funding items" description="Configure a SIP reminder from an Investor's Portfolio. Upcoming debit cycles will appear here automatically." /></div> : <div className="divide-y divide-slate-100">{visible.map((item) => <article key={item.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_150px_150px_180px] lg:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-base font-bold text-slate-950">{item.investorName}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tone(item.fundingStatus) === "green" ? "bg-emerald-50 text-emerald-700" : tone(item.fundingStatus) === "red" ? "bg-red-50 text-red-700" : tone(item.fundingStatus) === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{sipFundingStatusLabel(item.fundingStatus)}</span></div><p className="mt-1 text-sm font-semibold text-slate-700">{item.instrumentName}</p><p className="mt-1 text-xs text-slate-500">{item.bankName ? `${item.bankName}${item.accountLast4 ? ` ••••${item.accountLast4}` : ""}` : "Debit bank not recorded"}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">SIP Amount</p><p className="mt-1 font-heading text-base font-bold text-slate-950">{formatCurrency(item.sipAmount)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Next Debit</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDate(item.nextDebitDate)}</p><p className="mt-1 text-xs text-slate-500">{item.daysUntilDebit === 0 ? "Today" : `${item.daysUntilDebit} day${item.daysUntilDebit === 1 ? "" : "s"}`}</p></div>
        <div className="flex flex-wrap gap-2 lg:justify-end"><Link href={`/investors/${item.investorId}?tab=portfolio`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><WalletCards size={14} /> Portfolio</Link>{item.cycle?.followUpType === "advisor_follow_up" ? <Link href="/actions" className="inline-flex min-h-9 items-center rounded-lg bg-blue-700 px-3 text-xs font-bold text-white">Advisor Follow-up</Link> : null}{item.cycle?.followUpType === "service_request" ? <Link href="/servicing" className="inline-flex min-h-9 items-center rounded-lg bg-amber-600 px-3 text-xs font-bold text-white">Service Request</Link> : null}</div>
      </article>)}</div>}
    </Card>
  </div>;
}
