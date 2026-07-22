import ReportPrintClient from "@/components/reports/ReportPrintClient";

export default async function ReportPrintPage({ params }) {
  const { reportId } = await params;
  return <ReportPrintClient reportId={reportId} />;
}
