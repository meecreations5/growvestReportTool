import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

export async function getInvestorStatusSummaries() {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders({}, user);
  const response = await fetch("/api/investors/status-summary", { headers, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to load investor status summaries.");
  return result.summaries || {};
}

export async function refreshInvestorStatusSummary(investorId) {
  if (!investorId) return null;
  const user = auth.currentUser;
  if (!user) return null;
  const headers = await authenticatedApiHeaders({ "Content-Type": "application/json" }, user);
  const response = await fetch(`/api/investors/${investorId}/status-summary`, { method: "POST", headers, body: "{}" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to refresh investor status.");
  return result.summary || null;
}
