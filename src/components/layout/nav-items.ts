import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileText,
  LayoutGrid,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom tab bar. */
  mobile: boolean;
  /** Rendered with a "soon" marker — route exists but the feature is pending. */
  upcoming?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/board", label: "Board", icon: LayoutGrid, mobile: true },
  { href: "/daily", label: "Daily", icon: CalendarDays, mobile: true },
  { href: "/weekly", label: "Weekly", icon: CalendarRange, mobile: true },
  { href: "/monthly", label: "Monthly", icon: ClipboardList, mobile: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, mobile: false },
  { href: "/reports", label: "Reports", icon: FileText, mobile: false },
  { href: "/ethics", label: "Ethics", icon: Scale, mobile: false },
  { href: "/yearly", label: "Yearly", icon: CalendarClock, mobile: false, upcoming: true },
];
