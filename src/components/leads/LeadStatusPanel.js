"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { LEAD_STATUSES, requiresLeadClosureReason } from "@/lib/constants/lead";
import { changeLeadStatus } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { toInputDate } from "@/lib/utils/date";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";

export default function LeadStatusPanel({ lead }) {
  const { profile } = useAuth();
  const [values, setValues] = useState({
    status: lead.status || "NEW",
    nextAction: lead.nextAction || lead.notes || "",
    followUpDue: toInputDate(lead.followUpDue) || lead.followUpDue || "",
    lapseReason: lead.lapseReason || "",
    note: ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setValues({
      status: lead.status || "NEW",
      nextAction: lead.nextAction || lead.notes || "",
      followUpDue: toInputDate(lead.followUpDue) || lead.followUpDue || "",
      lapseReason: lead.lapseReason || "",
      note: ""
    });
  }, [lead.id, lead.status, lead.nextAction, lead.notes, lead.followUpDue, lead.lapseReason]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.nextAction.trim()) {
      setError("Next action is required.");
      return;
    }
    if (values.status === "CONVERTED" && !lead.convertedInvestorId) {
      setError("Complete the assessment and use Convert to Investor before setting CONVERTED.");
      return;
    }
    if (requiresLeadClosureReason(values.status) && !values.lapseReason.trim()) {
      setError("Add the closure or lapse reason before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await changeLeadStatus(lead, values, profile);
      setMessage("Lead action updated successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to update the lead. Check Firestore access and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Pipeline status" required>
          <select className={inputClassName} value={values.status} onChange={(event) => update("status", event.target.value)}>
            {LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </Field>
        <Field label="Follow-up due">
          <input className={inputClassName} type="date" value={values.followUpDue} onChange={(event) => update("followUpDue", event.target.value)} />
        </Field>
      </div>
      <Field label="Next action" required>
        <textarea className={`${inputClassName} min-h-24 resize-y`} value={values.nextAction} onChange={(event) => update("nextAction", event.target.value)} placeholder="What must happen next?" />
      </Field>
      {requiresLeadClosureReason(values.status) ? (
        <Field label="Closure / lapse reason" required>
          <input className={inputClassName} value={values.lapseReason} onChange={(event) => update("lapseReason", event.target.value)} placeholder="Client delay, internal delay, documents pending…" />
        </Field>
      ) : null}
      <Field label="Internal update note" hint="This note appears in the lead activity timeline.">
        <textarea className={`${inputClassName} min-h-20 resize-y`} value={values.note} onChange={(event) => update("note", event.target.value)} placeholder="Optional context for this status update" />
      </Field>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          <Save size={17} /> {saving ? "Saving…" : "Save lead action"}
        </Button>
      </div>
    </form>
  );
}
