"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { SIP_REMINDER_DAY_OPTIONS } from "@/lib/constants/sipFunding";
import { disableSipFundingSchedule, getSipFundingOverview, saveSipFundingSchedule } from "@/services/sipFundingService";

export default function SipFundingScheduleDialog({ open, onClose, investor, position }) {
  const [form, setForm] = useState({ debitDay: 10, reminderDays: [5], bankName: "", accountLast4: "", sipAmount: "" });
  const [schedule, setSchedule] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const title = useMemo(() => position?.instrumentName || position?.schemeName || "Mutual Fund SIP", [position]);

  useEffect(() => {
    if (!open || !investor?.id || !position?.id) return;
    let active = true;
    setError(""); setNotice(""); setBusy(true);
    getSipFundingOverview(investor.id)
      .then((payload) => {
        if (!active) return;
        const current = (payload.items || []).find((item) => String(item.positionId) === String(position.id)) || null;
        setSchedule(current);
        setForm({
          debitDay: Number(current?.debitDay || 10),
          reminderDays: Array.isArray(current?.reminderDays) && current.reminderDays.length ? current.reminderDays : [5],
          bankName: current?.bankName || "",
          accountLast4: current?.accountLast4 || "",
          sipAmount: Number(current?.sipAmount || position.monthlySip || 0) || ""
        });
      })
      .catch((nextError) => active && setError(nextError.message || "Unable to load SIP reminder."))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [open, investor?.id, position?.id, position?.monthlySip]);

  if (!open) return null;

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      reminderDays: current.reminderDays.includes(day)
        ? current.reminderDays.filter((item) => item !== day)
        : [...current.reminderDays, day].sort((a, b) => b - a)
    }));
  }

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveSipFundingSchedule({
        investorId: investor.id,
        positionId: position.id,
        sipAmount: Number(form.sipAmount || 0),
        debitDay: Number(form.debitDay || 0),
        reminderDays: form.reminderDays,
        bankName: form.bankName,
        accountLast4: form.accountLast4
      });
      setSchedule(result.schedule || { id: result.scheduleId });
      setNotice("SIP funding reminder saved.");
    } catch (nextError) {
      setError(nextError.message || "Unable to save SIP reminder.");
    } finally { setBusy(false); }
  }

  async function disable() {
    if (!schedule?.id) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await disableSipFundingSchedule(schedule.id);
      setSchedule(null);
      setNotice("SIP funding reminder disabled.");
    } catch (nextError) { setError(nextError.message || "Unable to disable SIP reminder."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" onClick={busy ? undefined : onClose} aria-label="Close" />
      <section className="relative z-10 max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><BellRing size={20} /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">SIP funding reminder</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">Configure the pre-debit reminder once. It remains linked to this SIP until staff changes it.</p></div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500"><X size={16} /></button>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
        {notice ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="SIP Amount" required><input type="number" min="0" className={inputClassName} value={form.sipAmount} onChange={(e) => setForm((c) => ({ ...c, sipAmount: e.target.value }))} /></Field>
          <Field label="Monthly Debit Day" required hint="For months with fewer days, GrowVest uses the last valid calendar day."><input type="number" min="1" max="31" className={inputClassName} value={form.debitDay} onChange={(e) => setForm((c) => ({ ...c, debitDay: e.target.value }))} /></Field>
          <Field label="Debit Bank"><input className={inputClassName} value={form.bankName} onChange={(e) => setForm((c) => ({ ...c, bankName: e.target.value }))} placeholder="HDFC Bank" /></Field>
          <Field label="Account Last 4 Digits"><input inputMode="numeric" maxLength={4} className={inputClassName} value={form.accountLast4} onChange={(e) => setForm((c) => ({ ...c, accountLast4: e.target.value.replace(/\D/g, "").slice(-4) }))} placeholder="4582" /></Field>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reminder timing</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SIP_REMINDER_DAY_OPTIONS.map((day) => <label key={day} className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-bold ${form.reminderDays.includes(day) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}><input type="checkbox" className="mr-2" checked={form.reminderDays.includes(day)} onChange={() => toggleDay(day)} />{day === 0 ? "On debit day" : `${day} day${day === 1 ? "" : "s"} before`}</label>)}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          Investor responses route automatically: <strong>withdrawal/transfer or investment discussion → Advisor Follow-up</strong>; <strong>bank/mandate issue → Service Request</strong>; funds available/added simply closes the funding check.
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {schedule?.id ? <Button type="button" variant="secondary" onClick={disable} disabled={busy}>Disable Reminder</Button> : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Close</Button>
          <Button type="button" onClick={save} disabled={busy || !form.reminderDays.length || Number(form.sipAmount || 0) <= 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Save Reminder</Button>
        </div>
      </section>
    </div>
  );
}
