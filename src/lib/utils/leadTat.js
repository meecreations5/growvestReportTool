import {
  addDays,
  addHours,
  combineLocalDateTime,
  differenceInDays,
  formatDurationFromNow,
  toDate
} from "./date";

const TERMINAL_STATUSES = new Set(["CONVERTED", "DROPPED", "NOT QUALIFIED"]);

function receivedAt(lead) {
  return toDate(lead.receivedAt) || combineLocalDateTime(lead.dateReceived, lead.timeReceived) || toDate(lead.createdAt);
}

function stageStartedAt(lead) {
  return toDate(lead.statusChangedAt) || toDate(lead.stageEnteredAt) || receivedAt(lead);
}

function explicitFollowUpDue(lead) {
  if (!lead.followUpDue) return null;
  if (lead.followUpDue?.toDate) return lead.followUpDue.toDate();
  if (typeof lead.followUpDue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lead.followUpDue)) {
    return combineLocalDateTime(lead.followUpDue, "18:00");
  }
  return toDate(lead.followUpDue);
}

function proposalFollowUp(lead, now) {
  const base = toDate(lead.proposalSentAt) || stageStartedAt(lead);
  if (!base) return null;

  const lastContact = toDate(lead.lastContactAt);
  const ladder = [
    { day: 2, action: "Day 2 proposal check-in" },
    { day: 4, action: "Proposal walk-through call" },
    { day: 7, action: "Day 7 soft nudge" },
    { day: 10, action: "Direct conversion call" },
    { day: 14, action: "Log final outcome — no exceptions" }
  ];

  const nextMilestone = ladder.find((item) => {
    const dueAt = addDays(base, item.day);
    return !lastContact || lastContact.getTime() < dueAt.getTime();
  });

  if (!nextMilestone) {
    return {
      action: "Record the final outcome",
      dueAt: addDays(base, 14),
      isBreached: now > addDays(base, 14),
      rule: "Final outcome by Day 14"
    };
  }

  const dueAt = addDays(base, nextMilestone.day);
  return {
    action: nextMilestone.action,
    dueAt,
    isBreached: now > dueAt,
    rule: `Proposal follow-up ladder · Day ${nextMilestone.day}`
  };
}

export function calculateLeadTat(lead, now = new Date()) {
  if (!lead) {
    return {
      action: "—",
      dueAt: null,
      isBreached: false,
      state: "not_applicable",
      rule: "No lead selected",
      daysInStatus: 0,
      remainingLabel: "No deadline"
    };
  }

  const start = stageStartedAt(lead);
  const daysInStatus = start ? Math.max(0, differenceInDays(now, start)) : 0;

  if (TERMINAL_STATUSES.has(lead.status)) {
    if (lead.status === "CONVERTED") {
      const dueAt = addHours(start, 1);
      const isBreached = Boolean(dueAt && now > dueAt && !lead.convertedInvestorId);
      return {
        action: lead.convertedInvestorId ? "Investor onboarding completed" : "Trigger investor onboarding",
        dueAt,
        isBreached,
        state: lead.convertedInvestorId ? "complete" : (isBreached ? "breached" : "on_track"),
        rule: "Onboarding within 1 hour of conversion",
        daysInStatus,
        remainingLabel: lead.convertedInvestorId ? "Completed" : formatDurationFromNow(dueAt, now)
      };
    }

    return {
      action: "No active TAT",
      dueAt: null,
      isBreached: false,
      state: "complete",
      rule: "Terminal pipeline status",
      daysInStatus,
      remainingLabel: "Completed"
    };
  }

  let result;
  const manualDue = explicitFollowUpDue(lead);

  switch (lead.status) {
    case "NEW":
      result = {
        action: "Send opening WhatsApp and make first contact",
        dueAt: addHours(receivedAt(lead), 2),
        rule: "Opening communication within 2 hours"
      };
      break;
    case "CONTACTED":
      result = {
        action: "Complete lead qualification",
        dueAt: addHours(start, 24),
        rule: "Qualification within 24 hours"
      };
      break;
    case "QUALIFIED":
    case "WARM":
      result = {
        action: "Schedule consultation and prepare proposal",
        dueAt: addHours(start, 48),
        rule: "Consultation / proposal within 48 hours"
      };
      break;
    case "IN PROPOSAL":
      result = proposalFollowUp(lead, now);
      break;
    case "COMMITTED — PENDING":
      result = {
        action: lead.nextAction || "Collect pending documents, funds or sign-off",
        dueAt: manualDue || addHours(start, 48),
        rule: manualDue ? "Manual follow-up deadline" : "Pending commitment review within 48 hours"
      };
      break;
    case "LONG FOLLOW-UP":
      result = {
        action: lead.nextAction || "Complete scheduled long follow-up",
        dueAt: manualDue,
        rule: "Advisor-scheduled follow-up"
      };
      break;
    case "LAPSE — CLIENT SIDE":
    case "LAPSE — COMPANY SIDE":
      result = {
        action: lead.nextAction || "Notify stakeholders and start recovery action",
        dueAt: manualDue || addHours(start, 24),
        rule: "Lapse recovery and escalation"
      };
      break;
    case "RECOVERED":
      result = {
        action: lead.nextAction || "Confirm the next pipeline step",
        dueAt: manualDue || addHours(start, 24),
        rule: "Confirm recovery within 24 hours"
      };
      break;
    default:
      result = {
        action: lead.nextAction || "Set the next action",
        dueAt: manualDue,
        rule: "Advisor-defined next action"
      };
  }

  const dueAt = result?.dueAt || null;
  const isBreached = Boolean(dueAt && now > dueAt);

  return {
    ...result,
    dueAt,
    isBreached,
    state: dueAt ? (isBreached ? "breached" : "on_track") : "not_set",
    daysInStatus,
    remainingLabel: dueAt ? formatDurationFromNow(dueAt, now) : "Deadline not set"
  };
}
