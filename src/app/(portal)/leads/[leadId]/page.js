import LeadDetailClient from "@/components/leads/LeadDetailClient";

export default async function LeadDetailPage({ params }) {
  const { leadId } = await params;
  return <LeadDetailClient leadId={leadId} />;
}
