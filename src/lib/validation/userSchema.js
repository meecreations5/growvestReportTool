import { z } from "zod";
import { STAFF_USER_ROLES, USER_STATUSES } from "@/lib/constants/user";

const sharedStaffFields = {
  fullName: z.string().trim().min(2, "Full name is required"),
  role: z.enum(STAFF_USER_ROLES),
  designation: z.string().trim().min(2, "Designation is required"),
  advisorProfileEnabled: z.boolean().optional(),
  advisorCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  signatureEnabled: z.boolean().optional(),
  emailSignatureHtml: z.string().optional()
};

export const staffInvitationSchema = z.object({
  ...sharedStaffFields,
  email: z.string().trim().email("Enter a valid Microsoft email")
});

export const staffUserUpdateSchema = z.object({
  ...sharedStaffFields,
  status: z.enum(USER_STATUSES)
});
