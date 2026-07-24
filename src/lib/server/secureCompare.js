import { timingSafeEqual } from "node:crypto";

export function secureSecretMatch(suppliedValue, configuredValue) {
  const supplied = Buffer.from(String(suppliedValue || ""));
  const configured = Buffer.from(String(configuredValue || ""));
  if (!configured.length || supplied.length !== configured.length) return false;
  return timingSafeEqual(supplied, configured);
}
