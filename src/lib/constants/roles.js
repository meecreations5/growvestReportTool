export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  ADVISOR: "advisor",
  INVESTOR: "investor"
};

export const STAFF_ROLES = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.ADVISOR
];

export const ADMIN_ROLES = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

export const ROLE_LABELS = {
  [USER_ROLES.SUPER_ADMIN]: "Super Admin",
  [USER_ROLES.ADMIN]: "Admin",
  [USER_ROLES.ADVISOR]: "Advisor",
  [USER_ROLES.INVESTOR]: "Investor"
};

export const ACTIVE_USER_STATUSES = ["active"];

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function getHomeRouteForRole(role) {
  return role === USER_ROLES.INVESTOR ? "/investor/dashboard" : "/dashboard";
}
