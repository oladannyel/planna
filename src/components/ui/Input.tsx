import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared field chrome, so input, select and textarea cannot drift apart.
 *
 * `bg-field` + `border-field-border`, not `bg-card` + `border-border`: a field
 * drawn in the card's own colour behind a border a step away from it is
 * invisible on a dark surface — the public request form rendered as a heading
 * over empty space. The border meets WCAG 1.4.11 (3:1 against both the field
 * and the card), which is what makes the control's boundary perceivable
 * rather than merely present.
 */
export const FIELD_BASE =
  "w-full rounded-lg border border-field-border bg-field px-3.5 py-2.5 text-sm text-text-primary " +
  "shadow-theme-xs outline-none transition-colors placeholder:text-text-muted " +
  "hover:border-purple/60 " +
  "focus:border-purple focus:ring-4 focus:ring-purple/20 " +
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
          <span className="ms-0.5 text-danger-ink" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div aria-describedby={describedBy}>{children}</div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-ink">
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
