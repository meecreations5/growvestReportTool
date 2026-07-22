import AssessmentSummaryClient from "@/components/assessment/AssessmentSummaryClient";

export default async function AssessmentSummaryPage({ params }) {
  const { leadId } = await params;
  return <AssessmentSummaryClient leadId={leadId} />;
}
