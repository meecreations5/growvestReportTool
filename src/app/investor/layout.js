import InvestorProtectedRoute from "@/components/auth/InvestorProtectedRoute";
import InvestorShell from "@/components/investor/InvestorShell";

export default function InvestorLayout({ children }) {
  return (
    <InvestorProtectedRoute>
      <InvestorShell>{children}</InvestorShell>
    </InvestorProtectedRoute>
  );
}
