import { meetingProviderLabel, meetingTypeLabel } from "@/lib/constants/meeting";

function formatMeetingDate(dateValue) {
  if (!dateValue) return "—";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function buildInvestorMeetingWhatsAppMessage(meeting) {
  const lines = [
    `Hello ${meeting.investorName || meeting.leadName || ""},`,
    "",
    `Your GrowVest ${meetingTypeLabel(meeting.meetingType)} has been scheduled.`,
    "",
    `Date: ${formatMeetingDate(meeting.meetingDate)}`,
    `Time: ${meeting.startTime || "—"}${meeting.endTime ? ` – ${meeting.endTime}` : ""}`,
    `Advisor: ${meeting.advisorName || "GrowVest Advisor"}`,
    `Mode: ${meetingProviderLabel(meeting.meetingProvider)}`
  ];

  if (meeting.meetingLink) {
    lines.push("", "Meeting Link:", meeting.meetingLink);
  }
  if (meeting.location) {
    lines.push("", `Location: ${meeting.location}`);
  }
  if (meeting.agenda?.length) {
    lines.push("", "Agenda:", ...meeting.agenda.map((item, index) => `${index + 1}. ${item}`));
  }

  lines.push("", "Regards,", meeting.advisorName || "GrowVest Advisor", "GrowVest");
  return lines.join("\n");
}

export function buildInvestorMomWhatsAppMessage(mom) {
  const lines = [
    `Hello ${mom.investorName || ""},`,
    "",
    "The summary and agreed next steps from your recent GrowVest meeting are now available.",
    ""
  ];

  if (mom.clientSummary) lines.push(mom.clientSummary, "");
  if (mom.clientVisibleActionItems?.length) {
    lines.push("Agreed action items:");
    mom.clientVisibleActionItems.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.description}${item.dueDate ? ` (Due: ${item.dueDate})` : ""}`);
    });
    lines.push("");
  }

  lines.push("Regards,", mom.advisorName || "GrowVest Advisor", "GrowVest");
  return lines.join("\n");
}
