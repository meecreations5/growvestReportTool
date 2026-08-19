import { timingSafeEqual } from "node:crypto";

export const MIN_SERVER_SECRET_LENGTH = 32;

export function secureSecretMatch(suppliedValue, configuredValue, minimumLength = MIN_SERVER_SECRET_LENGTH) {
  const supplied = Buffer.from(String(suppliedValue || ""));
  const configured = Buffer.from(String(configuredValue || ""));
  if (configured.length < minimumLength || supplied.length !== configured.length) return false;
  return timingSafeEqual(supplied, configured);
}

export function serverSecretIsStrong(value, minimumLength = MIN_SERVER_SECRET_LENGTH) {
  const secret = String(value || "").trim();
  if (secret.length < minimumLength) return false;
  const lowered = secret.toLowerCase();
  return !["changeme", "change-me", "example", "password", "secret", "test"].includes(lowered);
}
