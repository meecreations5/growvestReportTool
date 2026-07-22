import {
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

function createMicrosoftProvider() {
  const provider = new OAuthProvider("microsoft.com");

  const tenantId =
    process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID?.trim();

  provider.setCustomParameters({
    prompt: "select_account",
    ...(tenantId ? { tenant: tenantId } : {}),
  });

  return provider;
}

function validateUserProfile(profile) {
  if (!profile) {
    throw new Error(
      "Your Microsoft account is not authorised for this application."
    );
  }

  if (profile.status !== "active") {
    throw new Error(
      "Your GrowVest user account is inactive. Please contact the administrator."
    );
  }

  const allowedRoles = ["super_admin", "admin", "advisor"];

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      "No valid application role is assigned to your account."
    );
  }
}

async function loadApplicationProfile(firebaseUser) {
  const profileReference = doc(db, "users", firebaseUser.uid);
  const profileSnapshot = await getDoc(profileReference);

  if (!profileSnapshot.exists()) {
    throw new Error(
      "Your Microsoft account is authenticated but is not authorised for GrowVest Report Tool."
    );
  }

  const profile = {
    id: profileSnapshot.id,
    ...profileSnapshot.data(),
  };

  validateUserProfile(profile);

  return profile;
}

export async function signInUsingMicrosoftPopup() {
  try {
    const provider = createMicrosoftProvider();
    const result = await signInWithPopup(auth, provider);

    try {
      const profile = await loadApplicationProfile(result.user);

      return {
        user: result.user,
        profile,
      };
    } catch (profileError) {
      await signOut(auth);
      throw profileError;
    }
  } catch (error) {
    console.error("Microsoft login failed:", error);

    switch (error.code) {
      case "auth/popup-closed-by-user":
        throw new Error(
          "Microsoft login was cancelled before completion."
        );

      case "auth/popup-blocked":
        throw new Error(
          "The Microsoft login popup was blocked. Please allow popups and try again."
        );

      case "auth/account-exists-with-different-credential":
        throw new Error(
          "An account already exists with this email using another login method."
        );

      case "auth/unauthorized-domain":
        throw new Error(
          "This website domain is not authorised in Firebase Authentication."
        );

      case "auth/operation-not-allowed":
        throw new Error(
          "Microsoft login has not been enabled in Firebase Authentication."
        );

      default:
        throw new Error(
          error.message || "Unable to sign in with Microsoft."
        );
    }
  }
}

export async function signInUsingMicrosoftRedirect() {
  const provider = createMicrosoftProvider();
  await signInWithRedirect(auth, provider);
}