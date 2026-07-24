"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isOfflineAccessEnabled } from "@/lib/utils/offlineAccess";

const PwaContext = createContext(null);
const DISMISS_KEY = "growvest-pwa-install-dismissed-at";

function standaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    setIsInstalled(standaloneMode());
    setIsOnline(window.navigator.onLine);
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    setInstallDismissed(Boolean(dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000));

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallDismissed(false);
      window.localStorage.removeItem(DISMISS_KEY);
    }

    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((nextRegistration) => {
        setRegistration(nextRegistration);
        const worker = nextRegistration.active || nextRegistration.waiting || nextRegistration.installing;
        worker?.postMessage({ type: "SET_OFFLINE_ACCESS", enabled: isOfflineAccessEnabled() });
        if (nextRegistration.waiting) setUpdateAvailable(true);
        nextRegistration.addEventListener("updatefound", () => {
          const worker = nextRegistration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateAvailable(true);
          });
        });
      }).catch((error) => console.warn("GrowVest PWA service worker registration failed", error));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" };
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome === "accepted") {
      setDeferredPrompt(null);
      setInstallDismissed(false);
    }
    return choice || { outcome: "dismissed" };
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setInstallDismissed(true);
  }, []);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }, [registration]);

  const value = useMemo(() => ({
    canInstall: Boolean(deferredPrompt) && !isInstalled && !installDismissed,
    isInstalled,
    isOnline,
    updateAvailable,
    installApp,
    dismissInstall,
    applyUpdate
  }), [applyUpdate, deferredPrompt, dismissInstall, installApp, installDismissed, isInstalled, isOnline, updateAvailable]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used inside PwaProvider");
  return context;
}
