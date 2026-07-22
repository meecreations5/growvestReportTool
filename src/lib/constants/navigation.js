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
  BookOpenText
} from "lucide-react";
import { ADMIN_ROLES, STAFF_ROLES } from "./roles";

export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: STAFF_ROLES }
    ]
  },
  {
    label: "Client Acquisition",
    items: [
      { label: "Leads", href: "/leads", icon: UsersRound, roles: STAFF_ROLES }
    ]
  },
  {
    label: "Advisory",
    items: [
      { label: "Investors", href: "/investors", icon: UserRoundCheck, roles: STAFF_ROLES },
      { label: "Meetings", href: "/meetings", icon: CalendarDays, roles: STAFF_ROLES },
      { label: "MOM", href: "/mom", icon: ClipboardList, roles: STAFF_ROLES }
    ]
  },
  {
    label: "Portfolio Management",
    items: [
      { label: "Monthly Reports", href: "/reports", icon: FileBarChart, roles: STAFF_ROLES },
      { label: "Data Imports", href: "/data-imports", icon: FileSpreadsheet, roles: STAFF_ROLES },
      { label: "Market Commentary", href: "/market-commentary", icon: BookOpenText, roles: STAFF_ROLES },
      { label: "Report Templates", href: "/report-templates", icon: LayoutTemplate, roles: STAFF_ROLES },
      { label: "Client Servicing", href: "/servicing", icon: RefreshCcw, roles: STAFF_ROLES }
    ]
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/users", icon: UserCog, roles: ADMIN_ROLES },
      { label: "Settings", href: "/settings", icon: Settings, roles: ADMIN_ROLES }
    ]
  }
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const QUICK_CREATE_ITEMS = [
  { label: "New lead", href: "/leads/create", icon: UsersRound, roles: STAFF_ROLES },
  { label: "Schedule meeting", href: "/meetings/create", icon: CalendarDays, roles: STAFF_ROLES },
  { label: "Create MOM", href: "/mom/create", icon: ClipboardList, roles: STAFF_ROLES },
  { label: "Monthly report", href: "/reports/create", icon: FileBarChart, roles: STAFF_ROLES },
  { label: "Import portfolio data", href: "/data-imports", icon: FileSpreadsheet, roles: STAFF_ROLES },
  { label: "New market commentary", href: "/market-commentary/create", icon: BookOpenText, roles: STAFF_ROLES },
  { label: "Notification centre", href: "/dashboard", icon: BellRing, roles: STAFF_ROLES }
];
