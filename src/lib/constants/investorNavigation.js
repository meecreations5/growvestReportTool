import { BellRing, CalendarClock, ChartNoAxesCombined, CircleDollarSign, FileBarChart2, Files, Home, KeyRound, ListChecks, ShieldCheck, Target, UserRound } from "lucide-react";

// v0.34.5 Exact Home Reference Lock
// Persistent phone navigation follows the approved Home reference exactly:
// Home, Portfolio, central GrowVest action, Bucket List and Reports. Profile
// remains accessible from the Home avatar and the GrowVest action menu.
export const INVESTOR_NAV_ITEMS = [
  { label: "Home", href: "/investor/dashboard", icon: Home, mobile: true },
  { label: "Portfolio", href: "/investor/portfolio", icon: ChartNoAxesCombined, mobile: true },
  { label: "Bucket List", href: "/investor/goals", icon: Target, mobile: true },
  { label: "Reports", href: "/investor/reports", icon: FileBarChart2, mobile: true },
  { label: "Profile", href: "/investor/profile", icon: UserRound },
  { label: "Insurance & Protection", href: "/investor/insurance", icon: ShieldCheck },
  { label: "Documents", href: "/investor/documents", icon: Files },
  { label: "Meetings & Reviews", href: "/investor/meetings", icon: CalendarClock },
  { label: "SIP Reminders", href: "/investor/sip-reminders", icon: CircleDollarSign },
  { label: "Your Actions", href: "/investor/actions", icon: ListChecks },
  { label: "Notifications", href: "/investor/notifications", icon: BellRing },
  { label: "Login & Security", href: "/investor/change-password", icon: KeyRound }
];
