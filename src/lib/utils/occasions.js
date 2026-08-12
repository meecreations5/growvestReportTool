export const BIRTHDAY_REMINDER_OPTIONS = [30, 14, 7, 3, 1, 0];
export const DEFAULT_BIRTHDAY_REMINDER_OFFSETS = [7, 1, 0];
export const OCCASION_TYPES = ["Birthday", "Anniversary", "Other"];
export const OCCASION_RELATIONSHIPS = ["Investor", "Spouse", "Child", "Parent", "Sibling", "Family Member", "Other"];
export const OCCASION_TOUCHPOINT_STATUSES = ["Pending", "Completed", "Skipped"];
export const OCCASION_CHANNELS = ["Call", "WhatsApp", "Email", "In Person", "Other"];

export function parseOccasionDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function annualOccasionDate(year, month, day) {
  const effectiveDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  const date = new Date(Date.UTC(year, month - 1, effectiveDay));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== effectiveDay) return null;
  return date;
}

export function indiaDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

export function nextAnnualOccasion(dateValue, referenceParts = indiaDateParts()) {
  const parsed = parseOccasionDate(dateValue);
  if (!parsed) return null;
  const todayUtc = new Date(Date.UTC(referenceParts.year, referenceParts.month - 1, referenceParts.day));
  let eventYear = referenceParts.year;
  let eventDate = annualOccasionDate(eventYear, parsed.month, parsed.day);
  if (!eventDate) return null;
  if (eventDate.getTime() < todayUtc.getTime()) {
    eventYear += 1;
    eventDate = annualOccasionDate(eventYear, parsed.month, parsed.day);
  }
  if (!eventDate) return null;
  return {
    eventYear,
    eventDate: eventDate.toISOString().slice(0, 10),
    daysUntil: Math.round((eventDate.getTime() - todayUtc.getTime()) / 86400000),
    month: eventDate.getUTCMonth() + 1,
    day: eventDate.getUTCDate(),
    sourceYear: parsed.year
  };
}

export function normaliseReminderOffsets(value, fallbackDays = 7) {
  const source = Array.isArray(value) && value.length ? value : [fallbackDays];
  return [...new Set(source.map(Number).filter((item) => BIRTHDAY_REMINDER_OPTIONS.includes(item)))].sort((a, b) => b - a);
}

export function birthdayReminderOffsets(profile = {}) {
  if (profile.birthdayReminderEnabled === false) return [];
  return normaliseReminderOffsets(
    profile.birthdayReminderOffsets,
    Number(profile.birthdayReminderDaysBefore ?? 7)
  );
}

export function turningAge(dateValue, eventYear) {
  const parsed = parseOccasionDate(dateValue);
  if (!parsed || !eventYear) return null;
  const age = Number(eventYear) - parsed.year;
  return age >= 0 ? age : null;
}

export function anniversaryYears(dateValue, eventYear) {
  return turningAge(dateValue, eventYear);
}

export function occasionKey({ source = "custom", investorId = "", occasionId = "" } = {}) {
  if (source === "investor_birthday") return `investor_birthday_${investorId}`;
  return `custom_${occasionId}`;
}

export function occasionTouchpointId(key, eventYear) {
  return `${String(key || "occasion").replace(/[^a-zA-Z0-9_-]/g, "_")}_${eventYear}`;
}
