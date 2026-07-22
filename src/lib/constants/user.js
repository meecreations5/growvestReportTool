import { USER_ROLES } from "@/lib/constants/roles";

export const STAFF_USER_ROLES = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.ADVISOR
];

export const USER_STATUSES = ["active", "inactive"];

export const STAFF_ROLE_OPTIONS = [
  { value: USER_ROLES.SUPER_ADMIN, label: "Super Admin" },
  { value: USER_ROLES.ADMIN, label: "Admin" },
  { value: USER_ROLES.ADVISOR, label: "Advisor" }
];

export const INVITATION_STATUSES = {
  PENDING: "pending",
  LINKED: "linked",
  CANCELLED: "cancelled"
};

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}
