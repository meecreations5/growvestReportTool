import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminMessaging = getMessaging(adminApp);
export const adminBucket = adminStorage.bucket();

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function verifyAppRequest(request) {
  const token = getBearerToken(request);
  if (!token) throw new Error("Authentication token is missing.");

  const decoded = await adminAuth.verifyIdToken(token);
  const profileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profileSnapshot.exists) throw new Error("Application user profile was not found.");
  const profile = profileSnapshot.data();
  if (profile.status !== "active") throw new Error("Your GrowVest account is inactive.");
  return { uid: decoded.uid, ...profile };
}

export async function verifyStaffRequest(request) {
  const profile = await verifyAppRequest(request);
  if (!["super_admin", "admin", "advisor"].includes(profile.role)) {
    throw new Error("You are not authorised to perform this staff action.");
  }
  return profile;
}

export function canStaffAccessRecord(actor, record = {}) {
  if (["super_admin", "admin"].includes(actor.role)) return true;
  return [record.advisorUid, record.assignedAdvisorUid, record.createdByUid].includes(actor.uid);
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
