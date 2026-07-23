import EmailTemplateEditor from "@/components/email-templates/EmailTemplateEditor";

export default async function EditEmailTemplatePage({ params }) {
  const { templateId } = await params;
  return <EmailTemplateEditor templateId={templateId} />;
}
