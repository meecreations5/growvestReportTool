import {
  GoogleAuthProvider,
  OAuthProvider,
  deleteUser,
  linkWithPopup,
  unlink,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { STAFF_ROLES, USER_ROLES } from "@/lib/constants/roles";
import { investorUsernameToEmail } from "@/lib/auth/investorIdentity";
import { validateApplicationProfile } from "@/lib/auth/session";

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function claimStaffInvitation(firebaseUser) {
  const email = String(firebaseUser.email || "").trim().toLowerCase();
  if (!email) return null;

  const invitationRef = doc(db, "staffInvitations", email);
  const userRef = doc(db, "users", firebaseUser.uid);

  return runTransaction(db, async (transaction) => {
    const [userSnapshot, invitationSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(invitationRef)
    ]);

    if (userSnapshot.exists()) {
      return { id: userSnapshot.id, ...userSnapshot.data() };
    }

    if (!invitationSnapshot.exists()) return null;
    const invitation = invitationSnapshot.data();
    if (invitation.status !== "pending" || !STAFF_ROLES.includes(invitation.role)) return null;

    const profile = {
      uid: firebaseUser.uid,
      fullName: invitation.fullName || firebaseUser.displayName || "GrowVest User",
      email,
      mobile: invitation.mobile || "",
      role: invitation.role,
      status: "active",
      designation: invitation.designation || "",
      advisorCode: invitation.advisorCode || "",
      signatureEnabled: invitation.signatureEnabled !== false,
      emailSignatureHtml: invitation.emailSignatureHtml || "",
      authMethod: "microsoft",
      photoURL: firebaseUser.photoURL || "",
      invitedByUid: invitation.invitedByUid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };

    transaction.set(userRef, profile);
    transaction.update(invitationRef, {
      status: "linked",
      linkedUid: firebaseUser.uid,
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { id: firebaseUser.uid, ...profile };
  });
}


async function claimInvestorGoogleAccess(firebaseUser) {
  const email = String(firebaseUser.email || "").trim().toLowerCase();
  if (!email) return null;

  const aliasRef = doc(db, "investorLoginAliases", email);
  const userRef = doc(db, "users", firebaseUser.uid);

  return runTransaction(db, async (transaction) => {
    const [userSnapshot, aliasSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(aliasRef)
    ]);

    if (userSnapshot.exists()) {
      return { id: userSnapshot.id, ...userSnapshot.data() };
    }

    if (!aliasSnapshot.exists()) return null;
    const alias = aliasSnapshot.data();
    if (alias.status !== "active" || alias.portalEnabled === false || !alias.investorId) return null;

    // When a canonical username/phone account already exists, Google must be
    // linked to that UID. Never create a second Investor profile for the same person.
    if (alias.portalUid && alias.portalUid !== firebaseUser.uid) return null;

    const profile = {
      uid: firebaseUser.uid,
      fullName: alias.fullName || firebaseUser.displayName || "GrowVest Investor",
      email,
      mobile: alias.mobile || "",
      role: USER_ROLES.INVESTOR,
      status: "active",
      investorId: alias.investorId,
      clientCode: alias.clientCode || "",
      authMethod: "google",
      authMethods: ["google"],
      portalEnabled: true,
      photoURL: firebaseUser.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };

    transaction.set(userRef, profile);
    return { id: firebaseUser.uid, ...profile };
  });
}

export async function resolveUserProfile(firebaseUser) {
  let profile = await getUserProfile(firebaseUser.uid);
  if (!profile) profile = await claimStaffInvitation(firebaseUser);
  if (!profile) profile = await claimInvestorGoogleAccess(firebaseUser);

  if (profile) {
    const fallbackName = profile.fullName || profile.name || profile.displayName || firebaseUser.displayName || "GrowVest User";
    profile = { ...profile, fullName: fallbackName };
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        fullName: fallbackName,
        photoURL: profile.photoURL || firebaseUser.photoURL || "",
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Unable to update login metadata", error);
    }
  }

  return profile;
}

async function validateSignedInUser(firebaseUser, expectedAudience) {
  const profile = await resolveUserProfile(firebaseUser);
  const validationError = validateApplicationProfile(firebaseUser, profile);

  if (validationError) {
    await signOut(auth);
    throw new Error(validationError);
  }

  if (expectedAudience === "staff" && !STAFF_ROLES.includes(profile.role)) {
    await signOut(auth);
    throw new Error("This account is not authorised for staff access.");
  }

  if (expectedAudience === "investor" && profile.role !== USER_ROLES.INVESTOR) {
    await signOut(auth);
    throw new Error("This account is not authorised for the investor portal.");
  }

  return profile;
}

function createMicrosoftProvider() {
  const provider = new OAuthProvider("microsoft.com");
  const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID?.trim();

  provider.setCustomParameters({
    prompt: "select_account",
    ...(tenantId ? { tenant: tenantId } : {})
  });

  return provider;
}

export async function signInStaffWithMicrosoftPopup() {
  try {
    const result = await signInWithPopup(auth, createMicrosoftProvider());
    const profile = await validateSignedInUser(result.user, "staff");
    return { user: result.user, profile };
  } catch (error) {
    throw new Error(mapAuthError(error, "staff"));
  }
}

