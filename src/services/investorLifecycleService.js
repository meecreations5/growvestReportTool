import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

async function lifecycleRequest(investorId, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders({ "Content-Type": "application/json" }, user);
  const response = await fetch(`/api/investors/${investorId}/lifecycle`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload || {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to manage Investor status.");
  return result;
}

export function previewInvestorDelete(investorId) {
  return lifecycleRequest(investorId, { action: "preview_delete" });
}

export function disableInvestor(investorId, reason) {
  return lifecycleRequest(investorId, { action: "disable", reason });
}

export function enableInvestor(investorId, reason) {
  return lifecycleRequest(investorId, { action: "enable", reason });
}

export function deleteInvestor(investorId, reason, confirmation) {
  return lifecycleRequest(investorId, { action: "delete", reason, confirmation });
}
