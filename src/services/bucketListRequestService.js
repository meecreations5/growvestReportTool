import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import { invalidateInvestorAppData } from "@/services/investorAppService";

async function bucketListFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders(options.headers || {}, user);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Bucket List request could not be updated.");
  return payload;
}

export async function getBucketListRequests(investorId = "") {
  const query = investorId ? `?investorId=${encodeURIComponent(investorId)}` : "";
  const payload = await bucketListFetch(`/api/bucket-list-requests${query}`, { method: "GET" });
  return { ...payload, items: payload.items || [] };
}

export async function createBucketListRequest(values = {}) {
  const payload = await bucketListFetch("/api/bucket-list-requests", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...values })
  });
  invalidateInvestorAppData("goals");
  invalidateInvestorAppData("dashboard");
  return payload;
}

export async function reviewBucketListRequest(requestId, status, updates = {}) {
  const payload = await bucketListFetch("/api/bucket-list-requests", {
    method: "POST",
    body: JSON.stringify({ action: "review", requestId, status, updates })
  });
  invalidateInvestorAppData("goals");
  invalidateInvestorAppData("dashboard");
  return payload;
}
