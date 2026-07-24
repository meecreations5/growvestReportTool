import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  throw new Error(`Missing Firebase configuration: ${missingKeys.join(", ")}`);
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let appCheckInstance = null;
const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
const APP_CHECK_INSTANCE_KEY = Symbol.for("growvest.firebase.appCheck");

if (typeof window !== "undefined" && appCheckSiteKey) {
  const globalScope = globalThis;

  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG === "true") {
    globalScope.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  if (!globalScope[APP_CHECK_INSTANCE_KEY]) {
    try {
      globalScope[APP_CHECK_INSTANCE_KEY] = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch (error) {
      console.warn("Firebase App Check could not be initialised.", error);
    }
  }

  appCheckInstance = globalScope[APP_CHECK_INSTANCE_KEY] || null;
}

export const appCheck = appCheckInstance;
export const auth = getAuth(app);

function createFirestore() {
  const offlineEnabled = typeof window !== "undefined"
    && window.localStorage.getItem("growvest-secure-offline-enabled") === "true";

  try {
    return initializeFirestore(app, {
      localCache: offlineEnabled
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache()
    });
  } catch (error) {
    // Hot reload or another bundle may already have initialised Firestore.
    // Reuse the existing instance instead of failing the application boot.
    return getFirestore(app);
  }
}

export const db = createFirestore();
export const storage = getStorage(app);

export default app;
