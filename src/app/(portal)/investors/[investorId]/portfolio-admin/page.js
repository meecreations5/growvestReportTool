import InvestorPortfolioAdministration from "@/components/portfolio/InvestorPortfolioAdministration";

export default async function InvestorPortfolioAdministrationPage({ params }) {
  const { investorId } = await params;
  return <InvestorPortfolioAdministration investorId={investorId} />;
}
