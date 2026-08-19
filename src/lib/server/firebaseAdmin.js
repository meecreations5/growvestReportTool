import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";

function createAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      storageBucket
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket
  });
}

export const adminApp = createAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminAppCheck = getAppCheck(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminMessaging = getMessaging(adminApp);
export const adminBucket = adminStorage.bucket();

export class AppRequestError extends Error {
  constructor(message, statusCode = 500, code = "app_request_error") {
    super(message);
    this.name = "AppRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function appRequestErrorStatus(error, fallback = 500) {
  const status = Number(error?.statusCode || 0);
  return status >= 400 && status <= 599 ? status : fallback;
}

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function verifyAppRequest(request) {
  const token = getBearerToken(request);
  if (!token) throw new AppRequestError("Authentication token is missing.", 401, "auth_token_missing");

  let decoded;
  try {
    // checkRevoked=true ensures disabled/revoked sessions cannot continue to use
    // privileged server routes with an otherwise valid cached ID token.
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new AppRequestError("Your session is invalid or has expired. Sign in again.", 401, "auth_token_invalid");
  }

  if (String(process.env.FIREBASE_APP_CHECK_ENFORCE_SERVER || "").toLowerCase() === "true") {
    const appCheckToken = String(request.headers.get("x-firebase-appcheck") || "").trim();
    if (!appCheckToken) throw new AppRequestError("Application verification is required. Refresh the app and try again.", 401, "app_check_missing");
    try {
      await adminAppCheck.verifyToken(appCheckToken);
    } catch {
      throw new AppRequestError("Application verification failed. Refresh the app and try again.", 401, "app_check_invalid");
    }
  }

  const profileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profileSnapshot.exists) throw new AppRequestError("Application user profile was not found.", 403, "profile_missing");
  const profile = profileSnapshot.data();
  if (profile.status !== "active") throw new AppRequestError("Your GrowVest account is inactive.", 403, "account_inactive");
  return { uid: decoded.uid, ...profile };
}

export async function verifyStaffRequest(request) {
  const profile = await verifyAppRequest(request);
  if (!["super_admin", "admin", "advisor"].includes(profile.role)) {
    throw new AppRequestError("You are not authorised to perform this staff action.", 403, "staff_role_required");
  }
  return profile;
}

export function canStaffAccessRecord(actor, record = {}) {
  if (["super_admin", "admin"].includes(actor.role)) return true;
  // Creator identity must not become a permanent authorisation path after an
  // Investor/record is reassigned. Advisor access follows current ownership.
  return [record.advisorUid, record.assignedAdvisorUid].includes(actor.uid);
}

export function canInvestorAccessReport(actor, report = {}) {
  if (actor.role !== "investor" || actor.portalEnabled === false) return false;
  return Boolean(
    report.investorVisible === true
    && report.status === "completed"
    && (
      report.investorPortalUid === actor.uid
      || report.portalUid === actor.uid
      || (actor.investorId && report.investorId === actor.investorId)
    )
  );
}
