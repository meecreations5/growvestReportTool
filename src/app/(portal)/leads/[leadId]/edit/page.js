"use client";

import { use, useEffect, useState } from "react";
import { getLead } from "@/services/leadService";
import PageHeader from "@/components/ui/PageHeader";
import LeadForm from "@/components/leads/LeadForm";

export default function EditLeadPage({ params }) {
  const { leadId } = use(params);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getLead(leadId)
      .then((item) => {
        if (!item) throw new Error("Lead not found");
        setLead(item);
      })
      .catch((err) => setError(err.message || "Unable to load lead."))
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading lead…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">{error}</div>;

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader eyebrow="SOP 1 · Lead record" title={`Edit ${lead.fullName}`} description="Update contact, assignment and opportunity details. Reassignment is recorded in the activity timeline." />
      <LeadForm lead={lead} />
    </div>
  );
}
