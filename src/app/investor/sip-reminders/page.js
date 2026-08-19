"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, WalletCards } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { SIP_FUNDING_RESPONSES, sipFundingStatusLabel } from "@/lib/constants/sipFunding";
import { getSipFundingOverview, respondToSipFunding } from "@/services/sipFundingService";

export default function InvestorSipRemindersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const payload = await getSipFundingOverview(); setItems(payload.items || []); }
    catch (nextError) { setError(nextError.message || "Unable to load SIP reminders."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function respond(item, response) {
    setBusy(`${item.id}:${response}`); setError(""); setNotice("");
    try {
      const result = await respondToSipFunding(item.id, response);
      setNotice(result.followUpType === "advisor_follow_up" ? "Your Advisor Follow-up has been created." : result.followUpType === "service_request" ? "A Service Request has been created for the bank / mandate issue." : response === "will_add_funds" ? "We will keep the SIP funding check open until you confirm funds are added." : "Funding status updated.");
      await load();
    } catch (nextError) { setError(nextError.message || "Unable to update funding status."); }
    finally { setBusy(""); }
  }

  return <div className="grid gap-5">
    <section className="rounded-[var(--gv-radius-lg)] bg-[var(--gv-ink)] p-5 text-white shadow-[var(--gv-shadow-card)] sm:p-6"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">SIP Funding</p><h1 className="mt-2 font-heading text-3xl font-bold">Upcoming SIP debits</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Confirm whether funds are ready before each scheduled SIP debit. Investment-related funding requests go to your Advisor; bank or mandate issues become a Service Request.</p></section>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
    {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}
    {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div> : !items.length ? <EmptyState title="No SIP reminders configured" description="Your GrowVest team will configure reminders for applicable SIPs." /> : <div className="grid gap-4">{items.map((item) => <Card key={item.id} className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-xl font-bold text-slate-950">{item.instrumentName}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.fundingStatus === "ready" ? "bg-emerald-50 text-emerald-700" : ["needs_advisor", "service_request"].includes(item.fundingStatus) ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}>{sipFundingStatusLabel(item.fundingStatus)}</span></div><p className="mt-1 text-xs text-slate-500">{item.bankName ? `${item.bankName}${item.accountLast4 ? ` ••••${item.accountLast4}` : ""}` : "Debit bank details available with GrowVest"}</p></div><div className="text-left sm:text-right"><p className="font-heading text-2xl font-bold text-slate-950">{formatCurrency(item.sipAmount)}</p><p className="mt-1 text-sm font-semibold text-slate-600">Debit {formatDate(item.nextDebitDate)}</p></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><Clock3 size={16} className="text-blue-700" /><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Time Remaining</p><p className="mt-1 text-sm font-bold text-slate-900">{item.daysUntilDebit === 0 ? "Today" : `${item.daysUntilDebit} days`}</p></div><div className="rounded-xl bg-slate-50 p-3"><WalletCards size={16} className="text-blue-700" /><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Debit Day</p><p className="mt-1 text-sm font-bold text-slate-900">Day {item.debitDay}</p></div><div className="col-span-2 rounded-xl bg-slate-50 p-3 sm:col-span-1">{item.fundingStatus === "ready" ? <CheckCircle2 size={16} className="text-emerald-700" /> : <AlertTriangle size={16} className="text-amber-700" />}<p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Funding Status</p><p className="mt-1 text-sm font-bold text-slate-900">{sipFundingStatusLabel(item.fundingStatus)}</p></div></div>
      <div className="mt-5"><p className="text-xs font-bold text-slate-700">How would you like to prepare for this SIP?</p><div className="mt-3 flex flex-wrap gap-2">{SIP_FUNDING_RESPONSES.filter((option) => option.value !== "funds_added" || item.fundingStatus === "awaiting_funds").map((option) => <Button key={option.value} type="button" variant={option.value === "funds_available" || option.value === "funds_added" ? "primary" : "secondary"} onClick={() => respond(item, option.value)} disabled={Boolean(busy)}>{busy === `${item.id}:${option.value}` ? <Loader2 size={15} className="animate-spin" /> : null}{option.label}</Button>)}</div></div>
    </Card>)}</div>}
  </div>;
}
