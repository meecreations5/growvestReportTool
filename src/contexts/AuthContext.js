"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { resolveUserProfile } from "@/services/authService";
import { getInvestorAccessProfiles } from "@/services/investorAccessService";
import { USER_ROLES, isStaffRole } from "@/lib/constants/roles";
import { validateApplicationProfile } from "@/lib/auth/session";
import { clearStoredActiveInvestorId, getStoredActiveInvestorId, setStoredActiveInvestorId } from "@/lib/auth/investorAccess";
import { clearWorkspaceCaches } from "@/lib/utils/offlineAccess";
import { clearWorkspaceSearchCache } from "@/services/workspaceSearchService";
import { disablePushNotifications, isPushEnabledLocally } from "@/services/pushNotificationService";
import {
  buildDemoAuthProfile,
  clearGuestDemoSession,
  createGuestDemoSession,
  getGuestDemoSession,
  storeGuestDemoSession
} from "@/lib/demo/investorDemo";

const AuthContext = createContext(null);

function mergeInvestorProfile(baseProfile, accessProfile) {
  if (!baseProfile || !accessProfile) return baseProfile;
  return {
    ...baseProfile,
    primaryInvestorId: baseProfile.primaryInvestorId || baseProfile.investorId,
    investorId: accessProfile.investorId,
    activeInvestorId: accessProfile.investorId,
    fullName: accessProfile.fullName || baseProfile.fullName,
    clientCode: accessProfile.clientCode || "",
    photoURL: accessProfile.photoURL || baseProfile.photoURL || "",
    investorRelationship: accessProfile.relationship || (accessProfile.isPrimary ? "Self" : "Family Member"),
    investorPermission: accessProfile.permission || "full"
  };
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [demoSession, setDemoSession] = useState(null);
  const [baseProfile, setBaseProfile] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessProfiles, setAccessProfiles] = useState([]);
  const [activeInvestorId, setActiveInvestorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorizationError, setAuthorizationError] = useState("");

  const loadProfile = useCallback(async (user) => {
    const nextBaseProfile = await resolveUserProfile(user);
    const validationError = validateApplicationProfile(user, nextBaseProfile);

    if (validationError) {
      setAuthorizationError(validationError);
      setBaseProfile(null);
      setProfile(null);
      setAccessProfiles([]);
      setActiveInvestorId("");
      await signOut(auth);
      return null;
    }

    setAuthorizationError("");
    clearGuestDemoSession();
    setDemoSession(null);
    setBaseProfile(nextBaseProfile);

    if (nextBaseProfile?.role === USER_ROLES.INVESTOR) {
      let profiles = [];
      try {
        profiles = await getInvestorAccessProfiles(user);
      } catch (error) {
        console.warn("Unable to load family Investor access profiles", error);
      }

      if (!profiles.length && nextBaseProfile.investorId) {
        profiles = [{
          investorId: nextBaseProfile.investorId,
          fullName: nextBaseProfile.fullName || "GrowVest Investor",
          clientCode: nextBaseProfile.clientCode || "",
          photoURL: nextBaseProfile.photoURL || "",
          relationship: "Self",
          permission: "full",
          isPrimary: true,
          portalEnabled: true
        }];
      }

      setAccessProfiles(profiles);
      const stored = getStoredActiveInvestorId(user.uid);
      const selected = profiles.find((item) => item.investorId === stored)
        || profiles.find((item) => item.investorId === nextBaseProfile.investorId)
        || profiles[0]
        || null;

      if (selected) {
        setStoredActiveInvestorId(user.uid, selected.investorId);
        setActiveInvestorId(selected.investorId);
        const nextProfile = mergeInvestorProfile(nextBaseProfile, selected);
        setProfile(nextProfile);
        return nextProfile;
      }
    }

    setAccessProfiles([]);
    setActiveInvestorId("");
    setProfile(nextBaseProfile);
    return nextBaseProfile;
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
          const storedDemoSession = getGuestDemoSession();
          if (storedDemoSession) {
            const demoProfile = buildDemoAuthProfile(storedDemoSession);
            setDemoSession(storedDemoSession);
            setBaseProfile(demoProfile);
            setProfile(demoProfile);
            setAccessProfiles([]);
            setActiveInvestorId(demoProfile?.investorId || "");
            setAuthorizationError("");
          } else {
            setDemoSession(null);
            setBaseProfile(null);
            setProfile(null);
            setAccessProfiles([]);
            setActiveInvestorId("");
          }
          setLoading(false);
          return;
        }

        try {
          await loadProfile(user);
        } catch (error) {
          console.error("Unable to load user profile", error);
          setAuthorizationError("Unable to verify your GrowVest access. Please try again.");
          setBaseProfile(null);
          setProfile(null);
          setAccessProfiles([]);
          setActiveInvestorId("");
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
    if (demoSession) return buildDemoAuthProfile(demoSession);
    if (!auth.currentUser) return null;
    setLoading(true);
    try {
      return await loadProfile(auth.currentUser);
    } finally {
      setLoading(false);
    }
  }, [demoSession, loadProfile]);

  const startDemoInvestor = useCallback(async (details = {}) => {
    setLoading(true);
    setAuthorizationError("");
    try {
      const session = createGuestDemoSession(details);
      storeGuestDemoSession(session);
      if (auth.currentUser) await signOut(auth);
      const demoProfile = buildDemoAuthProfile(session);
      setFirebaseUser(null);
      setDemoSession(session);
      setBaseProfile(demoProfile);
      setProfile(demoProfile);
      setAccessProfiles([]);
      setActiveInvestorId(demoProfile.investorId);
      clearWorkspaceCaches();
      clearWorkspaceSearchCache();
      if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
      }
      return demoProfile;
    } finally {
      setLoading(false);
    }
  }, []);

  const switchInvestor = useCallback((investorId) => {
    if (!firebaseUser?.uid || !baseProfile || baseProfile.role !== USER_ROLES.INVESTOR) return false;
    const selected = accessProfiles.find((item) => item.investorId === investorId && item.portalEnabled !== false);
    if (!selected) return false;
    setStoredActiveInvestorId(firebaseUser.uid, selected.investorId);
    setActiveInvestorId(selected.investorId);
    setProfile(mergeInvestorProfile(baseProfile, selected));
    clearWorkspaceCaches();
    clearWorkspaceSearchCache();
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
    }
    return true;
  }, [accessProfiles, baseProfile, firebaseUser?.uid]);

  const logout = useCallback(async () => {
    setAuthorizationError("");
    clearWorkspaceCaches();
    clearWorkspaceSearchCache();
    const demoLogout = profile?.role === USER_ROLES.DEMO_INVESTOR || Boolean(demoSession);
    if (demoLogout) {
      clearGuestDemoSession();
      setDemoSession(null);
      setBaseProfile(null);
      setProfile(null);
      setAccessProfiles([]);
      setActiveInvestorId("");
    }
    if (profile?.role === USER_ROLES.INVESTOR && isPushEnabledLocally()) {
      try { await disablePushNotifications(); }
      catch (error) { console.warn("Push subscription could not be removed during logout", error); }
    }
    if (firebaseUser?.uid) clearStoredActiveInvestorId(firebaseUser.uid);
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
    }
    if (auth.currentUser) await signOut(auth);
  }, [demoSession, firebaseUser?.uid, profile?.role]);

  const value = useMemo(() => {
    const isDemoInvestor = profile?.role === USER_ROLES.DEMO_INVESTOR && Boolean(demoSession);
    const isAuthenticated = Boolean((firebaseUser || demoSession) && profile && profile.status === "active");
    const isStaff = isAuthenticated && isStaffRole(profile?.role);
    const isInvestor = isAuthenticated && [USER_ROLES.INVESTOR, USER_ROLES.DEMO_INVESTOR].includes(profile?.role);

    return {
      firebaseUser,
      demoSession,
      profile,
      baseProfile,
      accessProfiles,
      activeInvestorId,
      hasMultipleInvestorProfiles: !isDemoInvestor && accessProfiles.length > 1,
      switchInvestor,
      startDemoInvestor,
      loading,
      authorizationError,
      clearAuthorizationError: () => setAuthorizationError(""),
      refreshProfile,
      logout,
      isAuthenticated,
      isStaff,
      isInvestor,
      isDemoInvestor
    };
  }, [accessProfiles, activeInvestorId, authorizationError, baseProfile, demoSession, firebaseUser, loading, logout, profile, refreshProfile, startDemoInvestor, switchInvestor]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
