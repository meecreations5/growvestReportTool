import InvestorProtectedRoute from "@/components/auth/InvestorProtectedRoute";
import InvestorShell from "@/components/investor/InvestorShell";
import InvestorSecurityGate from "@/components/investor/InvestorSecurityGate";
import { InvestorNotificationProvider } from "@/contexts/InvestorNotificationContext";
import { InvestorPrivacyProvider } from "@/contexts/InvestorPrivacyContext";

export default function InvestorLayout({ children }) {
  return (
    <InvestorProtectedRoute>
      <InvestorSecurityGate>
        <InvestorNotificationProvider>
          <InvestorPrivacyProvider>
            <InvestorShell>{children}</InvestorShell>
          </InvestorPrivacyProvider>
        </InvestorNotificationProvider>
      </InvestorSecurityGate>
    </InvestorProtectedRoute>
  );
}
