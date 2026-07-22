import InvestorReportDetailClient from "@/components/reports/InvestorReportDetailClient";

export default async function InvestorMonthlyReportPage({ params }) {
  const { reportId } = await params;
  return <InvestorReportDetailClient reportId={reportId} />;
}
