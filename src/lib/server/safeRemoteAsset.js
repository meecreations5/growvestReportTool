import { lookup } from "node:dns/promises";
import net from "node:net";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);

function ipv4Parts(address) {
  const parts = String(address || "").split(".").map((item) => Number(item));
  return parts.length === 4 && parts.every((item) => Number.isInteger(item) && item >= 0 && item <= 255) ? parts : null;
}

function blockedIpv4(address) {
  const parts = ipv4Parts(address);
  if (!parts) return true;
  const [a, b] = parts;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && parts[2] === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && parts[2] === 100)
    || (a === 203 && b === 0 && parts[2] === 113)
    || a >= 224
  );
}

function blockedIpv6(address) {
  const value = String(address || "").toLowerCase().split("%")[0];
  if (!value) return true;
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("2001:db8:")) return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return net.isIP(mapped) === 4 ? blockedIpv4(mapped) : true;
  }
  return false;
}

export function isBlockedNetworkAddress(address) {
  const version = net.isIP(String(address || ""));
  if (version === 4) return blockedIpv4(address);
  if (version === 6) return blockedIpv6(address);
  return true;
}

function blockedHostname(hostname) {
  const value = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return (
    !value
    || value === "localhost"
    || value.endsWith(".localhost")
    || value.endsWith(".local")
    || value.endsWith(".internal")
    || value === "metadata.google.internal"
  );
}

async function assertPublicHostname(hostname) {
  if (blockedHostname(hostname)) throw new Error("Remote asset host is not allowed.");
  if (net.isIP(hostname)) {
    if (isBlockedNetworkAddress(hostname)) throw new Error("Remote asset network address is not allowed.");
    return;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isBlockedNetworkAddress(item.address))) {
    throw new Error("Remote asset host resolves to a private or reserved network address.");
  }
}

export async function validateRemoteAssetUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("Remote asset URL is invalid.");
  }
  if (url.protocol !== "https:") throw new Error("Remote assets must use HTTPS.");
  if (url.username || url.password) throw new Error("Remote asset URL credentials are not allowed.");
  if (url.port && url.port !== "443") throw new Error("Remote asset URL must use the standard HTTPS port.");
  await assertPublicHostname(url.hostname);
  return url;
}

async function readLimitedBody(response, maxBytes) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength && contentLength > maxBytes) throw new Error("Remote image exceeds the allowed size.");
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new Error("Remote image exceeds the allowed size.");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
}

export async function fetchSafeRemoteImage(value, {
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = DEFAULT_MAX_REDIRECTS
} = {}) {
  let current = await validateRemoteAssetUrl(value);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/png,image/jpeg;q=0.9" }
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectCount >= maxRedirects) throw new Error("Remote asset redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Remote asset redirect is missing a destination.");
      current = await validateRemoteAssetUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`Remote asset request failed with HTTP ${response.status}.`);
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error("Remote asset is not an allowed PNG or JPEG image.");
    const bytes = await readLimitedBody(response, maxBytes);
    if (!bytes.byteLength) throw new Error("Remote image is empty.");
    return { bytes, contentType, finalUrl: current.toString() };
  }

  throw new Error("Remote asset could not be loaded.");
}
