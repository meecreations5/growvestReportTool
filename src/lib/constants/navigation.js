import {
  LayoutDashboard,
  UsersRound,
  UserRoundCheck,
  ClipboardList,
  CalendarDays,
  FileBarChart,
  FileSpreadsheet,
  FileUp,
  LayoutTemplate,
  RefreshCcw,
  UserCog,
  Settings,
  BellRing,
  BookOpenText,
  MailCheck,
  PenTool,
  UserRound,
  WalletCards,
  ListChecks,
  CakeSlice,
  Settings2
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
      { label: "MOM", href: "/mom", icon: ClipboardList, roles: STAFF_ROLES, permission: "meetings" },
      { label: "Advisor Follow-up", href: "/actions", icon: ListChecks, roles: STAFF_ROLES, permission: "actions" },
      { label: "SIP Funding", href: "/sip-funding", icon: BellRing, roles: STAFF_ROLES, permission: "actions" },
      { label: "Service Requests", href: "/servicing", icon: RefreshCcw, roles: STAFF_ROLES, permission: "servicing" },
      { label: "Birthdays & Occasions", href: "/occasions", icon: CakeSlice, roles: STAFF_ROLES, permission: "occasions" }
    ]
  },
  {
    label: "Portfolio Management",
    items: [
      { label: "Portfolio Overview", href: "/portfolio", icon: WalletCards, roles: STAFF_ROLES, permission: "portfolio" },
      { label: "Daily Portfolio Update", href: "/portfolio/daily-update", icon: FileUp, roles: STAFF_ROLES, permission: "portfolio" },
      { label: "Portfolio Administration", href: "/portfolio/administration", icon: Settings2, roles: ADMIN_ROLES, permission: "portfolio" },
      { label: "Monthly Reports", href: "/reports", icon: FileBarChart, roles: STAFF_ROLES, permission: "reports" },
      { label: "Monthly Market Note", href: "/market-commentary", icon: BookOpenText, roles: STAFF_ROLES, permission: "commentary" },
      { label: "Email & Delivery", href: "/email-delivery", icon: MailCheck, roles: STAFF_ROLES, permission: "delivery" },
      { label: "Report Templates", href: "/report-templates", icon: LayoutTemplate, roles: STAFF_ROLES, permission: "templates" },
    ]
  },
  {
    label: "Account & Administration",
    items: [
      { label: "My Profile", href: "/profile", icon: UserRound, roles: STAFF_ROLES, permission: "dashboard" },
      { label: "My Signature", href: "/my-signature", icon: PenTool, roles: STAFF_ROLES, permission: "signatures" },
      { label: "Users & Roles", href: "/users", icon: UserCog, roles: ADMIN_ROLES, permission: "users" },
      { label: "Bulk Data Upload", href: "/data-imports", icon: FileSpreadsheet, roles: ADMIN_ROLES, permission: "imports" },
      { label: "Settings", href: "/settings", icon: Settings, roles: ADMIN_ROLES, permission: "branding" }
    ]
  }
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const QUICK_CREATE_ITEMS = [
  { label: "New lead", href: "/leads/create", icon: UsersRound, roles: STAFF_ROLES, permission: "leads" },
  { label: "Schedule meeting", href: "/meetings/create", icon: CalendarDays, roles: STAFF_ROLES, permission: "meetings" },
  { label: "Create MOM", href: "/mom/create", icon: ClipboardList, roles: STAFF_ROLES, permission: "meetings" },
  { label: "Advisor follow-up", href: "/actions", icon: ListChecks, roles: STAFF_ROLES, permission: "actions" },
  { label: "SIP funding", href: "/sip-funding", icon: BellRing, roles: STAFF_ROLES, permission: "actions" },
  { label: "Service request", href: "/servicing", icon: RefreshCcw, roles: STAFF_ROLES, permission: "servicing" },
  { label: "Birthdays & occasions", href: "/occasions", icon: CakeSlice, roles: STAFF_ROLES, permission: "occasions" },
  { label: "Daily portfolio update", href: "/portfolio/daily-update", icon: FileUp, roles: STAFF_ROLES, permission: "portfolio" },
  { label: "Monthly report", href: "/reports/create", icon: FileBarChart, roles: STAFF_ROLES, permission: "reports" },
    { label: "New monthly market note", href: "/market-commentary/create", icon: BookOpenText, roles: STAFF_ROLES, permission: "commentary" },
  { label: "Email & delivery centre", href: "/email-delivery", icon: MailCheck, roles: STAFF_ROLES, permission: "delivery" },
  { label: "Notification centre", href: "/dashboard", icon: BellRing, roles: STAFF_ROLES, permission: "dashboard" }
];
