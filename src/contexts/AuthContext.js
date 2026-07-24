"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { resolveUserProfile } from "@/services/authService";
import { USER_ROLES, isStaffRole } from "@/lib/constants/roles";
import { validateApplicationProfile } from "@/lib/auth/session";
import { clearWorkspaceCaches } from "@/lib/utils/offlineAccess";
import { clearWorkspaceSearchCache } from "@/services/workspaceSearchService";
import { disablePushNotifications, isPushEnabledLocally } from "@/services/pushNotificationService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorizationError, setAuthorizationError] = useState("");

  const loadProfile = useCallback(async (user) => {
    const nextProfile = await resolveUserProfile(user);
    const validationError = validateApplicationProfile(user, nextProfile);

    if (validationError) {
      setAuthorizationError(validationError);
      setProfile(null);
      await signOut(auth);
      return null;
    }

    setAuthorizationError("");
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};

    async function initialiseAuthentication() {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.error("Unable to set Firebase session persistence", error);
      }

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setLoading(true);
        setFirebaseUser(user);

        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        try {
          await loadProfile(user);
        } catch (error) {
          console.error("Unable to load user profile", error);
          setAuthorizationError("Unable to verify your GrowVest access. Please try again.");
          setProfile(null);
          await signOut(auth);
        } finally {
          setLoading(false);
        }
      });
    }

    initialiseAuthentication();
    return () => unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return null;
    setLoading(true);
    try {
      return await loadProfile(auth.currentUser);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  const logout = useCallback(async () => {
    setAuthorizationError("");
    clearWorkspaceCaches();
    clearWorkspaceSearchCache();
    if (profile?.role === USER_ROLES.INVESTOR && isPushEnabledLocally()) {
      try { await disablePushNotifications(); }
      catch (error) { console.warn("Push subscription could not be removed during logout", error); }
    }
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
    }
    await signOut(auth);
  }, [profile?.role]);

  const value = useMemo(() => {
    const isAuthenticated = Boolean(firebaseUser && profile && profile.status === "active");
    const isStaff = isAuthenticated && isStaffRole(profile?.role);
    const isInvestor = isAuthenticated && profile?.role === USER_ROLES.INVESTOR;

    return {
      firebaseUser,
      profile,
      loading,
      authorizationError,
      clearAuthorizationError: () => setAuthorizationError(""),
      refreshProfile,
      logout,
      isAuthenticated,
      isStaff,
      isInvestor
    };
  }, [authorizationError, firebaseUser, loading, logout, profile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
