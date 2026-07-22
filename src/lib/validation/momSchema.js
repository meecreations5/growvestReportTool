import { z } from "zod";

const decisionSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Decision is required."),
  owner: z.string().trim().optional().default(""),
  dueDate: z.string().trim().optional().default(""),
  clientVisible: z.boolean().default(true)
});

const actionSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Action description is required."),
  assignedToName: z.string().trim().min(1, "Action owner is required."),
  assignedToUid: z.string().trim().optional().default(""),
  ownerType: z.enum(["investor", "advisor", "admin", "other"]),
  dueDate: z.string().trim().optional().default(""),
  priority: z.enum(["high", "medium", "low"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  completionNote: z.string().trim().optional().default(""),
  clientVisible: z.boolean().default(false)
});

export const momSchema = z.object({
  meetingId: z.string().trim().min(1, "Select a meeting."),
  discussionSummary: z.string().trim().min(10, "Add a meaningful discussion summary."),
  clientRequirements: z.string().trim().optional().default(""),
  goalsDiscussed: z.string().trim().optional().default(""),
  investmentsDiscussed: z.string().trim().optional().default(""),
  liabilitiesDiscussed: z.string().trim().optional().default(""),
  clientConcerns: z.string().trim().optional().default(""),
  familyInputs: z.string().trim().optional().default(""),
  advisorObservations: z.string().trim().optional().default(""),
  internalNotes: z.string().trim().optional().default(""),
  clientSummary: z.string().trim().min(5, "Client-facing summary is required."),
  decisions: z.array(decisionSchema).default([]),
  actionItems: z.array(actionSchema).default([]),
  investorVisible: z.boolean().default(true),
  status: z.enum(["draft", "completed"]),
  followUpRequired: z.boolean().default(false),
  followUpDate: z.string().trim().optional().default(""),
  followUpTime: z.string().trim().optional().default(""),
  followUpPurpose: z.string().trim().optional().default("")
}).superRefine((value, context) => {
  if (value.followUpRequired && !value.followUpDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["followUpDate"], message: "Follow-up date is required." });
  }
  if (value.followUpRequired && !value.followUpPurpose) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["followUpPurpose"], message: "Follow-up purpose is required." });
  }
});
