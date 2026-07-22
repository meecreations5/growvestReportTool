import AssessmentPageClient from "@/components/assessment/AssessmentPageClient";

export default async function LeadAssessmentPage({ params }) {
  const { leadId } = await params;
  return <AssessmentPageClient leadId={leadId} />;
}
