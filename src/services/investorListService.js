import { auth } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";

export async function getInvestors() {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders({}, user);
  const response = await fetch("/api/investors", { headers, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to load investors.");
  return Array.isArray(result.investors) ? result.investors : [];
}
