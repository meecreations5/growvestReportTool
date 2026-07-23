"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { NAV_ITEMS } from "@/lib/constants/navigation";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";

const ROUTE_PERMISSIONS = [
  ["/my-signature", "signatures"],
  ["/users", "users"],
  ["/settings", "branding"],
  ["/report-templates", "templates"],
  ["/market-commentary", "commentary"],
  ["/email-delivery", "delivery"],
  ["/data-imports", "imports"],
  ["/servicing", "servicing"],
  ["/investors", "investors"],
  ["/meetings", "meetings"],
  ["/mom", "meetings"],
  ["/reports", "reports"],
  ["/leads", "leads"],
  ["/dashboard", "dashboard"]
];

function permissionForPath(pathname) {
  return ROUTE_PERMISSIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] || "";
}

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated, isStaff, isInvestor, profile } = useAuth();
  const { loading: permissionLoading, canAccess } = usePermissions();
  const requiredPermission = permissionForPath(pathname);
  const lacksPermission = Boolean(requiredPermission) && !canAccess(requiredPermission);

  const fallbackRoute = useMemo(() => {
    const item = NAV_ITEMS.find((entry) => entry.roles.includes(profile?.role) && canAccess(entry.permission));
    return item?.href || "/staff-login";
  }, [canAccess, profile?.role]);

  useEffect(() => {
    if (loading || permissionLoading) return;

    if (!isAuthenticated) {
      router.replace(`/staff-login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isInvestor) {
      router.replace("/investor/dashboard");
      return;
    }

    if (isStaff && lacksPermission) {
      router.replace(fallbackRoute);
    }
  }, [fallbackRoute, isAuthenticated, isInvestor, isStaff, lacksPermission, loading, pathname, permissionLoading, router]);

  if (loading || permissionLoading || !isAuthenticated || !isStaff || lacksPermission) {
    return <AuthLoadingScreen />;
  }

  return children;
}
