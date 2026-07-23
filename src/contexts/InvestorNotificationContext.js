"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from "@/services/notificationService";

const InvestorNotificationContext = createContext(null);
const IN_APP_KEY = "growvest-investor-in-app-alerts";
const DEVICE_KEY = "growvest-investor-device-alerts";

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
  const [deviceAlerts, setDeviceAlertsState] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState("unsupported");
  const initialisedRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    setInAppAlertsState(readStoredBoolean(IN_APP_KEY, true));
    setDeviceAlertsState(readStoredBoolean(DEVICE_KEY, false));
    if ("Notification" in window) setNotificationPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
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
          if (inAppAlerts) {
            setToasts((current) => [...current.filter((toast) => toast.id !== item.id), item].slice(-3));
            window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== item.id)), 6500);
          }

          if (deviceAlerts && document.visibilityState !== "visible" && "Notification" in window && window.Notification.permission === "granted") {
            const alert = new window.Notification(item.title || "GrowVest update", {
              body: item.message || "You have a new investor update.",
              icon: "/icons/growvest-pwa-192.png",
              badge: "/icons/growvest-pwa-192.png",
              tag: `growvest-${item.id}`,
              data: { link: item.link || "/investor/notifications" }
            });
            alert.onclick = () => {
              window.focus();
              router.push(item.link || "/investor/notifications");
              alert.close();
            };
          }
        });
      },
      (nextError) => {
        console.error(nextError);
        setError("Notifications could not be loaded.");
        setLoading(false);
      }
    );
  }, [deviceAlerts, inAppAlerts, profile, router]);

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
    if (item.link) router.push(item.link);
  }, [markRead, router]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const setInAppAlerts = useCallback((enabled) => {
    setInAppAlertsState(enabled);
    window.localStorage.setItem(IN_APP_KEY, String(enabled));
  }, []);

  const requestDeviceAlerts = useCallback(async () => {
    if (!("Notification" in window)) return { permission: "unsupported" };
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      const enabled = permission === "granted";
      setDeviceAlertsState(enabled);
      window.localStorage.setItem(DEVICE_KEY, String(enabled));
      return { permission };
    } catch (error) {
      console.error("Unable to request device notification permission", error);
      setDeviceAlertsState(false);
      window.localStorage.setItem(DEVICE_KEY, "false");
      return { permission: "error" };
    }
  }, []);

  const setDeviceAlerts = useCallback((enabled) => {
    if (enabled && notificationPermission !== "granted") return requestDeviceAlerts();
    setDeviceAlertsState(enabled);
    window.localStorage.setItem(DEVICE_KEY, String(enabled));
    return Promise.resolve({ permission: notificationPermission });
  }, [notificationPermission, requestDeviceAlerts]);

  const value = useMemo(() => ({
    items,
    unreadItems,
    unreadCount: unreadItems.length,
    loading,
    error,
    toasts,
    inAppAlerts,
    deviceAlerts,
    notificationPermission,
    markRead,
    markAllRead,
    openNotification,
    dismissToast,
    setInAppAlerts,
    setDeviceAlerts,
    requestDeviceAlerts
  }), [deviceAlerts, dismissToast, error, inAppAlerts, items, loading, markAllRead, markRead, notificationPermission, openNotification, requestDeviceAlerts, setDeviceAlerts, setInAppAlerts, toasts, unreadItems]);

  return <InvestorNotificationContext.Provider value={value}>{children}</InvestorNotificationContext.Provider>;
}

export function useInvestorNotifications() {
  return useContext(InvestorNotificationContext);
}
