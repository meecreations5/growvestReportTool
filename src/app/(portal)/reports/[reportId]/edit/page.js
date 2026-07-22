import ReportForm from "@/components/reports/ReportForm";

export default async function EditMonthlyReportPage({ params }) {
  const { reportId } = await params;
  return <ReportForm reportId={reportId} />;
}
