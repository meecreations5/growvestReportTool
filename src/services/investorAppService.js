import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import { getStoredActiveInvestorId } from "@/lib/auth/investorAccess";
import { demoReadOnlyError, getDemoHoldingDetail, getDemoInvestorAppData, getGuestDemoSession } from "@/lib/demo/investorDemo";

const responseCache = new Map();
const inFlight = new Map();
const DEFAULT_TTL_MS = 30000;

function cacheKey(url) {
  const uid = auth.currentUser?.uid || "anonymous";
  const investorId = auth.currentUser?.uid ? (getStoredActiveInvestorId(auth.currentUser.uid) || "primary") : "anonymous";
  return `${uid}:${investorId}:${url}`;
}

function cachedValue(key, ttlMs) {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    responseCache.delete(key);
    return null;
  }
  return hit.value;
}

async function investorAppFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const {
    force = false,
    ttlMs = DEFAULT_TTL_MS,
    cacheResult = String(options.method || "GET").toUpperCase() === "GET",
    ...fetchOptions
  } = options;
  const key = cacheKey(url);

  if (!force && cacheResult) {
    const cached = cachedValue(key, ttlMs);
    if (cached) return cached;
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const request = (async () => {
    const headers = await authenticatedApiHeaders(fetchOptions.headers || {}, user);
    if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(url, { ...fetchOptions, headers, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Unable to load Investor App data.");
    if (cacheResult) responseCache.set(key, { value: payload, at: Date.now() });
    return payload;
  })();

  if (cacheResult) inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (cacheResult) inFlight.delete(key);
  }
}

export function invalidateInvestorAppData(section = "") {
  const uid = auth.currentUser?.uid || "anonymous";
  const match = section ? `section=${encodeURIComponent(section)}` : "/api/investor/app-data";
  for (const key of responseCache.keys()) {
    if (key.startsWith(`${uid}:`) && key.includes(match)) responseCache.delete(key);
  }
}

export async function getInvestorAppData(section = "dashboard", options = {}) {
  const demoSession = getGuestDemoSession();
  if (demoSession) return getDemoInvestorAppData(section, "", demoSession);
  const ttlBySection = {
    dashboard: 15000,
    goals: 30000,
    reports: 45000,
    report: 45000,
    documents: 20000,
    meetings: 30000,
    profile: 60000,
    security: 60000
  };
  return investorAppFetch(`/api/investor/app-data?section=${encodeURIComponent(section)}`, {
    ttlMs: ttlBySection[section] || DEFAULT_TTL_MS,
    ...options
  });
}

export async function getInvestorReportDetail(reportId, options = {}) {
  const demoSession = getGuestDemoSession();
  if (demoSession) return getDemoInvestorAppData("report", reportId, demoSession);
  if (!reportId) throw new Error("Monthly report is required.");
  return investorAppFetch(`/api/investor/app-data?section=report&reportId=${encodeURIComponent(reportId)}`, {
    ttlMs: 60000,
    ...options
  });
}

export async function confirmInvestorPasswordChanged(details = {}) {
  if (getGuestDemoSession()) throw demoReadOnlyError("Login & security changes");
  const payload = await investorAppFetch("/api/investor/app-data", {
    method: "POST",
    body: JSON.stringify({ action: "password_changed", ...details }),
    cacheResult: false
  });
  invalidateInvestorAppData("security");
  return payload;
}

export async function getInvestorHoldingDetail(positionId, options = {}) {
  const demoSession = getGuestDemoSession();
  if (demoSession) return getDemoHoldingDetail(positionId, demoSession);
  if (!positionId) throw new Error("Investment holding is required.");
  return investorAppFetch(`/api/investor/holding-detail?positionId=${encodeURIComponent(positionId)}`, {
    ttlMs: 45000,
    ...options
  });
}
