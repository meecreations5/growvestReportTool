import { auth } from "@/lib/firebase/client";

export async function updateInvestorKyc(investorId, payload = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const token = await user.getIdToken();
  const response = await fetch(`/api/investors/${investorId}/kyc`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to update investor KYC details.");
  return result;
}
