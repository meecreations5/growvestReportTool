import InvestorProtectedRoute from "@/components/auth/InvestorProtectedRoute";
import InvestorShell from "@/components/investor/InvestorShell";
import { InvestorNotificationProvider } from "@/contexts/InvestorNotificationContext";

export default function InvestorLayout({ children }) {
  return (
    <InvestorProtectedRoute>
      <InvestorNotificationProvider>
        <InvestorShell>{children}</InvestorShell>
      </InvestorNotificationProvider>
    </InvestorProtectedRoute>
  );
}
