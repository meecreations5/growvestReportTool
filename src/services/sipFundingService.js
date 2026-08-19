import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders(options.headers || {}, user);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to complete SIP funding request.");
  return payload;
}

export async function getSipFundingOverview(investorId = "") {
  const query = investorId ? `?investorId=${encodeURIComponent(investorId)}` : "";
  return authenticatedFetch(`/api/sip-funding${query}`);
}

export async function saveSipFundingSchedule(payload = {}) {
  return authenticatedFetch("/api/sip-funding", {
    method: "POST",
    body: JSON.stringify({ action: "upsert_schedule", ...payload })
  });
}

export async function disableSipFundingSchedule(scheduleId) {
  return authenticatedFetch("/api/sip-funding", {
    method: "POST",
    body: JSON.stringify({ action: "disable_schedule", scheduleId })
  });
}

export async function respondToSipFunding(scheduleId, response, note = "") {
  return authenticatedFetch("/api/sip-funding", {
    method: "POST",
    body: JSON.stringify({ action: "respond", scheduleId, response, note })
  });
}
