import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const VERHOEFF_D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]
];
const VERHOEFF_P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]
];

export function normalisePan(value = "") {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export function isValidPan(value = "") {
  const pan = normalisePan(value);
  return !pan || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

export function normaliseAadhaar(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

export function isValidAadhaar(value = "") {
  const aadhaar = normaliseAadhaar(value);
  if (!/^\d{12}$/.test(aadhaar)) return false;
  let checksum = 0;
  const reversed = aadhaar.split("").reverse();
  reversed.forEach((digit, index) => {
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[index % 8][Number(digit)]];
  });
  return checksum === 0;
}

function encryptionSecret() {
  const secret = String(process.env.KYC_FIELD_ENCRYPTION_KEY || "").trim();
  if (!secret) return "";
  const lowered = secret.toLowerCase();
  if (secret.length < 32 || ["changeme", "change-me", "example", "test", "password", "secret"].includes(lowered)) {
    throw new Error("KYC_FIELD_ENCRYPTION_KEY must be a strong server-only secret of at least 32 characters.");
  }
  return secret;
}

function encryptionKey() {
  const secret = encryptionSecret();
  return secret ? createHash("sha256").update(secret, "utf8").digest() : null;
}

export function aadhaarLookupHash(value) {
  const aadhaar = normaliseAadhaar(value);
  if (!isValidAadhaar(aadhaar)) throw new Error("Enter a valid Aadhaar number.");
  const secret = encryptionSecret();
  if (!secret) throw new Error("Aadhaar encryption is not configured. Add KYC_FIELD_ENCRYPTION_KEY to the server environment before saving Aadhaar numbers.");
  return createHmac("sha256", secret).update(`aadhaar:${aadhaar}`, "utf8").digest("hex");
}

export function kycEncryptionConfiguration() {
  try {
    const secret = encryptionSecret();
    return {
      configured: Boolean(secret),
      strong: Boolean(secret),
      keyVersion: String(process.env.KYC_FIELD_ENCRYPTION_KEY_VERSION || "1")
    };
  } catch (error) {
    return { configured: true, strong: false, keyVersion: String(process.env.KYC_FIELD_ENCRYPTION_KEY_VERSION || "1"), error: error.message };
  }
}

export function encryptAadhaar(value) {
  const aadhaar = normaliseAadhaar(value);
  if (!isValidAadhaar(aadhaar)) throw new Error("Enter a valid Aadhaar number.");
  const key = encryptionKey();
  if (!key) {
    throw new Error("Aadhaar encryption is not configured. Add KYC_FIELD_ENCRYPTION_KEY to the server environment before saving Aadhaar numbers.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(aadhaar, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: "aes-256-gcm",
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: tag.toString("base64"),
    aadhaarLookupHash: aadhaarLookupHash(aadhaar),
    last4: aadhaar.slice(-4),
    version: 1,
    keyVersion: String(process.env.KYC_FIELD_ENCRYPTION_KEY_VERSION || "1")
  };
}
