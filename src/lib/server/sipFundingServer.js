const INDIA_TZ = "Asia/Kolkata";

export function indiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateKeyFromParts(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function nextSipDebitDate(debitDay, from = new Date()) {
  const safeDay = Math.max(1, Math.min(31, Number(debitDay || 1)));
  const today = indiaDateParts(from);
  let year = today.year;
  let month = today.month;
  let day = Math.min(safeDay, daysInMonth(year, month));
  let key = dateKeyFromParts(year, month, day);
  const todayKey = dateKeyFromParts(today.year, today.month, today.day);
  if (key < todayKey) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    day = Math.min(safeDay, daysInMonth(year, month));
    key = dateKeyFromParts(year, month, day);
  }
  return key;
}

export function dateKeyToUtcNoon(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6, 30, 0));
}

export function daysUntilDate(dateKey, from = new Date()) {
  const today = indiaDateParts(from);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return Math.round((Date.UTC(year, month - 1, day) - todayUtc) / 86400000);
}

export function sipCycleId(scheduleId, debitDate) {
  return `${String(scheduleId || "schedule")}_${String(debitDate || "date").replace(/[^0-9-]/g, "")}`;
}

export function scheduleView(schedule = {}, cycle = null, now = new Date()) {
  const nextDebitDate = nextSipDebitDate(schedule.debitDay, now);
  return {
    ...schedule,
    nextDebitDate,
    daysUntilDebit: daysUntilDate(nextDebitDate, now),
    cycle: cycle || null,
    fundingStatus: cycle?.status || "pending",
    fundingResponse: cycle?.response || ""
  };
}
