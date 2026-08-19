"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { ACTION_PRIORITIES, INVESTOR_REQUEST_TYPES } from "@/lib/constants/actions";
import { createInvestorAction } from "@/services/actionService";

function goalRows(investor) {
  const safeInvestor = investor && typeof investor === "object" ? investor : {};
  if (Array.isArray(safeInvestor.bucketList) && safeInvestor.bucketList.length) {
    return safeInvestor.bucketList;
  }
  return Array.isArray(safeInvestor.goals) ? safeInvestor.goals : [];
}

export default function ActionRequestDialog({ open, onClose, onCreated, investor, positions = [], staff = false, initial = {} }) {
  const safePositions = Array.isArray(positions) ? positions : [];
  const goals = useMemo(() => goalRows(investor), [investor]);
  const [form, setForm] = useState({ requestType: "Discuss Investment", priority: "Planned", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const source = initial && typeof initial === "object" ? initial : {};
    setError("");
    setForm({
      requestType: source.requestType || "Discuss Investment",
      priority: source.priority || "Planned",
      title: source.title || "",
      description: source.description || "",
      relatedInvestmentId: source.relatedInvestmentId || "",
      relatedInvestmentName: source.relatedInvestmentName || "",
      relatedGoalId: source.relatedGoalId || "",
      relatedGoalName: source.relatedGoalName || "",
      dueDate: source.dueDate || ""
    });
  }, [initial, open]);

  if (!open) return null;

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (!investor?.id) {
        throw new Error("Select an investor before creating an action.");
      }
      const position = safePositions.find((item) => String(item.id) === String(form.relatedInvestmentId));
      const goal = goals.find((item) => String(item.id || item.goalId) === String(form.relatedGoalId));
      const result = await createInvestorAction({
        investorId: investor?.id,
        ...form,
        relatedInvestmentName: position?.instrumentName || form.relatedInvestmentName || "",
        relatedGoalName: goal?.name || goal?.goalName || form.relatedGoalName || "",
        sourceType: staff ? "advisor_manual" : "investor_request"
      });
      onCreated?.(result.action);
      onClose?.();
    } catch (nextError) {
      setError(nextError.message || "Unable to create the Advisor follow-up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create investor action">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <section className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><MessageSquarePlus size={19} /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">{staff ? "Advisor workflow" : "Request your Advisor"}</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Create Advisor follow-up</h2><p className="mt-1 text-sm text-slate-500">{investor?.fullName || "Investor"}</p></div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500"><X size={16} /></button>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Request / action type"><select className={inputClassName} value={form.requestType || ""} onChange={(event) => set("requestType", event.target.value)}>{INVESTOR_REQUEST_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          {staff ? <Field label="Priority"><select className={inputClassName} value={form.priority || "Planned"} onChange={(event) => set("priority", event.target.value)}>{ACTION_PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></Field> : null}
          <Field label="Linked investment"><select className={inputClassName} value={form.relatedInvestmentId || ""} onChange={(event) => set("relatedInvestmentId", event.target.value)}><option value="">No specific investment</option>{safePositions.map((item) => <option key={item.id} value={item.id}>{item.instrumentName || "Investment"}</option>)}</select></Field>
          <Field label="Linked Goal / Bucket List"><select className={inputClassName} value={form.relatedGoalId || ""} onChange={(event) => set("relatedGoalId", event.target.value)}><option value="">General / no goal</option>{goals.map((goal) => <option key={goal.id || goal.goalId} value={goal.id || goal.goalId}>{goal.name || goal.goalName || "Goal"}</option>)}</select></Field>
          {staff ? <Field label="Due date"><input type="date" className={inputClassName} value={form.dueDate || ""} onChange={(event) => set("dueDate", event.target.value)} /></Field> : null}
          <div className="sm:col-span-2"><Field label="Title (optional)"><input className={inputClassName} value={form.title || ""} onChange={(event) => set("title", event.target.value)} placeholder="GrowVest will generate a title if left blank" /></Field></div>
          <div className="sm:col-span-2"><Field label={staff ? "Action description" : "What would you like to discuss?"}><textarea rows={4} className={inputClassName} value={form.description || ""} onChange={(event) => set("description", event.target.value)} placeholder="Add the context your Advisor should know." /></Field></div>
        </div>

        <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />} {staff ? "Create Follow-up" : "Send Request"}</Button></div>
      </section>
    </div>
  );
}
