import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Shared field chrome, so input, select and textarea cannot drift apart. */
export const FIELD_BASE =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary " +
  "shadow-theme-xs outline-none transition-colors placeholder:text-text-muted " +
  "focus:border-purple focus:ring-4 focus:ring-purple/10 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD_BASE, "pe-9", className)} {...props}>
      {children}
    </select>
  );
}

/**
 * Label + control + hint/error. Wiring `htmlFor`, `aria-describedby` and
 * `aria-invalid` here means every form gets it right by default.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
        {label}
        {required ? (
          <span className="ms-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div aria-describedby={describedBy}>{children}</div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
