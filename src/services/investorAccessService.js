import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import { setStoredActiveInvestorId } from "@/lib/auth/investorAccess";

export async function getInvestorAccessProfiles(user = auth.currentUser) {
  if (!user) return [];
  const headers = await authenticatedApiHeaders({}, user, { skipInvestorContext: true });
  const response = await fetch("/api/investor/access/profiles", { headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to load Investor access profiles.");
  return Array.isArray(data.profiles) ? data.profiles : [];
}

export function persistActiveInvestor(user, investorId) {
  if (!user?.uid || !investorId) return;
  setStoredActiveInvestorId(user.uid, investorId);
}
