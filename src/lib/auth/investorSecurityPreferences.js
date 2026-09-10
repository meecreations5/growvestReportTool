const PREF_PREFIX = "growvest:investor-security:";
const UNLOCK_PREFIX = "growvest:investor-unlocked:";
const BACKGROUND_PREFIX = "growvest:investor-background:";

const DEFAULTS = Object.freeze({
  mobileAppLockEnabled: false,
  mobileLockTimeout: "every_time",
  mobilePinSalt: "",
  mobilePinHash: "",
  mobileBiometricEnabled: false,
  mobileBiometricCredentialId: "",
  desktopRequireSignInOnClose: true,
  desktopInactivityMinutes: 30
});

function storageAvailable(type = "localStorage") {
  try {
    return typeof window !== "undefined" && Boolean(window[type]);
  } catch {
    return false;
  }
}

function prefKey(uid) {
  return `${PREF_PREFIX}${String(uid || "anonymous")}`;
}

function sessionKey(prefix, uid) {
  return `${prefix}${String(uid || "anonymous")}`;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256Bytes(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

async function derivePinHash(pin, saltBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(pin || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 210000 },
    key,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export function isInvestorMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function getInvestorSecurityPreferences(uid) {
  if (!storageAvailable("localStorage")) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(prefKey(uid)) || "{}");
    return { ...DEFAULTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveInvestorSecurityPreferences(uid, updates = {}) {
  const next = { ...getInvestorSecurityPreferences(uid), ...updates };
  if (storageAvailable("localStorage")) {
    window.localStorage.setItem(prefKey(uid), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("growvest-security-preferences-changed", { detail: { uid, preferences: next } }));
  }
  return next;
}

export async function setMobileAppPin(uid, pin) {
  if (!/^\d{4}$|^\d{6}$/.test(String(pin || ""))) throw new Error("Choose a 4 or 6-digit PIN.");
  if (!globalThis.crypto?.subtle) throw new Error("Secure PIN storage is not supported on this device.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  return saveInvestorSecurityPreferences(uid, {
    mobilePinSalt: bytesToBase64Url(salt),
    mobilePinHash: hash,
    mobileAppLockEnabled: true
  });
}

export async function verifyMobileAppPin(uid, pin) {
  const preferences = getInvestorSecurityPreferences(uid);
  if (!preferences.mobilePinSalt || !preferences.mobilePinHash) return false;
  const hash = await derivePinHash(pin, base64UrlToBytes(preferences.mobilePinSalt));
  return hash === preferences.mobilePinHash;
}

export function markInvestorUnlocked(uid) {
  if (!storageAvailable("sessionStorage")) return;
  window.sessionStorage.setItem(sessionKey(UNLOCK_PREFIX, uid), String(Date.now()));
  window.sessionStorage.removeItem(sessionKey(BACKGROUND_PREFIX, uid));
}

export function markInvestorBackgrounded(uid) {
  if (!storageAvailable("sessionStorage")) return;
  window.sessionStorage.setItem(sessionKey(BACKGROUND_PREFIX, uid), String(Date.now()));
}

export function shouldLockInvestorMobileApp(uid, preferences = getInvestorSecurityPreferences(uid)) {
  if (!preferences.mobileAppLockEnabled || !preferences.mobilePinHash) return false;
  if (!storageAvailable("sessionStorage")) return true;
  const unlockedAt = Number(window.sessionStorage.getItem(sessionKey(UNLOCK_PREFIX, uid)) || 0);
  const backgroundAt = Number(window.sessionStorage.getItem(sessionKey(BACKGROUND_PREFIX, uid)) || 0);
  if (!unlockedAt) return true;
  if (!backgroundAt) return false;
  if (preferences.mobileLockTimeout === "every_time") return backgroundAt >= unlockedAt;
  const minutes = Math.max(0, Number(preferences.mobileLockTimeout || 0));
  if (!minutes) return false;
  return Date.now() - backgroundAt >= minutes * 60 * 1000;
}

export async function isPlatformBiometricAvailable() {
  if (typeof window === "undefined" || !window.isSecureContext || !window.PublicKeyCredential) return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function enablePlatformBiometric(uid, displayName = "GrowVest Investor") {
  if (!(await isPlatformBiometricAvailable())) throw new Error("Biometric unlock is not available on this device or browser.");
  const userId = await sha256Bytes(uid);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "GrowVest" },
      user: {
        id: userId.slice(0, 32),
        name: `investor-${String(uid || "user").slice(0, 16)}`,
        displayName: String(displayName || "GrowVest Investor").slice(0, 64)
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "none"
    }
  });
  if (!credential?.rawId) throw new Error("Biometric setup was not completed.");
  return saveInvestorSecurityPreferences(uid, {
    mobileBiometricEnabled: true,
    mobileBiometricCredentialId: bytesToBase64Url(new Uint8Array(credential.rawId))
  });
}

export async function verifyPlatformBiometric(uid) {
  const preferences = getInvestorSecurityPreferences(uid);
  if (!preferences.mobileBiometricEnabled || !preferences.mobileBiometricCredentialId) return false;
  if (!(await isPlatformBiometricAvailable())) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          type: "public-key",
          id: base64UrlToBytes(preferences.mobileBiometricCredentialId),
          transports: ["internal"]
        }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export function disablePlatformBiometric(uid) {
  return saveInvestorSecurityPreferences(uid, {
    mobileBiometricEnabled: false,
    mobileBiometricCredentialId: ""
  });
}

export function resetMobileAppLock(uid) {
  const next = saveInvestorSecurityPreferences(uid, {
    mobileAppLockEnabled: false,
    mobilePinSalt: "",
    mobilePinHash: "",
    mobileBiometricEnabled: false,
    mobileBiometricCredentialId: ""
  });
  if (storageAvailable("sessionStorage")) {
    window.sessionStorage.removeItem(sessionKey(UNLOCK_PREFIX, uid));
    window.sessionStorage.removeItem(sessionKey(BACKGROUND_PREFIX, uid));
  }
  return next;
}

export function securityPreferenceDefaults() {
  return { ...DEFAULTS };
}
