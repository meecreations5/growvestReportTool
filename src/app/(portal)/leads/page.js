import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import LeadsTable from "@/components/leads/LeadsTable";

export default function LeadsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="SOP 1 · Pipeline"
        title="Lead management"
        description="Capture every lead when it arrives, assign an advisor, monitor pipeline status and preserve the next action."
        action={
          <Link href="/leads/create" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200">
            <Plus size={17} /> Create lead
          </Link>
        }
      />
      <LeadsTable />
    </div>
  );
}
