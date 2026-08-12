import { auth } from "@/lib/firebase/client";

async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const token = await user.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Birthday & occasion request could not be completed.");
  return payload;
}

export async function getOccasions({ days = 365 } = {}) {
  return authenticatedFetch(`/api/occasions?days=${encodeURIComponent(days)}`);
}

export async function createOccasion(payload) {
  return authenticatedFetch("/api/occasions", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateOccasion(occasionId, payload) {
  return authenticatedFetch(`/api/occasions/${encodeURIComponent(occasionId)}`, { method: "PATCH", body: JSON.stringify(payload) });
}
