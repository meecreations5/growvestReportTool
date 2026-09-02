"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, CircleDollarSign, Plus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestorPortfolio } from "@/services/portfolioService";
import { createInvestorAction, subscribeInvestorActions } from "@/services/actionService";
import { GENERAL_WEALTH_BUCKET_ID, GENERAL_WEALTH_BUCKET_NAME, isGeneralWealthAllocation, normalisePortfolioGoalAllocations } from "@/lib/portfolioGoalAllocation";
import { STRUCTURED_WITHDRAWAL_REQUEST_TYPE, isStructuredWithdrawalAction } from "@/lib/constants/actions";
import { formatCurrency } from "@/lib/utils/format";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ActionStatusBadge from "@/components/actions/ActionStatusBadge";
import WithdrawalActionSummary from "@/components/actions/WithdrawalActionSummary";
import { Field, inputClassName } from "@/components/ui/Field";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function bucketOptions(investor = {}) {
  const goals = investor?.bucketList?.length ? investor.bucketList : investor?.goals || [];
  return [
    { id: GENERAL_WEALTH_BUCKET_ID, name: `${GENERAL_WEALTH_BUCKET_NAME} (Default)` },
    ...goals.map((goal, index) => ({ id: goal.id || goal.goalId || `goal-${index + 1}`, name: goal.name || "Bucket List" }))
  ];
}

function belongsToBucket(position, bucketId) {
  return normalisePortfolioGoalAllocations(position.goalAllocations).some((allocation) => (
    bucketId === GENERAL_WEALTH_BUCKET_ID
      ? isGeneralWealthAllocation(allocation) && Number(allocation.percentage || 0) > 0
      : String(allocation.goalId || "") === String(bucketId) && Number(allocation.percentage || 0) > 0
  ));
}

function blankItem(position) {
  return { positionId: position.id, selected: false, withdrawalMode: "partial", requestedAmount: "", requestedUnits: "", sipInstruction: "continue" };
}

