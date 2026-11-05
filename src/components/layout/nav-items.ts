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
  /** Which sidebar section it belongs to. */
  group: NavGroup;
}

/** Sidebar grouping, mirroring TailAdmin's labelled sections. */
export type NavGroup = "plan" | "review";

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "review", label: "Review" },
];

export const NAV_ITEMS: NavItem[] = [
  { group: "plan", href: "/board", label: "Board", icon: LayoutGrid, mobile: true },
  { group: "plan", href: "/daily", label: "Daily", icon: CalendarDays, mobile: true },
  { group: "plan", href: "/weekly", label: "Weekly", icon: CalendarRange, mobile: true },
  { group: "plan", href: "/monthly", label: "Monthly", icon: ClipboardList, mobile: true },
  { group: "review", href: "/analytics", label: "Analytics", icon: BarChart3, mobile: false },
  { group: "review", href: "/reports", label: "Reports", icon: FileText, mobile: false },
  { group: "review", href: "/ethics", label: "Ethics", icon: Scale, mobile: false },
  {
    group: "review",
    href: "/yearly",
    label: "Yearly",
    icon: CalendarClock,
    mobile: false,
    upcoming: true,
  },
];
