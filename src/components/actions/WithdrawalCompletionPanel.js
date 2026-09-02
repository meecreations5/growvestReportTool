"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { completeWithdrawalAction } from "@/services/actionService";
import { formatCurrency } from "@/lib/utils/format";
import { Field, inputClassName } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function WithdrawalCompletionPanel({ action, onSaved }) {
  const [executionDate, setExecutionDate] = useState(todayKey());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setExecutionDate(action.actualFinancialDate || action.completionDate || todayKey());
    setReference(action.actualFinancialReference || "");
    setNote(action.portfolioConfirmationNote || "");
    setItems((action.withdrawalItems || []).map((item) => ({ positionId: item.positionId, actualAmount: item.withdrawalMode === "full" ? item.currentValueAtRequest || item.requestedAmount || "" : item.requestedAmount || "", actualUnits: item.withdrawalMode === "full" ? item.currentUnitsAtRequest || "" : item.requestedUnits || "" })));
  }, [action]);

  function change(positionId, field, value) { setItems((rows) => rows.map((item) => item.positionId === positionId ? { ...item, [field]: value } : item)); }

  async function complete() {
    setBusy(true); setError("");
    try {
      await completeWithdrawalAction(action.id, { executionDate, reference, note, items });
      onSaved?.("Withdrawal completed and Portfolio Master updated.");
    } catch (nextError) { setError(nextError.message || "Unable to complete withdrawal."); }
    finally { setBusy(false); }
  }

  if (action.status === "Completed" && action.financialImpactStatus === "confirmed") return <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} /> Portfolio adjustment completed. This action is now reflected in the Investor Portal and monthly reports.</div>;

  return <div className="mt-4 grid gap-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4"><div><p className="text-sm font-bold text-violet-950">Complete Withdrawal & Update Portfolio</p><p className="mt-1 text-xs leading-5 text-violet-800">Use this only after the redemption actually executes. GrowVest will reduce the selected holdings, apply each SIP Continue/Pause/Stop instruction, create confirmed withdrawal transactions and rebuild Portfolio Master.</p></div>{error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="grid gap-3">{(action.withdrawalItems || []).map((planned) => { const item = items.find((row) => row.positionId === planned.positionId) || {}; return <div key={planned.positionId} className="rounded-lg bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{planned.instrumentName}</p><p className="mt-1 text-[11px] text-slate-500">{planned.withdrawalMode === "full" ? "Complete withdrawal" : "Partial withdrawal"} · SIP {planned.sipInstruction || "continue"}</p></div><p className="text-xs font-bold text-slate-700">Planned {formatCurrency(planned.requestedAmount)}</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Actual withdrawal amount"><input type="number" min="0" step="0.01" className={inputClassName} value={item.actualAmount || ""} onChange={(event) => change(planned.positionId, "actualAmount", event.target.value)} /></Field><Field label="Actual units (if available)"><input type="number" min="0" step="0.000001" className={inputClassName} value={item.actualUnits || ""} onChange={(event) => change(planned.positionId, "actualUnits", event.target.value)} /></Field></div></div>; })}</div><div className="grid gap-3 md:grid-cols-3"><Field label="Execution date"><input type="date" className={inputClassName} value={executionDate} onChange={(event) => setExecutionDate(event.target.value)} /></Field><Field label="Provider / transaction reference"><input className={inputClassName} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional reference" /></Field><Field label="Completion note"><input className={inputClassName} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Execution verified" /></Field></div><div className="flex justify-end"><Button type="button" disabled={busy} onClick={complete}>{busy ? "Updating Portfolio…" : "Complete Withdrawal & Update Portfolio"}</Button></div></div>;
}
