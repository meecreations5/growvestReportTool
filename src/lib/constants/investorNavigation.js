import { BellRing, CalendarClock, FileBarChart2, Files, KeyRound, LayoutDashboard, Target, UserRound } from "lucide-react";

export const INVESTOR_NAV_ITEMS = [
  { label: "Home", href: "/investor/dashboard", icon: LayoutDashboard, mobile: true },
  { label: "Reports", href: "/investor/reports", icon: FileBarChart2, mobile: true },
  { label: "Goals", href: "/investor/goals", icon: Target, mobile: true },
  { label: "Notifications", href: "/investor/notifications", icon: BellRing, mobile: true },
  { label: "Meetings", href: "/investor/meetings", icon: CalendarClock },
  { label: "Documents", href: "/investor/documents", icon: Files },
  { label: "Profile", href: "/investor/profile", icon: UserRound },
  { label: "Login & Security", href: "/investor/change-password", icon: KeyRound }
];
