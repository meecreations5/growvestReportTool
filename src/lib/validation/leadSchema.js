import { z } from "zod";
import { LEAD_SOURCES, LEAD_STATUSES, SERVICE_TYPES } from "@/lib/constants/lead";

const optionalNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().min(0).optional()
);

export const leadSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  contactNo: z.string().trim().min(10, "Enter a valid contact number").max(15, "Enter a valid contact number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  leadSource: z.enum(LEAD_SOURCES),
  referrer: z.string().trim().optional(),
  dateReceived: z.string().min(1, "Date received is required"),
  timeReceived: z.string().min(1, "Time received is required"),
  assignedAdvisorUid: z.string().min(1, "Advisor is required"),
  assignedAdvisorName: z.string().trim().min(1, "Advisor name is required"),
  status: z.enum(LEAD_STATUSES),
  qualificationScore: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(5).optional()
  ),
  serviceType: z.enum(SERVICE_TYPES),
  amount: optionalNumber,
  purposeOfInvestment: z.string().trim().optional(),
  followUpDue: z.string().optional(),
  notes: z.string().trim().optional()
});
