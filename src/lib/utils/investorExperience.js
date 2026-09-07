export function experienceDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function filterTrendByRange(items = [], range = "6M") {
  if (!Array.isArray(items) || range === "All") return Array.isArray(items) ? items : [];
  const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[range];
  if (!months) return items;

  const dated = items
    .map((item) => ({ item, date: experienceDate(item.date || item.snapshotDate || item.valuationDate) }))
    .filter((entry) => entry.date);
  if (dated.length < 2) {
    const fallbackCount = { "1M": 2, "3M": 4, "6M": 7, "1Y": 12 }[range] || items.length;
    return items.slice(-fallbackCount);
  }

  const anchor = new Date(Math.max(...dated.map((entry) => entry.date.getTime())));
  const cutoff = new Date(anchor);
  cutoff.setMonth(cutoff.getMonth() - months);
  const filtered = dated.filter((entry) => entry.date >= cutoff).map((entry) => entry.item);
  return filtered.length >= 2 ? filtered : dated.slice(-2).map((entry) => entry.item);
}

export function greetingForDate(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function daysUntil(value, now = new Date()) {
  const date = experienceDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}
