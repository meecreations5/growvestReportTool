"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLES } from "@/lib/constants/roles";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";

const ADMIN_ONLY_PREFIXES = ["/users", "/settings"];

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated, isStaff, isInvestor, profile } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace(`/staff-login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isInvestor) {
      router.replace("/investor/dashboard");
      return;
    }

    const isAdminOnly = ADMIN_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

    if (isStaff && isAdminOnly && !ADMIN_ROLES.includes(profile?.role)) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isInvestor, isStaff, loading, pathname, profile?.role, router]);

  const isAdminOnly = ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const lacksAdminAccess = isAdminOnly && !ADMIN_ROLES.includes(profile?.role);

  if (loading || !isAuthenticated || !isStaff || lacksAdminAccess) {
    return <AuthLoadingScreen />;
  }

  return children;
}
