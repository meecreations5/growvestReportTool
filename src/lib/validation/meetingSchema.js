import { z } from "zod";
import { isOnlineMeetingProvider } from "@/lib/constants/meeting";

const attendeeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Attendee name is required."),
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  mobile: z.string().trim().optional().default(""),
  type: z.string().trim().min(1),
  required: z.boolean().default(true),
  sendEmail: z.boolean().default(true),
  sendWhatsApp: z.boolean().default(false)
});

export const meetingSchema = z.object({
  linkedType: z.enum(["investor", "lead", "internal"]),
  investorId: z.string().optional().default(""),
  leadId: z.string().optional().default(""),
  title: z.string().trim().min(3, "Meeting title is required."),
  meetingType: z.string().trim().min(1, "Select a meeting type."),
  meetingProvider: z.string().trim().min(1, "Select a meeting provider."),
  meetingDate: z.string().trim().min(1, "Meeting date is required."),
  startTime: z.string().trim().min(1, "Start time is required."),
  endTime: z.string().trim().min(1, "End time is required."),
  timeZone: z.string().trim().min(1),
  meetingLink: z.string().trim().url("Enter a valid meeting URL.").or(z.literal("")),
  location: z.string().trim().optional().default(""),
  instructions: z.string().trim().optional().default(""),
  agenda: z.array(z.string().trim().min(1)).default([]),
  attendees: z.array(attendeeSchema).default([]),
  investorVisible: z.boolean().default(true),
  sendInvestorEmail: z.boolean().default(true),
  sendAdvisorEmail: z.boolean().default(true),
  createInAppNotifications: z.boolean().default(true),
  reminder24Hours: z.boolean().default(true),
  reminder1Hour: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.linkedType === "investor" && !value.investorId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["investorId"], message: "Select an investor." });
  }
  if (value.linkedType === "lead" && !value.leadId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["leadId"], message: "Select a lead." });
  }
  if (isOnlineMeetingProvider(value.meetingProvider) && !value.meetingLink) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["meetingLink"], message: "Meeting link is required for online meetings." });
  }
  if (value.meetingProvider === "physical" && !value.location) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["location"], message: "Meeting location is required." });
  }
  if (value.startTime && value.endTime && value.endTime <= value.startTime) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time must be after start time." });
  }
});
