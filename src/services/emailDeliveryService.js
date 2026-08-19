import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to manage report delivery.");
  const headers = await authenticatedApiHeaders({ "Content-Type": "application/json", ...(options.headers || {}) }, user);
  const response = await fetch(url, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.error || "The delivery request could not be completed.");
  }
  return result;
}

export function listEmailDeliveries() {
  return authenticatedFetch("/api/email-delivery/list", { method: "GET" });
}

export function sendReportDelivery(payload) {
  return authenticatedFetch("/api/email-delivery/send", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function scheduleReportDelivery(payload) {
  return authenticatedFetch("/api/email-delivery/schedule", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendReportDeliveryTest(payload) {
  return authenticatedFetch("/api/email-delivery/test", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
