"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  ACCESS_LEVELS,
  DEFAULT_ROLE_PERMISSIONS,
  canAccessPermission,
  resolveEffectivePermissions
} from "@/lib/constants/permissions";
import { subscribePermissionSettings } from "@/services/permissionService";

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { profile, isAuthenticated } = useAuth();
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [userOverrides, setUserOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !profile) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    return subscribePermissionSettings(({ rolePermissions: nextRolePermissions }) => {
      setRolePermissions(nextRolePermissions);
      setError("");
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError("Permission settings could not be loaded. Default role access is being used.");
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      setLoading(false);
    });
  }, [isAuthenticated, profile]);


  useEffect(() => {
    if (!isAuthenticated || !profile?.id) {
      setUserOverrides({});
      return undefined;
    }
    setUserOverrides(profile.permissionOverrides || {});
    return onSnapshot(doc(db, "users", profile.id), (snapshot) => {
      setUserOverrides(snapshot.exists() ? (snapshot.data().permissionOverrides || {}) : {});
    }, (nextError) => {
      console.warn("Permission overrides could not be refreshed", nextError);
    });
  }, [isAuthenticated, profile?.id, profile?.permissionOverrides]);

  const effectivePermissions = useMemo(() => resolveEffectivePermissions(
    profile?.role,
    rolePermissions,
    userOverrides
  ), [profile?.role, rolePermissions, userOverrides]);

  const value = useMemo(() => ({
    rolePermissions,
    effectivePermissions,
    loading,
    error,
    accessLevel(permissionKey) {
      return effectivePermissions[permissionKey] || ACCESS_LEVELS.NONE;
    },
    canAccess(permissionKey) {
      return canAccessPermission(effectivePermissions, permissionKey);
    },
    canManage(permissionKey) {
      const level = effectivePermissions[permissionKey] || ACCESS_LEVELS.NONE;
      return ![ACCESS_LEVELS.NONE, ACCESS_LEVELS.VIEW].includes(level);
    }
  }), [effectivePermissions, error, loading, rolePermissions]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error("usePermissions must be used inside PermissionProvider");
  return context;
}
