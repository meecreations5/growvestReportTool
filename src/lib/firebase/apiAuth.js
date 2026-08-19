import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth } from "@/lib/firebase/client";

export async function authenticatedApiHeaders(initialHeaders = {}, user = auth.currentUser) {
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = new Headers(initialHeaders || {});
  const idToken = await user.getIdToken();
  headers.set("Authorization", `Bearer ${idToken}`);

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
