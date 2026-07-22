export function normalizeWhatsAppNumber(value, defaultCountryCode = "91") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `${defaultCountryCode}${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl({ mobile, message }) {
  const normalized = normalizeWhatsAppNumber(mobile);
  if (!normalized) throw new Error("A valid mobile number is required to open WhatsApp.");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(String(message || ""))}`;
}

export function openWhatsAppPlaceholder() {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "_blank");
}

export function navigateWhatsAppWindow(targetWindow, { mobile, message }) {
  const url = buildWhatsAppUrl({ mobile, message });

  if (targetWindow && !targetWindow.closed) {
    targetWindow.opener = null;
    targetWindow.location.href = url;
    return targetWindow;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    throw new Error("WhatsApp popup was blocked. Allow popups for this site and try again.");
  }
  return opened;
}

export function closeWhatsAppPlaceholder(targetWindow) {
  if (targetWindow && !targetWindow.closed) targetWindow.close();
}

export function openWhatsAppChat({ mobile, message }) {
  if (typeof window === "undefined") return null;
  return navigateWhatsAppWindow(null, { mobile, message });
}
