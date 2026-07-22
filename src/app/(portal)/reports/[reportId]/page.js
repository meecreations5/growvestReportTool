import ReportDetailClient from "@/components/reports/ReportDetailClient";

export default async function MonthlyReportDetailPage({ params }) {
  const { reportId } = await params;
  return <ReportDetailClient reportId={reportId} />;
}