export async function signInStaffWithMicrosoftRedirect() {
  try {
    await signInWithRedirect(auth, createMicrosoftProvider());
  } catch (error) {
    throw new Error(mapAuthError(error, "staff"));
  }
}


export async function signInInvestorWithGooglePopup() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);

    const email = String(result.user.email || "").trim().toLowerCase();
    const existingProfile = await getUserProfile(result.user.uid);
    if (!existingProfile && email) {
      const aliasSnapshot = await getDoc(doc(db, "investorLoginAliases", email));
      const alias = aliasSnapshot.exists() ? aliasSnapshot.data() : null;
      if (alias?.portalUid && alias.portalUid !== result.user.uid) {
        try { await deleteUser(result.user); } catch (cleanupError) { console.warn("Unable to remove temporary Google-only account", cleanupError); }
        await signOut(auth);
        throw new Error("Google access is authorised but is not linked yet. Sign in using Username/Password or Mobile OTP, open Login & Security, and select Link Google Account.");
      }
    }

    const profile = await validateSignedInUser(result.user, "investor");
    return { user: result.user, profile };
  } catch (error) {
    if (error?.message?.includes("not linked yet")) throw error;
    throw new Error(mapAuthError(error, "investor"));
  }
}

export async function linkInvestorGoogleAccount(expectedEmail = "") {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to the Investor Portal before linking Google.");

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await linkWithPopup(user, provider);
  const linkedEmail = String(result.user.providerData.find((item) => item.providerId === "google.com")?.email || "").toLowerCase();
  const requiredEmail = String(expectedEmail || "").trim().toLowerCase();

  if (requiredEmail && linkedEmail !== requiredEmail) {
    await unlink(result.user, "google.com");
    throw new Error(`Select the authorised Google account: ${requiredEmail}`);
  }

  const token = await result.user.getIdToken();
  const response = await fetch("/api/investor/account/link-google", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ googleEmail: linkedEmail })
  });
  const data = await response.json();
  if (!response.ok) {
    try { await unlink(result.user, "google.com"); } catch {}
    throw new Error(data.error || "Google account could not be linked.");
  }
  return { user: result.user, googleEmail: linkedEmail };
}

export async function signInInvestorWithUsername(username, password) {
  try {
    const internalEmail = investorUsernameToEmail(username);
    const result = await signInWithEmailAndPassword(auth, internalEmail, password);
    const profile = await validateSignedInUser(result.user, "investor");
    return { user: result.user, profile };
  } catch (error) {
    throw new Error(mapAuthError(error, "investor"));
  }
}

export function createInvestorRecaptcha(containerId = "investor-recaptcha") {
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {}
  });
}

export async function sendInvestorOtp(phoneNumber, verifier) {
  try {
    return await signInWithPhoneNumber(auth, phoneNumber, verifier);
  } catch (error) {
    throw new Error(mapAuthError(error, "investor"));
  }
}

export async function verifyInvestorOtp(confirmationResult, otp) {
  try {
    const result = await confirmationResult.confirm(otp);
    const profile = await validateSignedInUser(result.user, "investor");
    return { user: result.user, profile };
  } catch (error) {
    throw new Error(mapAuthError(error, "investor"));
  }
}

export function mapAuthError(error, audience = "staff") {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-credential": audience === "investor" ? "Incorrect username or password." : "Microsoft sign-in could not be verified.",
    "auth/user-disabled": "This login account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "A network error occurred. Check your internet connection and try again.",
    "auth/popup-closed-by-user": "Sign-in was cancelled before completion.",
    "auth/popup-blocked": "The sign-in popup was blocked. Allow popups and try again.",
    "auth/unauthorized-domain": `This website domain (${typeof window !== "undefined" ? window.location.hostname : "current host"}) is not authorised in Firebase Authentication.`,
    "auth/operation-not-allowed": `This sign-in method is not enabled for Firebase project ${auth.app.options.projectId || "unknown"}. Confirm .env.local points to growvest-reporttool and restart Next.js.`,
    "auth/account-exists-with-different-credential": "An account already exists with this identity using another sign-in method.",
    "auth/credential-already-in-use": "This Google account is still linked to another Firebase user. Ask GrowVest to update Portal Access once to remove the duplicate, then retry linking.",
    "auth/email-already-in-use": "This email is already linked to another Firebase user.",
    "auth/user-not-found": audience === "investor" ? "This Investor login is not authorised. Ask your GrowVest Advisor to enable portal access." : "The user account was not found.",
    "auth/invalid-phone-number": "Enter the mobile number with country code, for example +919876543210.",
    "auth/missing-phone-number": "Enter the registered mobile number.",
    "auth/quota-exceeded": "The SMS quota has been exceeded. Please contact the administrator.",
    "auth/captcha-check-failed": "The reCAPTCHA verification failed. Refresh the page and try again.",
    "auth/invalid-app-credential": "Phone verification could not validate this web app. Confirm the Firebase project configuration, authorised domain and reCAPTCHA setup.",
    "auth/missing-app-credential": "Phone verification could not start because the reCAPTCHA credential is missing. Refresh the page and try again.",
    "auth/invalid-verification-code": "The OTP is incorrect. Please check it and try again.",
    "auth/code-expired": "The OTP has expired. Request a new OTP."
  };

  return messages[code] || error?.message || "Unable to sign in. Please try again.";
}
