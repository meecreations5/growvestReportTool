import { z } from "zod";
import { CONTACT_CHANNELS, LEAD_STATUSES, requiresLeadClosureReason } from "@/lib/constants/lead";

export const followUpSchema = z.object({
  contactDate: z.string().min(1, "Contact date is required"),
  contactTime: z.string().min(1, "Contact time is required"),
  channel: z.enum(CONTACT_CHANNELS),
  summary: z.string().trim().min(5, "Add a short summary of the discussion"),
  clientResponse: z.string().trim().optional(),
  statusAfter: z.enum(LEAD_STATUSES),
  lapseReason: z.string().trim().optional(),
  nextAction: z.string().trim().min(3, "Next action is required"),
  followUpDue: z.string().optional()
}).superRefine((values, context) => {
  if (requiresLeadClosureReason(values.statusAfter) && !values.lapseReason) {
    context.addIssue({
      code: "custom",
      path: ["lapseReason"],
      message: "Closure reason is required for this status"
    });
  }
});
