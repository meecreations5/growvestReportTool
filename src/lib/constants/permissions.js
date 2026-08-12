import { USER_ROLES } from "@/lib/constants/roles";

export const ACCESS_LEVELS = {
  FULL: "full",
  MANAGE: "manage",
  ASSIGNED: "assigned",
  VIEW: "view",
  OWN: "own",
  NONE: "none"
};

export const ACCESS_LEVEL_LABELS = {
  [ACCESS_LEVELS.FULL]: "Full access",
  [ACCESS_LEVELS.MANAGE]: "Manage",
  [ACCESS_LEVELS.ASSIGNED]: "Assigned only",
  [ACCESS_LEVELS.VIEW]: "View / select",
  [ACCESS_LEVELS.OWN]: "Own records",
  [ACCESS_LEVELS.NONE]: "No access"
};

export const PERMISSION_GROUPS = [
  {
    label: "Core workspace",
    permissions: [
      {
        key: "dashboard",
        label: "Dashboard",
        description: "Operational and monthly reporting overview.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "leads",
        label: "Leads",
        description: "Create, assign and progress prospective Investor records.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "investors",
        label: "Investors",
        description: "Investor profiles, goals, portfolio and portal access.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.OWN
        }
      },
      {
        key: "assessments",
        label: "Client Assessments",
        description: "Suitability, qualification and conversion workflow.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      }
    ]
  },
  {
    label: "Advisory and reporting",
    permissions: [
      {
        key: "meetings",
        label: "Meetings & MOM",
        description: "Schedule meetings, publish MOM and track actions.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.OWN
        }
      },
      {
        key: "reports",
        label: "Monthly Reports",
        description: "Create, review, publish and download monthly reports.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.OWN
        }
      },
      {
        key: "actions",
        label: "Investor Actions",
        description: "Track investor requests, Advisor recommendations, decisions and completion follow-up.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.OWN
        }
      },
      {
        key: "occasions",
        label: "Birthdays & Occasions",
        description: "Track Investor and family occasions, Advisor reminders and relationship touchpoint completion.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "portfolio",
        label: "Daily Portfolio",
        description: "Update and review investor portfolio positions, valuations and daily snapshots.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.OWN
        }
      },
      {
        key: "imports",
        label: "Data Imports",
        description: "Upload and validate portfolio files for report preparation.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "commentary",
        label: "Market Commentary",
        description: "Draft reusable commentary and approve Investor-visible content.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.MANAGE,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "delivery",
        label: "Email & Delivery",
        description: "Send reports and track delivery activity.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "templates",
        label: "Report Templates",
        description: "Manage standard templates and select active report designs.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.MANAGE,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.VIEW,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "servicing",
        label: "Client Servicing",
        description: "Manage client queries, monthly updates, reviews and renewal workflows.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.ASSIGNED,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      }
    ]
  },
  {
    label: "Administration",
    permissions: [
      {
        key: "signatures",
        label: "Individual Email Signatures",
        description: "Maintain personal signatures and publish approved communication identities.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.MANAGE,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.OWN,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "users",
        label: "Users & Roles",
        description: "Authorise staff, assign roles and control active access.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.VIEW,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.NONE,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "branding",
        label: "Settings & Branding",
        description: "Manage system settings and publish brand configuration.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.MANAGE,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.NONE,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      },
      {
        key: "audit",
        label: "Access Audit History",
        description: "Review invitations, status changes and role updates.",
        access: {
          [USER_ROLES.SUPER_ADMIN]: ACCESS_LEVELS.FULL,
          [USER_ROLES.ADMIN]: ACCESS_LEVELS.VIEW,
          [USER_ROLES.ADVISOR]: ACCESS_LEVELS.NONE,
          [USER_ROLES.INVESTOR]: ACCESS_LEVELS.NONE
        }
      }
    ]
  }
];

export const ROLE_SUMMARIES = {
  [USER_ROLES.SUPER_ADMIN]: "Full platform control, security administration and publishing authority.",
  [USER_ROLES.ADMIN]: "Operational administration across Investors, reports and content, with limited security changes.",
  [USER_ROLES.ADVISOR]: "Works with assigned leads and Investors, prepares reports and manages advisory communication.",
  [USER_ROLES.INVESTOR]: "Secure access to their own profile, reports, meetings, goals and documents only."
};

export const ACCESS_LEVEL_OPTIONS = [
  ACCESS_LEVELS.FULL,
  ACCESS_LEVELS.MANAGE,
  ACCESS_LEVELS.ASSIGNED,
  ACCESS_LEVELS.VIEW,
  ACCESS_LEVELS.OWN,
  ACCESS_LEVELS.NONE
];

export const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

export const PERMISSION_DEFINITIONS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.key, permission])
  )
);

export function buildDefaultRolePermissions() {
  const roles = Object.values(USER_ROLES);
  return Object.fromEntries(
    roles.map((role) => [
      role,
      Object.fromEntries(
        PERMISSION_GROUPS.flatMap((group) =>
          group.permissions.map((permission) => [
            permission.key,
            permission.access[role] || ACCESS_LEVELS.NONE
          ])
        )
      )
    ])
  );
}

export const DEFAULT_ROLE_PERMISSIONS = buildDefaultRolePermissions();

function validAccessLevel(value) {
  return ACCESS_LEVEL_OPTIONS.includes(value) ? value : ACCESS_LEVELS.NONE;
}

export function normaliseRolePermissions(value = {}) {
  const defaults = DEFAULT_ROLE_PERMISSIONS;
  return Object.fromEntries(
    Object.values(USER_ROLES).map((role) => [
      role,
      Object.fromEntries(
        PERMISSION_KEYS.map((key) => [
          key,
          role === USER_ROLES.SUPER_ADMIN
            ? defaults[role][key]
            : validAccessLevel(value?.[role]?.[key] ?? defaults[role][key])
        ])
      )
    ])
  );
}

export function normalisePermissionOverrides(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {})
      .filter(([key, level]) => PERMISSION_KEYS.includes(key) && ACCESS_LEVEL_OPTIONS.includes(level))
  );
}

export function resolveEffectivePermissions(role, rolePermissions = {}, overrides = {}) {
  const normalisedRoles = normaliseRolePermissions(rolePermissions);
  const base = normalisedRoles[role] || Object.fromEntries(PERMISSION_KEYS.map((key) => [key, ACCESS_LEVELS.NONE]));
  const normalisedOverrides = normalisePermissionOverrides(overrides);
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, normalisedOverrides[key] ?? base[key] ?? ACCESS_LEVELS.NONE])
  );
}

export function canAccessPermission(effectivePermissions = {}, permissionKey) {
  if (!permissionKey) return true;
  return (effectivePermissions[permissionKey] || ACCESS_LEVELS.NONE) !== ACCESS_LEVELS.NONE;
}
