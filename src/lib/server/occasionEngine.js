import {
  anniversaryYears,
  birthdayReminderOffsets,
  nextAnnualOccasion,
  normaliseReminderOffsets,
  occasionKey,
  occasionTouchpointId,
  turningAge
} from "@/lib/utils/occasions";

export function investorBirthdayRow(investor, today) {
  const profile = investor?.personalProfile || {};
  if (!profile.dateOfBirth || profile.birthdayReminderEnabled === false) return null;
  const next = nextAnnualOccasion(profile.dateOfBirth, today);
  if (!next) return null;
  const key = occasionKey({ source: "investor_birthday", investorId: investor.id });
  return {
    id: `birthday__${investor.id}`,
    occasionKey: key,
    source: "investor_birthday",
    investorId: investor.id,
    clientCode: investor.clientCode || "",
    investorName: investor.fullName || "Investor",
    personName: investor.fullName || "Investor",
    relationship: "Investor",
    occasionType: "Birthday",
    occasionDate: profile.dateOfBirth,
    eventDate: next.eventDate,
    eventYear: next.eventYear,
    daysUntil: next.daysUntil,
    turningAge: turningAge(profile.dateOfBirth, next.eventYear),
    anniversaryYears: null,
    reminderEnabled: true,
    reminderOffsets: birthdayReminderOffsets(profile),
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    advisorName: investor.assignedAdvisorName || investor.advisorName || "",
    touchpointId: occasionTouchpointId(key, next.eventYear),
    custom: false
  };
}

export function customOccasionRow(record, investor, today) {
  if (!record?.active || !record.occasionDate) return null;
  const next = nextAnnualOccasion(record.occasionDate, today);
  if (!next) return null;
  const key = occasionKey({ source: "custom", occasionId: record.id });
  return {
    id: record.id,
    occasionKey: key,
    source: "custom",
    investorId: record.investorId,
    clientCode: investor?.clientCode || record.clientCode || "",
    investorName: investor?.fullName || record.investorName || "Investor",
    personName: record.personName || investor?.fullName || "Family member",
    relationship: record.relationship || "Other",
    occasionType: record.occasionType || "Other",
    occasionDate: record.occasionDate,
    eventDate: next.eventDate,
    eventYear: next.eventYear,
    daysUntil: next.daysUntil,
    turningAge: record.occasionType === "Birthday" ? turningAge(record.occasionDate, next.eventYear) : null,
    anniversaryYears: record.occasionType === "Anniversary" ? anniversaryYears(record.occasionDate, next.eventYear) : null,
    reminderEnabled: record.reminderEnabled !== false,
    reminderOffsets: normaliseReminderOffsets(record.reminderOffsets, 7),
    advisorUid: record.advisorUid || investor?.assignedAdvisorUid || investor?.advisorUid || "",
    advisorName: record.advisorName || investor?.assignedAdvisorName || investor?.advisorName || "",
    notes: record.notes || "",
    touchpointId: occasionTouchpointId(key, next.eventYear),
    custom: true
  };
}

export function mergeTouchpoint(row, touchpoint) {
  if (!row) return null;
  return {
    ...row,
    touchpointStatus: touchpoint?.status || "Pending",
    touchpointChannel: touchpoint?.channel || "",
    touchpointNote: touchpoint?.note || "",
    completedAt: touchpoint?.completedAt || null,
    completedByName: touchpoint?.completedByName || "",
    skippedAt: touchpoint?.skippedAt || null,
    lastReminderAt: touchpoint?.lastReminderAt || null,
    lastReminderDaysBefore: touchpoint?.lastReminderDaysBefore ?? null
  };
}

export function reminderTitle(row) {
  if (row.occasionType === "Birthday") return row.daysUntil === 0 ? "Birthday today" : "Upcoming birthday";
  if (row.occasionType === "Anniversary") return row.daysUntil === 0 ? "Anniversary today" : "Upcoming anniversary";
  return row.daysUntil === 0 ? "Occasion today" : "Upcoming occasion";
}

export function reminderMessage(row) {
  const when = row.daysUntil === 0 ? "today" : `in ${row.daysUntil} day${row.daysUntil === 1 ? "" : "s"}`;
  if (row.relationship === "Investor") {
    return `${row.investorName}'s ${row.occasionType.toLowerCase()} is ${when}. Review the relationship context and complete the approved outreach manually.`;
  }
  return `${row.personName} (${row.relationship}) — ${row.investorName}'s family — has a ${row.occasionType.toLowerCase()} ${when}. Review consent and complete the approved relationship outreach manually.`;
}
