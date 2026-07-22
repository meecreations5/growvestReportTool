import InvestorEditClient from "@/components/investors/InvestorEditClient";

export default async function InvestorEditPage({ params }) {
  const { investorId } = await params;
  return <InvestorEditClient investorId={investorId} />;
}
