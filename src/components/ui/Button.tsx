import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-purple text-white shadow-theme-xs hover:bg-brand-700 disabled:hover:bg-purple",
  outline:
    "border border-border bg-card text-text-primary shadow-theme-xs hover:bg-card-hover disabled:hover:bg-card",
  ghost: "text-text-secondary hover:bg-card-hover hover:text-text-primary",
  danger: "bg-danger text-white shadow-theme-xs hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  startIcon,
  endIcon,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        startIcon
      )}
      {children}
      {!loading && endIcon}
    </button>
  );
}
