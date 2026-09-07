import InvestorProtectedRoute from "@/components/auth/InvestorProtectedRoute";
import InvestorShell from "@/components/investor/InvestorShell";
import { InvestorNotificationProvider } from "@/contexts/InvestorNotificationContext";
import { InvestorPrivacyProvider } from "@/contexts/InvestorPrivacyContext";

export default function InvestorLayout({ children }) {
  return (
    <InvestorProtectedRoute>
      <InvestorNotificationProvider>
        <InvestorPrivacyProvider>
          <InvestorShell>{children}</InvestorShell>
        </InvestorPrivacyProvider>
      </InvestorNotificationProvider>
    </InvestorProtectedRoute>
  );
}
