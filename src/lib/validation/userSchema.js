import { z } from "zod";
import { STAFF_USER_ROLES, USER_STATUSES } from "@/lib/constants/user";

export const staffInvitationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Enter a valid Microsoft email"),
  role: z.enum(STAFF_USER_ROLES),
  designation: z.string().trim().min(2, "Designation is required"),
  advisorCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  signatureEnabled: z.boolean().optional(),
  emailSignatureHtml: z.string().optional()
}).superRefine((value, context) => {
  if (value.role === "advisor" && !value.advisorCode) {
    context.addIssue({
      code: "custom",
      path: ["advisorCode"],
      message: "Advisor code is required for an Advisor"
    });
  }
});

export const staffUserUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  role: z.enum(STAFF_USER_ROLES),
  designation: z.string().trim().min(2, "Designation is required"),
  advisorCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  signatureEnabled: z.boolean().optional(),
  emailSignatureHtml: z.string().optional(),
  status: z.enum(USER_STATUSES)
}).superRefine((value, context) => {
  if (value.role === "advisor" && !value.advisorCode) {
    context.addIssue({
      code: "custom",
      path: ["advisorCode"],
      message: "Advisor code is required for an Advisor"
    });
  }
});
