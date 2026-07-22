export function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function combineLocalDateTime(date, time = "00:00") {
  if (!date) return null;
  const parsed = new Date(`${date}T${time || "00:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addHours(value, hours) {
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getTime() + Number(hours || 0) * 60 * 60 * 1000);
}

export function addDays(value, days) {
  return addHours(value, Number(days || 0) * 24);
}

export function differenceInHours(laterValue, earlierValue) {
  const later = toDate(laterValue);
  const earlier = toDate(earlierValue);
  if (!later || !earlier) return 0;
  return (later.getTime() - earlier.getTime()) / (60 * 60 * 1000);
}

export function differenceInDays(laterValue, earlierValue) {
  return differenceInHours(laterValue, earlierValue) / 24;
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatDurationFromNow(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return "No deadline";

  const diffMs = date.getTime() - now.getTime();
  const absoluteMinutes = Math.round(Math.abs(diffMs) / 60000);
  const days = Math.floor(absoluteMinutes / 1440);
  const hours = Math.floor((absoluteMinutes % 1440) / 60);
  const minutes = absoluteMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  if (!parts.length) parts.push("now");

  return diffMs < 0 ? `${parts.join(" ")} overdue` : `${parts.join(" ")} remaining`;
}

export function toInputDate(value) {
  const date = toDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
