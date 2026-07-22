import ReportTemplateDetail from "@/components/report-templates/ReportTemplateDetail";

export default async function ReportTemplateDetailPage({ params }) {
  const { templateId } = await params;
  return <ReportTemplateDetail templateId={templateId} />;
}
