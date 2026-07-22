import InvestorDetailClient from "@/components/investors/InvestorDetailClient";

export default async function InvestorDetailPage({ params }) {
  const { investorId } = await params;
  return <InvestorDetailClient investorId={investorId} />;
}
