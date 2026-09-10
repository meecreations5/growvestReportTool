import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth } from "@/lib/firebase/client";
import { getStoredActiveInvestorId } from "@/lib/auth/investorAccess";

export async function authenticatedApiHeaders(initialHeaders = {}, user = auth.currentUser, options = {}) {
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = new Headers(initialHeaders || {});
  const idToken = await user.getIdToken();
  headers.set("Authorization", `Bearer ${idToken}`);

  if (!options?.skipInvestorContext && user?.uid) {
    const activeInvestorId = getStoredActiveInvestorId(user.uid);
    if (activeInvestorId) headers.set("X-GrowVest-Investor-Id", activeInvestorId);
  }

  if (appCheck) {
    try {
      const result = await getAppCheckToken(appCheck, false);
      if (result?.token) headers.set("X-Firebase-AppCheck", result.token);
    } catch (error) {
      // Firestore/Storage continue to apply their own App Check behavior. Custom
      // server APIs will reject this request when server enforcement is enabled.
      console.warn("Firebase App Check token could not be attached to the API request.", error);
    }
  }
  return headers;
}
