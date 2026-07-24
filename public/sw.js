const CACHE_NAME = "growvest-investor-v0.28.0";
const PAGE_CACHE = "growvest-pages-v0.28.0";
const OFFLINE_PREF_CACHE = "growvest-offline-preference-v1";
const OFFLINE_PREF_URL = "/__growvest_offline_access__";
const APP_SHELL = [
  "/offline",
  "/investor-login",
  "/staff-login",
  "/icons/growvest-pwa-192.png",
  "/icons/growvest-pwa-512.png",
  "/icons/growvest-pwa-maskable-512.png"
];

const OFFLINE_SHELL_ROUTES = new Set([
  "/dashboard",
  "/profile",
  "/reports",
  "/investors",
  "/leads",
  "/meetings",
  "/mom",
  "/investor/dashboard",
  "/investor/reports",
  "/investor/goals",
  "/investor/meetings",
  "/investor/notifications",
  "/investor/profile"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![CACHE_NAME, PAGE_CACHE, OFFLINE_PREF_CACHE].includes(key))
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

function isCacheableAsset(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("webpack-hmr")) return false;
  return ["style", "script", "font", "image"].includes(request.destination) || url.pathname.startsWith("/_next/static/");
}

function isOfflineShellRoute(url) {
  return url.origin === self.location.origin && OFFLINE_SHELL_ROUTES.has(url.pathname);
}

async function offlineAccessEnabled() {
  const preferenceCache = await caches.open(OFFLINE_PREF_CACHE);
  const response = await preferenceCache.match(OFFLINE_PREF_URL);
  return response ? (await response.text()) === "true" : false;
}

async function setOfflineAccess(enabled) {
  const preferenceCache = await caches.open(OFFLINE_PREF_CACHE);
  await preferenceCache.put(OFFLINE_PREF_URL, new Response(String(Boolean(enabled))));
  if (!enabled) await caches.delete(PAGE_CACHE);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const canUsePrivateCache = isOfflineShellRoute(url) && await offlineAccessEnabled();
      const cached = canUsePrivateCache ? await caches.match(request) : null;
      try {
        const response = await fetch(request);
        if (response?.ok && canUsePrivateCache) {
          const clone = response.clone();
          const cache = await caches.open(PAGE_CACHE);
          await cache.put(request, clone);
        }
        return response;
      } catch {
        return cached || (await caches.match("/offline"));
      }
    })());
    return;
  }

  if (!isCacheableAsset(request, url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            const clone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, clone);
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "SET_OFFLINE_ACCESS") {
    event.waitUntil(setOfflineAccess(event.data.enabled === true));
  }
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/investor/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(link);
        return existing.focus();
      }
      return self.clients.openWindow(link);
    })
  );
});
