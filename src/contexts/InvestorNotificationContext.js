"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
  subscribeNotifications
} from "@/services/notificationService";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushCapability,
  isPushEnabledLocally,
  sendPushTest,
  syncPushSubscription
} from "@/services/pushNotificationService";

const InvestorNotificationContext = createContext(null);
const IN_APP_KEY = "growvest-investor-in-app-alerts";

function readStoredBoolean(key, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

export function InvestorNotificationProvider({ children }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [inAppAlerts, setInAppAlertsState] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushPermission, setPushPermission] = useState("default");
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushCategories, setPushCategories] = useState(DEFAULT_NOTIFICATION_PREFERENCES.pushCategories);
  const initialisedRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    setInAppAlertsState(readStoredBoolean(IN_APP_KEY, true));

    getPushCapability().then((capability) => {
      if (cancelled) return;
      setPushSupported(Boolean(capability.supported));
      setPushConfigured(Boolean(capability.configured));
      setPushPermission(capability.permission || (capability.supported ? "default" : "unsupported"));
      setPushEnabledState(Boolean(capability.supported && capability.configured && capability.permission === "granted" && isPushEnabledLocally()));
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let cancelled = false;

    if (isPushEnabledLocally()) {
      syncPushSubscription().then((result) => {
        if (cancelled) return;
        setPushEnabledState(Boolean(result.enabled));
        setPushPermission(result.permission || "default");
      }).catch((nextError) => {
        console.warn("Push subscription could not be refreshed", nextError);
        if (!cancelled) setPushMessage("Push alerts need to be enabled again on this device.");
      });
    }

    getNotificationPreferences(profile.id).then((preferences) => {
      if (cancelled) return;
      setInAppAlertsState(preferences.inAppEnabled !== false && readStoredBoolean(IN_APP_KEY, true));
      setPushCategories({
        ...DEFAULT_NOTIFICATION_PREFERENCES.pushCategories,
        ...(preferences.pushCategories || {})
      });
    }).catch((nextError) => console.warn("Notification preferences could not be loaded", nextError));

    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    initialisedRef.current = false;
    knownIdsRef.current = new Set();

    if (!profile?.id) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    return subscribeNotifications(
      profile,
      (nextItems) => {
        const fresh = initialisedRef.current
          ? nextItems.filter((item) => !knownIdsRef.current.has(item.id) && item.status !== "read")
          : [];

        setItems(nextItems);
        knownIdsRef.current = new Set(nextItems.map((item) => item.id));
        setLoading(false);
        setError("");

        if (!initialisedRef.current) {
          initialisedRef.current = true;
          return;
        }

        fresh.slice(0, 3).forEach((item) => {
          if (!inAppAlerts) return;
          setToasts((current) => [...current.filter((toast) => toast.id !== item.id), item].slice(-3));
          window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== item.id)), 6500);
        });
      },
      (nextError) => {
        console.error(nextError);
        setError("Notifications could not be loaded.");
        setLoading(false);
      }
    );
  }, [inAppAlerts, profile]);

  const unreadItems = useMemo(() => items.filter((item) => item.status !== "read"), [items]);

  const markRead = useCallback(async (notificationId) => {
    setItems((current) => current.map((item) => item.id === notificationId ? { ...item, status: "read", readAt: new Date() } : item));
    await markNotificationRead(notificationId);
  }, []);

  const markAllRead = useCallback(async () => {
    const currentItems = items;
    setItems((current) => current.map((item) => ({ ...item, status: "read", readAt: item.readAt || new Date() })));
    await markAllNotificationsRead(currentItems);
  }, [items]);

  const openNotification = useCallback(async (item) => {
    if (item.status !== "read") {
      try { await markRead(item.id); } catch (nextError) { console.error(nextError); }
    }
    setToasts((current) => current.filter((toast) => toast.id !== item.id));
    router.push(item.link || "/investor/notifications");
  }, [markRead, router]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const setInAppAlerts = useCallback(async (enabled) => {
    setInAppAlertsState(enabled);
    window.localStorage.setItem(IN_APP_KEY, String(enabled));
    if (profile?.id) {
      try { await saveNotificationPreferences(profile.id, { inAppEnabled: enabled }); }
      catch (nextError) { console.warn("In-app preference could not be saved", nextError); }
    }
  }, [profile?.id]);

  const setPushAlerts = useCallback(async (enabled) => {
    setPushBusy(true);
    setPushMessage("");
    try {
      const result = enabled ? await enablePushNotifications() : await disablePushNotifications();
      setPushPermission(result.permission || window.Notification?.permission || "default");
      setPushEnabledState(Boolean(result.enabled));
      setPushMessage(result.enabled
        ? "Push notifications are active on this device."
        : result.permission === "denied"
          ? "Notifications are blocked in browser settings."
          : "Push notifications are disabled on this device.");
      return result;
    } catch (nextError) {
      console.error(nextError);
      setPushMessage(nextError.message || "Push notification settings could not be changed.");
      throw nextError;
    } finally {
      setPushBusy(false);
    }
  }, []);

  const updatePushCategory = useCallback(async (category, enabled) => {
    const next = { ...pushCategories, [category]: enabled };
    setPushCategories(next);
    if (profile?.id) {
      try { await saveNotificationPreferences(profile.id, { pushCategories: next }); }
      catch (nextError) {
        console.error(nextError);
        setPushMessage("This notification preference could not be saved.");
      }
    }
  }, [profile?.id, pushCategories]);

  const testPush = useCallback(async () => {
    setPushBusy(true);
    setPushMessage("");
    try {
      const result = await sendPushTest();
      setPushMessage(result.successCount
        ? "A test notification was sent. Lock the screen or move the app to the background to verify it."
        : "The test was sent, but no device accepted it.");
      return result;
    } catch (nextError) {
      setPushMessage(nextError.message || "Test push could not be sent.");
      throw nextError;
    } finally {
      setPushBusy(false);
    }
  }, []);

  const value = useMemo(() => ({
    items,
    unreadItems,
    unreadCount: unreadItems.length,
    loading,
    error,
    toasts,
    inAppAlerts,
    pushSupported,
    pushConfigured,
    pushPermission,
    pushEnabled,
    pushBusy,
    pushMessage,
    pushCategories,
    markRead,
    markAllRead,
    openNotification,
    dismissToast,
    setInAppAlerts,
    setPushAlerts,
    updatePushCategory,
    testPush
  }), [dismissToast, error, inAppAlerts, items, loading, markAllRead, markRead, openNotification, pushBusy, pushCategories, pushConfigured, pushEnabled, pushMessage, pushPermission, pushSupported, setInAppAlerts, setPushAlerts, testPush, toasts, unreadItems, updatePushCategory]);

  return <InvestorNotificationContext.Provider value={value}>{children}</InvestorNotificationContext.Provider>;
}

export function useInvestorNotifications() {
  return useContext(InvestorNotificationContext);
}
