import InvestorDetailClient from "@/components/investors/InvestorDetailClient";

const ALLOWED_TABS = new Set([
  "overview",
  "goals",
  "portfolio",
  "protection",
  "withdrawals",
  "reports",
  "actions",
  "meetings",
  "assessment",
  "access",
  "activity"
]);

export default async function InvestorDetailPage({ params, searchParams }) {
  const { investorId } = await params;
  const query = await searchParams;
  const requestedTab = String(query?.tab || "overview");
  const initialTab = ALLOWED_TABS.has(requestedTab) ? requestedTab : "overview";
  return <InvestorDetailClient investorId={investorId} initialTab={initialTab} />;
}
