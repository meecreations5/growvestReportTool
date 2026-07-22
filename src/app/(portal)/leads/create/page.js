import PageHeader from "@/components/ui/PageHeader";
import LeadForm from "@/components/leads/LeadForm";

export default function CreateLeadPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader eyebrow="SOP 1 · New lead" title="Create lead" description="Lead ID is generated automatically after the record is saved." />
      <LeadForm />
    </div>
  );
}
