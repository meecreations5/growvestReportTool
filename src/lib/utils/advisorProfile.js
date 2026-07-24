import { USER_ROLES } from "@/lib/constants/roles";

export function hasAdvisorProfile(user = {}) {
  return Boolean(user?.role === USER_ROLES.ADVISOR || user?.advisorProfileEnabled === true);
}

export function advisorProfileLabel(user = {}) {
  if (!hasAdvisorProfile(user)) return "Not enabled";
  return user?.role === USER_ROLES.ADVISOR ? "Primary Advisor role" : "Advisor capability enabled";
}