export default function WithdrawalCashNeedsPanel({ investor, staff = false, embedded = false }) {
  const { profile } = useAuth();
  const [positions, setPositions] = useState([]);
  const [actions, setActions] = useState([]);
  const [open, setOpen] = useState(false);
  const [bucketId, setBucketId] = useState(GENERAL_WEALTH_BUCKET_ID);
  const [purpose, setPurpose] = useState("");
  const [plannedDate, setPlannedDate] = useState(todayKey());
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!investor?.id || !profile) return undefined;
    return subscribeInvestorPortfolio(investor.id, profile, setPositions, (nextError) => setError(nextError.message || "Unable to load portfolio."));
  }, [investor?.id, profile]);

  useEffect(() => {
    if (!investor?.id || !profile) return undefined;
    return subscribeInvestorActions(investor.id, profile, (rows) => setActions(rows.filter(isStructuredWithdrawalAction)), (nextError) => setError(nextError.message || "Unable to load withdrawals."));
  }, [investor?.id, profile]);

  const buckets = useMemo(() => bucketOptions(investor), [investor]);
  const selectedBucket = buckets.find((item) => item.id === bucketId) || buckets[0];
  const eligible = useMemo(() => positions.filter((item) => String(item.productType || "") === "mutual_fund" && belongsToBucket(item, bucketId)), [positions, bucketId]);

  useEffect(() => {
    setItems(eligible.map(blankItem));
  }, [eligible]);

  function changeItem(positionId, field, value) {
    setItems((current) => current.map((item) => item.positionId === positionId ? { ...item, [field]: value } : item));
  }

  async function submit() {
    const chosen = items.filter((item) => item.selected);
    if (!chosen.length) { setError("Select at least one fund for withdrawal."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const payloadItems = chosen.map((item) => ({
        positionId: item.positionId,
        withdrawalMode: item.withdrawalMode,
        requestedAmount: item.withdrawalMode === "full" ? 0 : Number(item.requestedAmount || 0),
        requestedUnits: item.withdrawalMode === "full" ? 0 : Number(item.requestedUnits || 0),
        sipInstruction: item.sipInstruction
      }));
      await createInvestorAction({
        investorId: investor.id,
        requestType: STRUCTURED_WITHDRAWAL_REQUEST_TYPE,
        title: `Withdrawal from ${selectedBucket?.name || "Portfolio"}`,
        description: purpose ? `Planned cash need: ${purpose}` : "Planned portfolio withdrawal",
        status: "Requested",
        priority: "Planned",
        owner: "Advisor",
        relatedGoalId: bucketId === GENERAL_WEALTH_BUCKET_ID ? "" : bucketId,
        relatedGoalName: selectedBucket?.name?.replace(" (Default)", "") || GENERAL_WEALTH_BUCKET_NAME,
        withdrawalBucketId: bucketId,
        withdrawalBucketName: selectedBucket?.name?.replace(" (Default)", "") || GENERAL_WEALTH_BUCKET_NAME,
        withdrawalPurpose: purpose,
        requestedEffectiveDate: plannedDate,
        withdrawalItems: payloadItems,
        requestedChangeDetails: "Fund-level withdrawal instructions are maintained in Investor Profile. Monthly Reports fetch this action automatically."
      });
      setNotice("Withdrawal request saved in the Investor Profile and will flow automatically into monthly reporting.");
      setOpen(false); setPurpose(""); setPlannedDate(todayKey());
    } catch (nextError) {
      setError(nextError.message || "Unable to save the withdrawal request.");
    } finally { setBusy(false); }
  }

  return (
    <section className={embedded ? "grid gap-4" : "rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><CircleDollarSign size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Investor Profile</p><h2 className="font-heading text-xl font-bold text-slate-950">Withdrawals & Planned Cash Needs</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Plan the withdrawal once here. Choose the Bucket List and fund(s), then decide separately whether each SIP continues, pauses or stops. Reports only read this workflow; they do not ask you to re-enter it.</p></div></div>
        <Button type="button" onClick={() => setOpen(true)}><Plus size={16} /> Plan Withdrawal</Button>
      </div>
      {notice ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> {notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="grid gap-3">
        {actions.length ? actions.slice(0, 10).map((action) => <article key={action.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-heading text-base font-bold text-slate-950">{action.title || "Withdrawal"}</h3><p className="mt-1 text-xs text-slate-500">{action.actionCode || "Profile withdrawal"}</p></div><ActionStatusBadge status={action.status} /></div><WithdrawalActionSummary action={action} compact /></article>) : <EmptyState title="No planned withdrawals" description="Future cash needs and redemption requests will appear here and will be fetched automatically into the relevant monthly report." icon={CalendarClock} />}
      </div>

      {open ? <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-3 sm:p-6"><div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4 sm:p-5"><div><p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Withdrawal plan</p><h3 className="font-heading text-xl font-bold text-slate-950">Select Bucket List and funds</h3></div><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-500"><X size={18} /></button></div><div className="grid gap-5 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3"><Field label="Bucket List"><select className={inputClassName} value={bucketId} onChange={(event) => setBucketId(event.target.value)}>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}</select></Field><Field label="Planned withdrawal date"><input type="date" className={inputClassName} value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} /></Field><Field label="Purpose / cash need"><input className={inputClassName} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Insurance premium, travel, home, other" /></Field></div>
        <div className="grid gap-3">{eligible.length ? eligible.map((position) => { const item = items.find((row) => row.positionId === position.id) || blankItem(position); const allocation = normalisePortfolioGoalAllocations(position.goalAllocations).find((row) => bucketId === GENERAL_WEALTH_BUCKET_ID ? isGeneralWealthAllocation(row) : row.goalId === bucketId); const allocationPercentage = Number(allocation?.percentage || 0); const mappedValue = Number(position.currentValue || 0) * allocationPercentage / 100; const fullyMappedHere = allocationPercentage >= 99.999; return <div key={position.id} className={`rounded-xl border p-4 ${item.selected ? "border-violet-300 bg-violet-50/40" : "border-slate-200"}`}><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={item.selected} onChange={(event) => changeItem(position.id, "selected", event.target.checked)} /><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">{position.instrumentName || position.schemeName || "Mutual Fund"}</p><p className="text-xs text-slate-500">Current value {formatCurrency(position.currentValue)} · Mapped here {formatCurrency(mappedValue)} ({allocationPercentage.toFixed(1)}%) · SIP {formatCurrency(position.monthlySip)}/month</p></div><p className="text-xs font-semibold text-slate-500">Folio {position.folioNo || "—"}</p></div>{item.selected ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Withdrawal"><select className={inputClassName} value={item.withdrawalMode} onChange={(event) => changeItem(position.id, "withdrawalMode", event.target.value)}><option value="partial">Partial</option><option value="full" disabled={!fullyMappedHere}>Complete holding{fullyMappedHere ? "" : " (requires 100% mapping)"}</option></select></Field>{item.withdrawalMode === "partial" ? <Field label="Requested amount"><input type="number" min="0" max={mappedValue || undefined} step="0.01" className={inputClassName} value={item.requestedAmount} onChange={(event) => changeItem(position.id, "requestedAmount", event.target.value)} placeholder="₹" /></Field> : <div className="rounded-lg bg-white p-3 text-xs text-slate-600"><p className="font-bold text-slate-900">Complete withdrawal</p><p className="mt-1">Current value {formatCurrency(position.currentValue)}</p></div>}{item.withdrawalMode === "partial" ? <Field label="Units (optional)"><input type="number" min="0" step="0.000001" className={inputClassName} value={item.requestedUnits} onChange={(event) => changeItem(position.id, "requestedUnits", event.target.value)} /></Field> : null}<Field label="After withdrawal SIP"><select className={inputClassName} value={item.sipInstruction} onChange={(event) => changeItem(position.id, "sipInstruction", event.target.value)}><option value="continue">Continue SIP</option><option value="pause">Pause SIP</option><option value="stop">Stop SIP</option></select></Field></div> : null}</div></label></div>; }) : <EmptyState title="No Mutual Funds mapped to this Bucket List" description="Map an investment to this Bucket List or General Wealth before creating a fund withdrawal request." />}</div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">A withdrawal request is a plan until execution is confirmed. It will appear in the report as planned/in process, but Money Withdrawn and Portfolio Gain/Loss change only after the actual withdrawal is completed.</div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" disabled={busy || !eligible.length} onClick={submit}>{busy ? "Saving…" : staff ? "Save Withdrawal Plan" : "Send Withdrawal Request"}</Button></div>
      </div></div></div> : null}
    </section>
  );
}
