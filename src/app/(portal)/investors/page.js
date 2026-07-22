import InvestorsTable from "@/components/investors/InvestorsTable";
import PageHeader from "@/components/ui/PageHeader";

export default function InvestorsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Client master" title="Investor profiles" description="Qualified leads converted through the SOP 1 client assessment appear here." />
      <InvestorsTable />
    </div>
  );
}
