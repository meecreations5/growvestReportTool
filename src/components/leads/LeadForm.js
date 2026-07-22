"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Save } from "lucide-react";
import { leadSchema } from "@/lib/validation/leadSchema";
import { LEAD_SOURCES, LEAD_STATUSES, SERVICE_TYPES } from "@/lib/constants/lead";
import { createLead, getActiveAdvisors, updateLeadDetails } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, inputClassName } from "@/components/ui/Field";

const today = new Date().toISOString().slice(0, 10);
const currentTime = new Date().toTimeString().slice(0, 5);

const initialValues = {
  fullName: "",
  contactNo: "",
  email: "",
  leadSource: "Referral",
  referrer: "",
  dateReceived: today,
  timeReceived: currentTime,
  assignedAdvisorUid: "",
  assignedAdvisorName: "",
  status: "NEW",
  qualificationScore: "",
  serviceType: "Financial Planning",
  amount: "",
  purposeOfInvestment: "",
  followUpDue: "",
  notes: ""
};

export default function LeadForm({ lead = null }) {
  const router = useRouter();
  const { profile } = useAuth();
  const editing = Boolean(lead?.id);
  const [values, setValues] = useState(() => lead ? {
    fullName: lead.fullName || "",
    contactNo: lead.contactNo || "",
    email: lead.email || "",
    leadSource: lead.leadSource || "Referral",
    referrer: lead.referrer || "",
    dateReceived: lead.dateReceived || today,
    timeReceived: lead.timeReceived || currentTime,
    assignedAdvisorUid: lead.assignedAdvisorUid || "",
    assignedAdvisorName: lead.assignedAdvisorName || "",
    status: lead.status || "NEW",
    qualificationScore: lead.qualificationScore ?? "",
    serviceType: lead.serviceType || "Financial Planning",
    amount: lead.amount ?? "",
    purposeOfInvestment: lead.purposeOfInvestment || "",
    followUpDue: lead.followUpDue || "",
    notes: lead.notes || lead.nextAction || ""
  } : initialValues);
  const [advisors, setAdvisors] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "advisor") {
      setAdvisors([profile]);
      setValues((current) => ({ ...current, assignedAdvisorUid: current.assignedAdvisorUid || profile.id, assignedAdvisorName: current.assignedAdvisorName || profile.fullName }));
      return;
    }

    getActiveAdvisors()
      .then((items) => {
        if (lead?.assignedAdvisorUid && !items.some((item) => item.id === lead.assignedAdvisorUid)) {
          setAdvisors([{ id: lead.assignedAdvisorUid, fullName: lead.assignedAdvisorName || "Current advisor" }, ...items]);
        } else {
          setAdvisors(items);
        }
      })
      .catch(() => setFormError("Unable to load advisors. Check Firestore access and indexes."));
  }, [profile, lead]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const selectedAdvisor = advisors.find((item) => item.id === values.assignedAdvisorUid);
    const payload = { ...values, assignedAdvisorName: selectedAdvisor?.fullName || values.assignedAdvisorName };
    if (payload.status === "CONVERTED" && !lead?.convertedInvestorId) {
      setFormError("A lead can be marked CONVERTED only through the assessment conversion workflow.");
      return;
    }

    const result = leadSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) fieldErrors[issue.path[0]] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateLeadDetails(lead, result.data, profile);
        router.push(`/leads/${lead.id}`);
      } else {
        const leadRef = await createLead(result.data, profile);
        router.push(`/leads/${leadRef.id}`);
      }
    } catch (error) {
      console.error(error);
      setFormError(`Lead could not be ${editing ? "updated" : "created"}. Verify Firebase configuration and Firestore rules.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {formError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</div> : null}

      <Card className="p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Lead identity</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Contact and source information</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Full name" required error={errors.fullName}>
            <input className={inputClassName} value={values.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Investor or prospect name" />
          </Field>
          <Field label="Contact number" required error={errors.contactNo}>
            <input className={inputClassName} value={values.contactNo} onChange={(e) => update("contactNo", e.target.value.replace(/[^0-9+]/g, ""))} placeholder="10-digit mobile number" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputClassName} type="email" value={values.email} onChange={(e) => update("email", e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="Lead source" required error={errors.leadSource}>
            <select className={inputClassName} value={values.leadSource} onChange={(e) => update("leadSource", e.target.value)}>
              {LEAD_SOURCES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Referrer">
            <input className={inputClassName} value={values.referrer} onChange={(e) => update("referrer", e.target.value)} placeholder="Referrer name" />
          </Field>
          <Field label="Assigned advisor" required error={errors.assignedAdvisorUid}>
            <select className={inputClassName} value={values.assignedAdvisorUid} onChange={(e) => update("assignedAdvisorUid", e.target.value)} disabled={profile?.role === "advisor"}>
              <option value="">Select advisor</option>
              {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.fullName}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Opportunity</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Requirement and pipeline position</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Date received" required error={errors.dateReceived}>
            <input className={inputClassName} type="date" value={values.dateReceived} onChange={(e) => update("dateReceived", e.target.value)} />
          </Field>
          <Field label="Time received" required error={errors.timeReceived}>
            <input className={inputClassName} type="time" value={values.timeReceived} onChange={(e) => update("timeReceived", e.target.value)} />
          </Field>
          <Field label="Status" required error={errors.status}>
            <select className={`${inputClassName} ${editing ? "bg-slate-100 text-slate-500" : ""}`} value={values.status} disabled={editing} onChange={(e) => update("status", e.target.value)}>
              {LEAD_STATUSES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Service type" required error={errors.serviceType}>
            <select className={inputClassName} value={values.serviceType} onChange={(e) => update("serviceType", e.target.value)}>
              {SERVICE_TYPES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Indicative amount (₹)">
            <input className={inputClassName} type="number" min="0" value={values.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0" />
          </Field>
          <Field label="Qualification score" hint="SOP score from 0 to 5">
            <input className={inputClassName} type="number" min="0" max="5" step="0.5" value={values.qualificationScore} onChange={(e) => update("qualificationScore", e.target.value)} placeholder="0–5" />
          </Field>
          <Field label="Purpose of investment" error={errors.purposeOfInvestment}>
            <input className={inputClassName} value={values.purposeOfInvestment} onChange={(e) => update("purposeOfInvestment", e.target.value)} placeholder="Savings, retirement, education…" />
          </Field>
          <Field label="Follow-up due">
            <input className={inputClassName} type="date" value={values.followUpDue} onChange={(e) => update("followUpDue", e.target.value)} />
          </Field>
        </div>
        <div className="mt-5">
          <Field label="Notes / next action">
            <textarea className={`${inputClassName} min-h-28 resize-y`} value={values.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Record the immediate next action and context." />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <CalendarPlus size={17} className="animate-pulse" /> : <Save size={17} />}
          {submitting ? (editing ? "Saving lead…" : "Creating lead…") : (editing ? "Save lead" : "Create lead")}
        </Button>
      </div>
    </form>
  );
}
