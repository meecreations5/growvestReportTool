"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, WalletCards } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { SIP_FUNDING_RESPONSES, sipFundingStatusLabel } from "@/lib/constants/sipFunding";
import { getSipFundingOverview, respondToSipFunding } from "@/services/sipFundingService";
import { GrowVestOutline, MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";

function MobileSipApp({ items, loading, busy, error, notice, respond }) {
  const dueSoon = useMemo(() => items.filter((item) => Number(item.daysUntilDebit ?? 999) <= 7).length, [items]);
  const ready = useMemo(() => items.filter((item) => item.fundingStatus === "ready").length, [items]);
  const monthly = useMemo(() => items.reduce((sum, item) => sum + Number(item.sipAmount || 0), 0), [items]);
  const next = [...items].sort((a, b) => Number(a.daysUntilDebit ?? 999) - Number(b.daysUntilDebit ?? 999))[0];

  return <div className="gv-mobile-app-stack md:hidden">
    <section className="gv-mobile-hero-glow relative overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,#07122f_0%,#0f2a73_46%,#1f4ed8_100%)] p-5 text-white shadow-[0_24px_64px_rgba(31,78,216,.2)]">
      <GrowVestOutline className="absolute -right-10 top-8 w-40 brightness-0 invert" opacity={0.14} />
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/80">SIP readiness</p>
      <div className="mt-2 flex items-start justify-between gap-3"><div><h2 className="font-heading text-2xl font-bold">Stay ready for your SIPs</h2><p className="mt-1.5 max-w-[245px] text-xs leading-5 text-white/65">A quick check before debit day helps your investment plan stay on track.</p></div><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/10"><WalletCards size={21} /></span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-[20px] border border-white/10 bg-white/[.07] p-3"><div><p className="text-[8px] font-bold uppercase text-white/45">Monthly SIP</p><p className="mt-1 truncate font-heading text-sm font-bold">{formatCurrency(monthly)}</p></div><div className="border-x border-white/10 px-2"><p className="text-[8px] font-bold uppercase text-white/45">Due ≤ 7d</p><p className="mt-1 font-heading text-sm font-bold">{dueSoon}</p></div><div><p className="text-[8px] font-bold uppercase text-white/45">Ready</p><p className="mt-1 font-heading text-sm font-bold text-emerald-200">{ready}</p></div></div>
    </section>

    {next ? <section className="gv-mobile-app-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="gv-mobile-section-title text-[var(--gv-blue)]">Next debit</p><h3 className="mt-1 line-clamp-2 font-heading text-lg font-bold leading-5 text-slate-950">{next.instrumentName}</h3></div><div className="text-right"><p className="font-heading text-lg font-bold text-slate-950">{formatCurrency(next.sipAmount)}</p><p className="mt-0.5 text-[10px] font-bold text-[var(--gv-blue)]">{next.daysUntilDebit === 0 ? 'Today' : `${next.daysUntilDebit} days`}</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[linear-gradient(90deg,var(--gv-blue),var(--gv-cyan))]" style={{ width: `${Math.max(12, Math.min(100, 100 - Number(next.daysUntilDebit || 0) * 8))}%` }} /></div><p className="mt-2 text-[10px] text-slate-400">Scheduled {formatDate(next.nextDebitDate)}</p></section> : null}

    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}
    {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{notice}</div> : null}
    {loading ? <div className="space-y-3"><div className="gv-skeleton h-48 rounded-[24px]" /><div className="gv-skeleton h-48 rounded-[24px]" /></div> : !items.length ? <MobileEmptyState icon={CheckCircle2} title="No SIP reminders configured" copy="GrowVest will show upcoming SIP funding checks here when applicable." /> : <section><div className="mb-2.5 flex items-end justify-between"><div><p className="gv-mobile-section-title">Upcoming SIPs</p><h2 className="mt-1 font-heading text-lg font-bold text-slate-950">Funding checks</h2></div><span className="text-[10px] font-bold text-slate-400">{items.length} active</span></div><div className="space-y-3">{items.map((item) => {
      const attention = ["needs_advisor", "service_request"].includes(item.fundingStatus);
      return <article key={item.id} className="gv-mobile-app-card p-4"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.fundingStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : attention ? 'bg-amber-50 text-amber-700' : 'bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]'}`}>{item.fundingStatus === 'ready' ? <CheckCircle2 size={18} /> : attention ? <AlertTriangle size={18} /> : <Clock3 size={18} />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 font-heading text-base font-bold leading-5 text-slate-950">{item.instrumentName}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${item.fundingStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : attention ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-[var(--gv-blue)]'}`}>{sipFundingStatusLabel(item.fundingStatus)}</span></div><p className="mt-1 text-[10px] text-slate-400">{item.bankName ? `${item.bankName}${item.accountLast4 ? ` ••••${item.accountLast4}` : ''}` : 'Debit bank with GrowVest'}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2 rounded-[18px] bg-slate-50 p-3"><div><p className="text-[8px] font-bold uppercase text-slate-400">Amount</p><p className="mt-1 text-xs font-black text-slate-950">{formatCurrency(item.sipAmount)}</p></div><div className="border-x border-slate-200 px-2"><p className="text-[8px] font-bold uppercase text-slate-400">Debit</p><p className="mt-1 text-xs font-black text-slate-950">{formatDate(item.nextDebitDate)}</p></div><div><p className="text-[8px] font-bold uppercase text-slate-400">Time</p><p className="mt-1 text-xs font-black text-slate-950">{item.daysUntilDebit === 0 ? 'Today' : `${item.daysUntilDebit}d`}</p></div></div>{(() => { const options = SIP_FUNDING_RESPONSES.filter((option) => option.value !== "funds_added" || item.fundingStatus === "awaiting_funds"); const primary = options[0]; const secondary = options.slice(1); return <div className="mt-3"><p className="text-[10px] font-bold text-slate-500">Confirm funding status</p>{primary ? <button type="button" onClick={() => respond(item, primary.value)} disabled={Boolean(busy)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gv-blue)] px-3 text-xs font-black text-white disabled:opacity-50">{busy === `${item.id}:${primary.value}` ? <Loader2 size={14} className="animate-spin" /> : null}{primary.label}</button> : null}{secondary.length ? <details className="mt-2 rounded-2xl border border-slate-200 bg-white"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-center text-[10px] font-black text-slate-500">More options</summary><div className="grid gap-2 border-t border-slate-100 p-2">{secondary.map((option) => <button key={option.value} type="button" onClick={() => respond(item, option.value)} disabled={Boolean(busy)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-[10px] font-black text-slate-600 disabled:opacity-50">{busy === `${item.id}:${option.value}` ? <Loader2 size={13} className="animate-spin" /> : null}{option.label}</button>)}</div></details> : null}</div>; })()}</article>;
    })}</div></section>}
  </div>;
}

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
      setNotice(result.followUpType === "advisor_follow_up" ? "GrowVest will follow up with you." : result.followUpType === "service_request" ? "GrowVest support will review the bank or mandate issue." : response === "will_add_funds" ? "We will keep the SIP funding check open until you confirm funds are added." : "Funding status updated.");
      await load();
    } catch (nextError) { setError(nextError.message || "Unable to update funding status."); }
    finally { setBusy(""); }
  }

  return <>
    <MobileSipApp items={items} loading={loading} busy={busy} error={error} notice={notice} respond={respond} />
    <div className="hidden gap-5 md:grid">
      <section className="rounded-[var(--gv-radius-lg)] bg-[var(--gv-ink)] p-5 text-white shadow-[var(--gv-shadow-card)] sm:p-6"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">SIP Funding</p><h1 className="mt-2 font-heading text-3xl font-bold">Upcoming SIP debits</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Confirm whether funds are ready before each scheduled SIP debit. Investment-related funding requests go to your GrowVest Partner; bank or mandate issues go to GrowVest support.</p></section>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div> : !items.length ? <EmptyState title="No SIP reminders configured" description="Your GrowVest team will configure reminders for applicable SIPs." /> : <div className="grid gap-4">{items.map((item) => <Card key={item.id} className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-xl font-bold text-slate-950">{item.instrumentName}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.fundingStatus === "ready" ? "bg-emerald-50 text-emerald-700" : ["needs_advisor", "service_request"].includes(item.fundingStatus) ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}>{sipFundingStatusLabel(item.fundingStatus)}</span></div><p className="mt-1 text-xs text-slate-500">{item.bankName ? `${item.bankName}${item.accountLast4 ? ` ••••${item.accountLast4}` : ""}` : "Debit bank details available with GrowVest"}</p></div><div className="text-left sm:text-right"><p className="font-heading text-2xl font-bold text-slate-950">{formatCurrency(item.sipAmount)}</p><p className="mt-1 text-sm font-semibold text-slate-600">Debit {formatDate(item.nextDebitDate)}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><Clock3 size={16} className="text-blue-700" /><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Time Remaining</p><p className="mt-1 text-sm font-bold text-slate-900">{item.daysUntilDebit === 0 ? "Today" : `${item.daysUntilDebit} days`}</p></div><div className="rounded-xl bg-slate-50 p-3"><WalletCards size={16} className="text-blue-700" /><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Debit Day</p><p className="mt-1 text-sm font-bold text-slate-900">Day {item.debitDay}</p></div><div className="col-span-2 rounded-xl bg-slate-50 p-3 sm:col-span-1">{item.fundingStatus === "ready" ? <CheckCircle2 size={16} className="text-emerald-700" /> : <AlertTriangle size={16} className="text-amber-700" />}<p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Funding Status</p><p className="mt-1 text-sm font-bold text-slate-900">{sipFundingStatusLabel(item.fundingStatus)}</p></div></div><div className="mt-5"><p className="text-xs font-bold text-slate-700">How would you like to prepare for this SIP?</p><div className="mt-3 flex flex-wrap gap-2">{SIP_FUNDING_RESPONSES.filter((option) => option.value !== "funds_added" || item.fundingStatus === "awaiting_funds").map((option) => <Button key={option.value} type="button" variant={option.value === "funds_available" || option.value === "funds_added" ? "primary" : "secondary"} onClick={() => respond(item, option.value)} disabled={Boolean(busy)}>{busy === `${item.id}:${option.value}` ? <Loader2 size={15} className="animate-spin" /> : null}{option.label}</Button>)}</div></div></Card>)}</div>}
    </div>
  </>;
}
