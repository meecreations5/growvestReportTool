import {
  LayoutDashboard,
  UsersRound,
  UserRoundCheck,
  ClipboardList,
  CalendarDays,
  FileBarChart,
  FileSpreadsheet,
  LayoutTemplate,
  RefreshCcw,
  UserCog,
  Settings,
  BellRing,
  BookOpenText,
  MailCheck,
  PenTool
} from "lucide-react";
import { ADMIN_ROLES, STAFF_ROLES } from "./roles";

export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: STAFF_ROLES, permission: "dashboard" }
    ]
  },
  {
    label: "Client Acquisition",
    items: [
      { label: "Leads", href: "/leads", icon: UsersRound, roles: STAFF_ROLES, permission: "leads" }
    ]
  },
  {
    label: "Advisory",
    items: [
      { label: "Investors", href: "/investors", icon: UserRoundCheck, roles: STAFF_ROLES, permission: "investors" },
      { label: "Meetings", href: "/meetings", icon: CalendarDays, roles: STAFF_ROLES, permission: "meetings" },
      { label: "MOM", href: "/mom", icon: ClipboardList, roles: STAFF_ROLES, permission: "meetings" }
    ]
  },
  {
    label: "Portfolio Management",
    items: [
      { label: "Monthly Reports", href: "/reports", icon: FileBarChart, roles: STAFF_ROLES, permission: "reports" },
      { label: "Data Imports", href: "/data-imports", icon: FileSpreadsheet, roles: STAFF_ROLES, permission: "imports" },
      { label: "Market Commentary", href: "/market-commentary", icon: BookOpenText, roles: STAFF_ROLES, permission: "commentary" },
      { label: "Email & Delivery", href: "/email-delivery", icon: MailCheck, roles: STAFF_ROLES, permission: "delivery" },
      { label: "Report Templates", href: "/report-templates", icon: LayoutTemplate, roles: STAFF_ROLES, permission: "templates" },
      { label: "Client Servicing", href: "/servicing", icon: RefreshCcw, roles: STAFF_ROLES, permission: "servicing" }
    ]
  },
  {
    label: "Account & Administration",
    items: [
      { label: "My Signature", href: "/my-signature", icon: PenTool, roles: STAFF_ROLES, permission: "signatures" },
      { label: "Users & Roles", href: "/users", icon: UserCog, roles: ADMIN_ROLES, permission: "users" },
      { label: "Settings", href: "/settings", icon: Settings, roles: ADMIN_ROLES, permission: "branding" }
    ]
  }
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const QUICK_CREATE_ITEMS = [
  { label: "New lead", href: "/leads/create", icon: UsersRound, roles: STAFF_ROLES, permission: "leads" },
  { label: "Schedule meeting", href: "/meetings/create", icon: CalendarDays, roles: STAFF_ROLES, permission: "meetings" },
  { label: "Create MOM", href: "/mom/create", icon: ClipboardList, roles: STAFF_ROLES, permission: "meetings" },
  { label: "Monthly report", href: "/reports/create", icon: FileBarChart, roles: STAFF_ROLES, permission: "reports" },
  { label: "Import portfolio data", href: "/data-imports", icon: FileSpreadsheet, roles: STAFF_ROLES, permission: "imports" },
  { label: "New market commentary", href: "/market-commentary/create", icon: BookOpenText, roles: STAFF_ROLES, permission: "commentary" },
  { label: "Email & delivery centre", href: "/email-delivery", icon: MailCheck, roles: STAFF_ROLES, permission: "delivery" },
  { label: "Notification centre", href: "/dashboard", icon: BellRing, roles: STAFF_ROLES, permission: "dashboard" }
];
