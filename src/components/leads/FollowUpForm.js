"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { CONTACT_CHANNELS, LEAD_STATUSES, requiresLeadClosureReason } from "@/lib/constants/lead";
import { followUpSchema } from "@/lib/validation/followUpSchema";
import { addLeadFollowUp } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";

function currentLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function initialValues(status) {
  return {
    contactDate: currentLocalDate(),
    contactTime: new Date().toTimeString().slice(0, 5),
    channel: "Call",
    summary: "",
    clientResponse: "",
    statusAfter: status || "NEW",
    lapseReason: "",
    nextAction: "",
    followUpDue: ""
  };
}

export default function FollowUpForm({ lead }) {
  const { profile } = useAuth();
  const [values, setValues] = useState(() => initialValues(lead.status));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues((current) => ({ ...current, statusAfter: lead.status || "NEW" }));
  }, [lead.status]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    if (values.statusAfter === "CONVERTED" && !lead.convertedInvestorId) {
      setFormError("Convert the assessed lead into an investor before selecting CONVERTED.");
      return;
    }

    const result = followUpSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) fieldErrors[issue.path[0]] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await addLeadFollowUp(lead, result.data, profile);
      setValues(initialValues(result.data.statusAfter));
      setErrors({});
      setSuccess("Follow-up recorded and the lead timeline was updated.");
    } catch (error) {
      console.error(error);
      setFormError("Follow-up could not be saved. Check Firestore rules and indexes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="add-follow-up" onSubmit={handleSubmit} className="grid gap-5 scroll-mt-28">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Contact date" required error={errors.contactDate}>
          <input className={inputClassName} type="date" value={values.contactDate} onChange={(event) => update("contactDate", event.target.value)} />
        </Field>
        <Field label="Contact time" required error={errors.contactTime}>
          <input className={inputClassName} type="time" value={values.contactTime} onChange={(event) => update("contactTime", event.target.value)} />
        </Field>
        <Field label="Channel" required error={errors.channel}>
          <select className={inputClassName} value={values.channel} onChange={(event) => update("channel", event.target.value)}>
            {CONTACT_CHANNELS.map((channel) => <option key={channel}>{channel}</option>)}
          </select>
        </Field>
        <Field label="Status after contact" required error={errors.statusAfter}>
          <select className={inputClassName} value={values.statusAfter} onChange={(event) => update("statusAfter", event.target.value)}>
            {LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Discussion summary" required error={errors.summary}>
        <textarea className={`${inputClassName} min-h-28 resize-y`} value={values.summary} onChange={(event) => update("summary", event.target.value)} placeholder="What was discussed or communicated?" />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Client response" error={errors.clientResponse}>
          <textarea className={`${inputClassName} min-h-24 resize-y`} value={values.clientResponse} onChange={(event) => update("clientResponse", event.target.value)} placeholder="Interested, needs time, documents pending…" />
        </Field>
        <Field label="Next action" required error={errors.nextAction}>
          <textarea className={`${inputClassName} min-h-24 resize-y`} value={values.nextAction} onChange={(event) => update("nextAction", event.target.value)} placeholder="Share proposal, collect documents, schedule meeting…" />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Next follow-up due" error={errors.followUpDue}>
          <input className={inputClassName} type="date" value={values.followUpDue} onChange={(event) => update("followUpDue", event.target.value)} />
        </Field>
        {requiresLeadClosureReason(values.statusAfter) ? (
          <Field label="Closure / lapse reason" required error={errors.lapseReason}>
            <input className={inputClassName} value={values.lapseReason} onChange={(event) => update("lapseReason", event.target.value)} placeholder="Reason for the missed deadline" />
          </Field>
        ) : <div />}
      </div>

      {formError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          <MessageSquarePlus size={17} /> {submitting ? "Saving follow-up…" : "Save follow-up"}
        </Button>
      </div>
    </form>
  );
}
