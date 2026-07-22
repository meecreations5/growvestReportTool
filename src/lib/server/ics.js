function escapeIcs(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtc(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createMeetingIcs(meeting, eventType = "meeting_scheduled") {
  const start = meeting.startAt?.toDate ? meeting.startAt.toDate() : new Date(`${meeting.meetingDate}T${meeting.startTime}:00+05:30`);
  const end = meeting.endAt?.toDate ? meeting.endAt.toDate() : new Date(`${meeting.meetingDate}T${meeting.endTime}:00+05:30`);
  const descriptionParts = [
    meeting.instructions || "",
    meeting.meetingLink ? `Join meeting: ${meeting.meetingLink}` : "",
    meeting.agenda?.length ? `Agenda:\n${meeting.agenda.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : ""
  ].filter(Boolean);
  const status = eventType === "meeting_cancelled" ? "CANCELLED" : "CONFIRMED";
  const method = eventType === "meeting_cancelled" ? "CANCEL" : "REQUEST";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GrowVest//Meeting Calendar//EN",
    `METHOD:${method}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${meeting.id || meeting.meetingCode}@growvest.info`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeIcs(meeting.title)}`,
    `DESCRIPTION:${escapeIcs(descriptionParts.join("\n\n"))}`,
    `LOCATION:${escapeIcs(meeting.location || meeting.meetingLink || "Online")}`,
    `STATUS:${status}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`Reminder: ${meeting.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
