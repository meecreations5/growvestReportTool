import InsuranceProtectionCentre from "@/components/insurance/InsuranceProtectionCentre";
export default async function InsuranceProtectionPage({ searchParams }) {
  const params = await searchParams;
  return <InsuranceProtectionCentre initialInvestorId={String(params?.investorId || "")} />;
}
