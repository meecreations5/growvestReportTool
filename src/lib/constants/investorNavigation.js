import { BellRing, CalendarClock, FileBarChart2, Files, KeyRound, LayoutDashboard, ListChecks, Target, UserRound, WalletCards, CircleDollarSign } from "lucide-react";

export const INVESTOR_NAV_ITEMS = [
  { label: "Home", href: "/investor/dashboard", icon: LayoutDashboard, mobile: true },
  { label: "Portfolio", href: "/investor/portfolio", icon: WalletCards, mobile: true },
  { label: "Reports", href: "/investor/reports", icon: FileBarChart2, mobile: true },
  { label: "Goals", href: "/investor/goals", icon: Target, mobile: true },
  { label: "Advisor Follow-up", href: "/investor/actions", icon: ListChecks },
  { label: "SIP Reminders", href: "/investor/sip-reminders", icon: CircleDollarSign },
  { label: "Notifications", href: "/investor/notifications", icon: BellRing, mobile: true },
  { label: "Meetings", href: "/investor/meetings", icon: CalendarClock },
  { label: "Documents", href: "/investor/documents", icon: Files },
  { label: "Profile", href: "/investor/profile", icon: UserRound },
  { label: "Login & Security", href: "/investor/change-password", icon: KeyRound }
];
