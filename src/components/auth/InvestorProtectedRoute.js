"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";

export default function InvestorProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated, isInvestor, isStaff } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace(`/investor-login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isStaff) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isInvestor, isStaff, loading, pathname, router]);

  if (loading || !isAuthenticated || !isInvestor) {
    return <AuthLoadingScreen label="Loading your investor portal…" />;
  }

  return children;
}
