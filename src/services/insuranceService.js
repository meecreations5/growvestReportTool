import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import { auth } from "@/lib/firebase/client";

async function insuranceFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders(options.headers || {}, user);
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The insurance request failed.");
  return payload;
}

export async function getInsurancePolicies(investorId = "", asOfDate = "") {
  const params = new URLSearchParams();
  if (investorId) params.set("investorId", investorId);
  if (asOfDate) params.set("asOfDate", asOfDate);
  return insuranceFetch(`/api/insurance?${params.toString()}`);
}

export async function getInsuranceProtectionSnapshot(investorId = "", asOfDate = "") {
  const result = await getInsurancePolicies(investorId, asOfDate);
  return result.protectionSnapshot || { asOfDate, generatedAt: new Date().toISOString(), summary: {}, policies: [] };
}

export async function getInsurancePortfolioOverview(asOfDate = "") {
  const params = new URLSearchParams({ scope: "portfolio" });
  if (asOfDate) params.set("asOfDate", asOfDate);
  return insuranceFetch(`/api/insurance?${params.toString()}`);
}

export async function saveInsurancePolicy(investorId, policy, policyId = "") {
  return insuranceFetch("/api/insurance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: policyId ? "update" : "create", investorId, policyId, policy })
  });
}

export async function renewInsurancePolicy(policyId, policy) {
  return insuranceFetch("/api/insurance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "renew", policyId, policy })
  });
}

export async function updateInsurancePolicyStatus(policyId, status, note = "") {
  return insuranceFetch("/api/insurance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", policyId, status, note })
  });
}

async function workbookRequest({ investorId, file, action }) {
  const form = new FormData();
  form.set("investorId", investorId);
  form.set("action", action);
  form.set("file", file);
  return insuranceFetch("/api/insurance/import", { method: "POST", body: form });
}

export async function previewInsuranceWorkbook(investorId, file) {
  return workbookRequest({ investorId, file, action: "preview" });
}

export async function importInsuranceWorkbook(investorId, file) {
  return workbookRequest({ investorId, file, action: "commit" });
}
