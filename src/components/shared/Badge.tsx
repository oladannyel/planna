import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Soft-pill badge. One tone scale shared by status, priority and tags, so a
 * colour means the same thing wherever it appears.
 */
export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "muted";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-text-muted/15 text-text-secondary",
  brand: "bg-purple/15 text-purple",
  success: "bg-teal/15 text-teal",
  warning: "bg-amber/15 text-amber",
  danger: "bg-danger/15 text-danger",
  muted: "bg-text-muted/10 text-text-muted",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
