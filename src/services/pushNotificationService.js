"use client";

import { app, auth } from "@/lib/firebase/client";

const PUSH_WORKER_SCOPE = "/firebase-cloud-messaging-push-scope/";
const DEVICE_ID_KEY = "growvest-push-device-id";
const PUSH_ENABLED_KEY = "growvest-push-enabled";

function messagingWorkerUrl() {
  const options = app.options || {};
  const params = new URLSearchParams({
    apiKey: options.apiKey || "",
    authDomain: options.authDomain || "",
    projectId: options.projectId || "",
    storageBucket: options.storageBucket || "",
    messagingSenderId: options.messagingSenderId || "",
    appId: options.appId || ""
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

let messagingPromise = null;
let workerPromise = null;

function createDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `gv-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

async function authorisedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in before changing push notification settings.");
  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Push notification request failed.");
  return payload;
}

export async function getPushCapability() {
  if (typeof window === "undefined") return { supported: false, reason: "server" };
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { supported: false, reason: "browser" };
  }

  try {
    const { isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) return { supported: false, reason: "firebase" };
  } catch (error) {
    console.warn("Firebase Messaging support check failed", error);
    return { supported: false, reason: "firebase" };
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    return { supported: true, configured: false, reason: "vapid" };
  }

  return {
    supported: true,
    configured: true,
    permission: window.Notification.permission,
    locallyEnabled: window.localStorage.getItem(PUSH_ENABLED_KEY) === "true"
  };
}

async function getMessagingClient() {
  if (!messagingPromise) {
    messagingPromise = import("firebase/messaging").then(({ getMessaging }) => getMessaging(app));
  }
  return messagingPromise;
}

async function getMessagingWorker() {
  if (!workerPromise) {
    workerPromise = navigator.serviceWorker.register(messagingWorkerUrl(), {
      scope: PUSH_WORKER_SCOPE,
      updateViaCache: "none"
    });
  }
  return workerPromise;
}

function deviceMetadata() {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = typeof navigator !== "undefined" ? navigator.userAgentData?.platform || navigator.platform || "web" : "web";
  const standalone = typeof window !== "undefined"
    && (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

  return {
    deviceId: getDeviceId(),
    platform,
    userAgent: userAgent.slice(0, 700),
    language: typeof navigator !== "undefined" ? navigator.language || "en-IN" : "en-IN",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    standalone
  };
}

export async function enablePushNotifications() {
  const capability = await getPushCapability();
  if (!capability.supported) throw new Error("Push notifications are not supported on this browser.");
  if (!capability.configured) throw new Error("Firebase Web Push is not configured. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY and redeploy.");

  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") {
    window.localStorage.setItem(PUSH_ENABLED_KEY, "false");
    return { enabled: false, permission };
  }

  const [{ getToken }, messaging, registration] = await Promise.all([
    import("firebase/messaging"),
    getMessagingClient(),
    getMessagingWorker()
  ]);

  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) throw new Error("A push token could not be created for this device.");

  await authorisedFetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({ token, ...deviceMetadata() })
  });

  window.localStorage.setItem(PUSH_ENABLED_KEY, "true");
  return { enabled: true, permission, token };
}

export async function syncPushSubscription() {
  const capability = await getPushCapability();
  if (!capability.supported || !capability.configured || capability.permission !== "granted" || !isPushEnabledLocally()) {
    return { enabled: false, permission: capability.permission || "default" };
  }

  const [{ getToken }, messaging, registration] = await Promise.all([
    import("firebase/messaging"),
    getMessagingClient(),
    getMessagingWorker()
  ]);
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) return { enabled: false, permission: capability.permission };

  await authorisedFetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({ token, ...deviceMetadata() })
  });
  return { enabled: true, permission: capability.permission, token };
}

export async function disablePushNotifications() {
  const capability = await getPushCapability();
  let token = "";

  if (capability.supported && capability.configured && window.Notification.permission === "granted") {
    try {
      const [{ getToken, deleteToken }, messaging, registration] = await Promise.all([
        import("firebase/messaging"),
        getMessagingClient(),
        getMessagingWorker()
      ]);
      token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      await authorisedFetch("/api/push/unregister", {
        method: "POST",
        body: JSON.stringify({ token, deviceId: getDeviceId() })
      });
      await deleteToken(messaging);
    } catch (error) {
      console.warn("Push token removal was partially completed", error);
      try {
        await authorisedFetch("/api/push/unregister", {
          method: "POST",
          body: JSON.stringify({ token, deviceId: getDeviceId() })
        });
      } catch (unregisterError) {
        console.warn("Push subscription could not be removed from the server", unregisterError);
      }
    }
  } else {
    await authorisedFetch("/api/push/unregister", {
      method: "POST",
      body: JSON.stringify({ deviceId: getDeviceId() })
    });
  }

  window.localStorage.setItem(PUSH_ENABLED_KEY, "false");
  return { enabled: false, permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported" };
}

export async function sendPushTest() {
  return authorisedFetch("/api/push/test", { method: "POST", body: JSON.stringify({}) });
}

export function isPushEnabledLocally() {
  return typeof window !== "undefined" && window.localStorage.getItem(PUSH_ENABLED_KEY) === "true";
}
