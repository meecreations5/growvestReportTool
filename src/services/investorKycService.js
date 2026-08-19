import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

export async function updateInvestorKyc(investorId, payload = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders({ "Content-Type": "application/json" }, user);
  const response = await fetch(`/api/investors/${investorId}/kyc`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to update investor KYC details.");
  return result;
}
