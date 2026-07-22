import ReportTemplateEditor from "@/components/report-templates/ReportTemplateEditor";

export default async function EditReportTemplatePage({ params }) {
  const { templateId } = await params;
  return <ReportTemplateEditor templateId={templateId} />;
}
