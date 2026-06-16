import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-purple text-white hover:opacity-90",
  ghost: "border border-border text-text-secondary hover:bg-white/5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ className, variant = "primary", type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
