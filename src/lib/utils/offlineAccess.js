export const OFFLINE_ACCESS_KEY = "growvest-secure-offline-enabled";
export const OFFLINE_ACCESS_CHANGED_KEY = "growvest-secure-offline-changed-at";

export function isOfflineAccessEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(OFFLINE_ACCESS_KEY) === "true";
}

export function setOfflineAccessPreference(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_ACCESS_KEY, String(Boolean(enabled)));
  window.localStorage.setItem(OFFLINE_ACCESS_CHANGED_KEY, String(Date.now()));
}

export function clearWorkspaceCaches() {
  if (typeof window === "undefined") return;
  Object.keys(window.sessionStorage).forEach((key) => {
    if (key.startsWith("growvest-")) window.sessionStorage.removeItem(key);
  });
}
